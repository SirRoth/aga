"use client";

import { useEffect, useState, useTransition } from "react";
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
  allowVideos,
  storageLimitBytes,
  storageUsedBytes
}: {
  uploadSlug: string;
  allowVideos: boolean;
  storageLimitBytes: number;
  storageUsedBytes: number;
}) {
  const [message, setMessage] = useState("");
  const [usedBytes, setUsedBytes] = useState(storageUsedBytes);
  const [progressPercent, setProgressPercent] = useState(0);
  const [uploadingFileName, setUploadingFileName] = useState("");
  const [selectedLabel, setSelectedLabel] = useState("No file chosen");
  const [pending, startTransition] = useTransition();
  const usedPercent = Math.min((usedBytes / storageLimitBytes) * 100, 100);

  useEffect(() => {
    async function refreshStorage() {
      const response = await fetch(`/api/upload/status?uploadSlug=${encodeURIComponent(uploadSlug)}`, {
        cache: "no-store"
      });
      if (!response.ok) return;

      const status = await response.json();
      if (typeof status.storageUsedBytes === "number") setUsedBytes(status.storageUsedBytes);
      if (status.suspended && typeof status.message === "string") setMessage(status.message);
    }

    refreshStorage();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") refreshStorage();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [uploadSlug]);

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
    <form action={submit} className="grid gap-5">
      <div>
        <div className="mb-2 flex justify-between text-sm text-[#9b8069]">
          <span>{bytesToHuman(usedBytes)} stored</span>
          <span>{bytesToHuman(storageLimitBytes)} limit</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[#eadbc9]">
          <div
            className="h-full rounded-full bg-[#b98537] transition-all duration-500"
            style={{ width: `${usedPercent}%` }}
          />
        </div>
      </div>

      <label className="flex min-h-24 cursor-pointer flex-col gap-4 rounded-xl border border-[#e5d2ba] bg-white/50 p-3 text-[#2f241d] shadow-inner shadow-white/40 sm:min-h-20 sm:flex-row sm:items-center">
        <span className="inline-flex h-14 shrink-0 items-center justify-center rounded-lg bg-[#bd873d] px-7 text-base font-semibold text-white shadow-sm">
          Choose files
        </span>
        <span className="min-w-0 truncate px-1 text-base sm:text-lg">{selectedLabel}</span>
        <input
          className="sr-only"
          multiple
          name="files"
          type="file"
          accept={allowVideos ? "image/*,video/*" : "image/*"}
          onChange={(event) => {
            const files = Array.from(event.currentTarget.files ?? []);
            if (!files.length) {
              setSelectedLabel("No file chosen");
              return;
            }
            setSelectedLabel(files.length === 1 ? files[0].name : `${files.length} files selected`);
          }}
        />
      </label>

      <Button
        className="h-16 rounded-lg bg-[#b98537] text-lg font-semibold text-white shadow-lg shadow-[#7f5a2d]/15 hover:bg-[#a87530]"
        disabled={pending}
        type="submit"
      >
        <Upload className="h-4 w-4" />
        {pending ? "Uploading..." : allowVideos ? "Upload photos & videos" : "Upload photos"}
      </Button>
      {pending ? (
        <div className="rounded-xl border border-[#e5d2ba] bg-white/55 p-4">
          <div className="mb-2 flex justify-between gap-3 text-sm text-[#6e5543]">
            <span className="truncate">{uploadingFileName || "Preparing upload..."}</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#eadbc9]">
            <div
              className="h-full rounded-full bg-[#d8a24d] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      ) : null}
      {message ? (
        <p className="rounded-lg border border-[#e5d2ba] bg-white/65 p-3 text-sm text-[#4a3b32]">{message}</p>
      ) : null}
    </form>
  );
}
