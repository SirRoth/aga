"use client";

import { useState, useTransition } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { bytesToHuman } from "@/lib/utils";

type PresignedUpload = {
  objectKey: string;
  uploadUrl: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

function uploadWithProgress(
  upload: PresignedUpload,
  file: File,
  onProgress: (loadedBytes: number) => void
) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded);
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(file.size);
        resolve();
      } else {
        reject(new Error(`R2 returned ${request.status}.`));
      }
    };
    request.onerror = () => reject(new Error("Failed to fetch"));
    request.onabort = () => reject(new Error("Upload cancelled."));
    request.open("PUT", upload.uploadUrl);
    request.setRequestHeader("content-type", upload.mimeType);
    request.send(file);
  });
}

export function UploadForm({
  uploadSlug,
  storageLimitBytes,
  storageUsedBytes
}: {
  uploadSlug: string;
  storageLimitBytes: number;
  storageUsedBytes: number;
}) {
  const [message, setMessage] = useState("");
  const [usedBytes, setUsedBytes] = useState(storageUsedBytes);
  const [progressPercent, setProgressPercent] = useState(0);
  const [uploadingFileName, setUploadingFileName] = useState("");
  const [pending, startTransition] = useTransition();
  const usedPercent = Math.min((usedBytes / storageLimitBytes) * 100, 100);

  function submit(formData: FormData) {
    setMessage("");
    setProgressPercent(0);
    setUploadingFileName("");
    startTransition(async () => {
      try {
        const files = formData.getAll("files").filter((value): value is File => value instanceof File);
        if (files.length === 0) {
          setMessage("Choose at least one photo.");
          return;
        }

        const uploadFiles = files.map((file) => ({
          file,
          fileName: file.name || "mobile-photo",
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size
        }));
        const totalBytes = uploadFiles.reduce((sum, uploadFile) => sum + uploadFile.sizeBytes, 0);
        if (usedBytes + totalBytes > storageLimitBytes) {
          setMessage("These files are larger than the remaining event storage.");
          return;
        }

        const presignResponse = await fetch("/api/upload/presign", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            uploadSlug,
            files: uploadFiles.map(({ fileName, mimeType, sizeBytes }) => ({
              fileName,
              mimeType,
              sizeBytes
            }))
          })
        });

        const presignResult = await presignResponse.json();
        if (!presignResponse.ok) {
          setMessage(presignResult.error ?? "Upload failed.");
          return;
        }

        let completedBytes = 0;
        for (const [index, upload] of (presignResult.uploads as PresignedUpload[]).entries()) {
          const selectedFile = uploadFiles[index];
          setUploadingFileName(selectedFile.fileName);
          try {
            await uploadWithProgress(upload, selectedFile.file, (loadedBytes) => {
              setProgressPercent(Math.round(((completedBytes + loadedBytes) / totalBytes) * 100));
            });
            completedBytes += selectedFile.sizeBytes;
          } catch (error) {
            setMessage(`Direct upload failed for ${selectedFile.fileName}. Retrying through server...`);
            const fallbackData = new FormData();
            fallbackData.set("uploadSlug", uploadSlug);
            fallbackData.set("objectKey", upload.objectKey);
            fallbackData.set("mimeType", upload.mimeType);
            fallbackData.set("sizeBytes", String(upload.sizeBytes));
            fallbackData.set("file", selectedFile.file);

            const fallbackResponse = await fetch("/api/upload/proxy", {
              method: "POST",
              body: fallbackData
            });

            if (!fallbackResponse.ok) {
              const fallbackResult = await fallbackResponse.json().catch(() => null);
              const detail =
                fallbackResult?.error ??
                (error instanceof Error ? error.message : "Network request failed.");
              setMessage(`Upload failed for ${selectedFile.fileName}: ${detail}`);
              return;
            }
            completedBytes += selectedFile.sizeBytes;
            setProgressPercent(Math.round((completedBytes / totalBytes) * 100));
          }
        }

        const completeResponse = await fetch("/api/upload/presign", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            uploadSlug,
            uploads: presignResult.uploads.map(
              (upload: { objectKey: string; fileName: string; mimeType: string; sizeBytes: number }) => ({
                objectKey: upload.objectKey,
                fileName: upload.fileName,
                mimeType: upload.mimeType,
                sizeBytes: upload.sizeBytes
              })
            )
          })
        });

        const completeResult = await completeResponse.json();
        if (completeResponse.ok && typeof completeResult.storageUsedBytes === "number") {
          setUsedBytes(completeResult.storageUsedBytes);
        }
        setUploadingFileName("");
        setMessage(
          completeResponse.ok
            ? `Uploaded ${completeResult.uploaded} file(s).`
            : completeResult.error ?? "Upload failed."
        );
      } catch (error) {
        setUploadingFileName("");
        setMessage(error instanceof Error ? error.message : "Upload failed.");
      }
    });
  }

  return (
    <form action={submit} className="grid gap-4">
      <div className="rounded-md border bg-white p-4">
        <div className="mb-2 flex justify-between text-sm">
          <span>{bytesToHuman(usedBytes)} stored</span>
          <span>{bytesToHuman(storageLimitBytes)} limit</span>
        </div>
        <div className="h-2 overflow-hidden rounded bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${usedPercent}%` }} />
        </div>
      </div>
      <input
        className="block w-full rounded-md border bg-white p-3 text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground"
        multiple
        name="files"
        type="file"
        accept="image/*"
      />
      <Button disabled={pending} type="submit">
        <Upload className="h-4 w-4" />
        {pending ? "Uploading..." : "Upload photos"}
      </Button>
      {pending ? (
        <div className="rounded-md border bg-white p-4">
          <div className="mb-2 flex justify-between text-sm">
            <span className="truncate">{uploadingFileName || "Preparing upload..."}</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded bg-muted">
            <div className="h-full bg-secondary transition-all" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      ) : null}
      {message ? <p className="rounded-md bg-muted p-3 text-sm">{message}</p> : null}
    </form>
  );
}
