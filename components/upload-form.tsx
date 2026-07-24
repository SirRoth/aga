"use client";

import { useState, useTransition } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

export function UploadForm({ uploadSlug }: { uploadSlug: string }) {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setMessage("");
    startTransition(async () => {
      const files = formData.getAll("files").filter((value): value is File => value instanceof File);
      if (files.length === 0) {
        setMessage("Choose at least one photo.");
        return;
      }

      const presignResponse = await fetch("/api/upload/presign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          uploadSlug,
          files: files.map((file) => ({
            fileName: file.name,
            mimeType: file.type || "application/octet-stream",
            sizeBytes: file.size
          }))
        })
      });

      const presignResult = await presignResponse.json();
      if (!presignResponse.ok) {
        setMessage(presignResult.error ?? "Upload failed.");
        return;
      }

      await Promise.all(
        presignResult.uploads.map(
          async (upload: { uploadUrl: string; mimeType: string }, index: number) => {
            const response = await fetch(upload.uploadUrl, {
              method: "PUT",
              headers: { "content-type": upload.mimeType },
              body: files[index]
            });

            if (!response.ok) throw new Error(`R2 upload failed for ${files[index].name}.`);
          }
        )
      );

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
      setMessage(
        completeResponse.ok
          ? `Uploaded ${completeResult.uploaded} file(s).`
          : completeResult.error ?? "Upload failed."
      );
    });
  }

  return (
    <form action={submit} className="grid gap-4">
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
      {message ? <p className="rounded-md bg-muted p-3 text-sm">{message}</p> : null}
    </form>
  );
}
