"use client";

import { useState, useTransition } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

export function UploadForm({ uploadSlug }: { uploadSlug: string }) {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setMessage("");
    formData.set("uploadSlug", uploadSlug);
    startTransition(async () => {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData
      });
      const result = await response.json();
      setMessage(response.ok ? `Uploaded ${result.uploaded} file(s).` : result.error ?? "Upload failed.");
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
