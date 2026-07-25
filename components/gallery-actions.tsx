"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileText, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Photo } from "@/lib/types";
import { bytesToHuman } from "@/lib/utils";

function getZipName(response: Response) {
  const disposition = response.headers.get("content-disposition");
  const match = disposition?.match(/filename="([^"]+)"/);
  return match?.[1] ?? "photos.zip";
}

function getGalleryLabel(photo: Photo) {
  if (photo.mime_type.startsWith("audio/")) return "Voice note";
  if (photo.mime_type.startsWith("video/")) return "Video";
  if (photo.mime_type.includes("word")) return "Written message";
  return "Photo";
}

export function GalleryActions({ token, photos }: { token: string; photos: Photo[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(photos.map((photo) => photo.id));
  const [downloadPercent, setDownloadPercent] = useState(0);
  const [downloadMessage, setDownloadMessage] = useState("");
  const [downloading, setDownloading] = useState(false);
  const selectedPhotos = useMemo(
    () => photos.filter((photo) => selected.includes(photo.id)),
    [photos, selected]
  );
  const selectedBytes = selectedPhotos.reduce((sum, photo) => sum + photo.file_size_bytes, 0);
  const totalBytes = photos.reduce((sum, photo) => sum + photo.file_size_bytes, 0);

  useEffect(() => {
    const photoIds = photos.map((photo) => photo.id);
    setSelected((current) => {
      const currentIds = new Set(current);
      return photoIds.filter((id) => currentIds.has(id) || !currentIds.size);
    });
  }, [photos]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };

    const interval = window.setInterval(refresh, 5000);
    window.addEventListener("focus", refresh);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [router]);

  function toggle(photoId: string) {
    setSelected((current) =>
      current.includes(photoId) ? current.filter((id) => id !== photoId) : [...current, photoId]
    );
  }

  async function downloadZip(photoIds?: string[]) {
    const query = photoIds?.length ? `&${photoIds.map((id) => `photoId=${encodeURIComponent(id)}`).join("&")}` : "";
    const expectedBytes = photoIds?.length ? selectedBytes : totalBytes;

    setDownloading(true);
    setDownloadPercent(0);
    setDownloadMessage("Preparing download...");

    try {
      const response = await fetch(`/api/download/zip?token=${token}${query}`);
      if (!response.ok) throw new Error("Download failed.");
      if (!response.body) throw new Error("This browser cannot track download progress.");

      const reader = response.body.getReader();
      const chunks: ArrayBuffer[] = [];
      let receivedBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
        receivedBytes += value.length;
        if (expectedBytes > 0) {
          setDownloadPercent(Math.min(Math.round((receivedBytes / expectedBytes) * 100), 99));
        }
        setDownloadMessage(`${bytesToHuman(receivedBytes)} downloaded`);
      }

      const blob = new Blob(chunks, { type: "application/zip" });
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = getZipName(response);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);

      setDownloadPercent(100);
      setDownloadMessage("Download ready.");
    } catch (error) {
      setDownloadMessage(error instanceof Error ? error.message : "Download failed.");
    } finally {
      window.setTimeout(() => setDownloading(false), 1800);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 rounded-[20px] border border-white/70 bg-[#fffaf3]/90 p-4 shadow-xl shadow-[#7f5a2d]/10 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[#6e5543]">
          <span>
            {selected.length} selected · {bytesToHuman(selectedBytes)}
          </span>
          <span>Total gallery: {bytesToHuman(totalBytes)}</span>
        </div>
        <div className="flex flex-wrap gap-3">
        <Button
          className="bg-[#b98537] text-white hover:bg-[#a87530]"
          disabled={downloading || photos.length === 0}
          onClick={() => downloadZip()}
        >
          <Download className="h-4 w-4" />
          Download Zip
        </Button>
        <Button
          className="border-[#d8b98e] bg-white/65 text-[#2f241d] hover:bg-[#f3e6d4]"
          variant="outline"
          disabled={downloading || selected.length === 0}
          onClick={() => downloadZip(selected)}
        >
          <Download className="h-4 w-4" />
          Download Selected
        </Button>
        </div>
        {downloading ? (
          <div className="rounded-xl border border-[#e5d2ba] bg-white/55 p-4">
            <div className="mb-2 flex justify-between gap-3 text-sm text-[#6e5543]">
              <span className="truncate">{downloadMessage}</span>
              <span>{downloadPercent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#eadbc9]">
              <div
                className="h-full rounded-full bg-[#d8a24d] transition-all duration-300"
                style={{ width: `${downloadPercent}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>
      {photos.length ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo) => (
            <div
              className="group relative overflow-hidden rounded-[18px] border border-white/70 bg-[#fffaf3]/90 shadow-lg shadow-[#7f5a2d]/10"
              key={photo.id}
            >
              <input
                aria-label={`Select ${photo.file_name}`}
                checked={selected.includes(photo.id)}
                className="absolute left-3 top-3 z-10 h-5 w-5 accent-[#b98537]"
                onChange={() => toggle(photo.id)}
                type="checkbox"
              />
              {photo.mime_type.startsWith("video/") ? (
                <video
                  className="aspect-square w-full bg-black object-cover"
                  controls
                  preload="metadata"
                  src={`/api/download?token=${token}&photoId=${photo.id}`}
                />
              ) : photo.mime_type.startsWith("audio/") ? (
                <div className="flex aspect-square flex-col items-center justify-center gap-4 bg-[#f6eadb] p-4 text-[#4a3b32]">
                  <Mic className="h-12 w-12 text-[#b98537]" />
                  <audio className="w-full" controls src={`/api/download?token=${token}&photoId=${photo.id}`} />
                </div>
              ) : photo.mime_type.includes("word") ? (
                <div className="flex aspect-square flex-col items-center justify-center gap-3 bg-[#f6eadb] p-5 text-center text-[#4a3b32]">
                  <FileText className="h-14 w-14 text-[#b98537]" />
                  <span className="text-sm font-semibold">Written message</span>
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={photo.file_name}
                  className="aspect-square w-full object-cover"
                  src={`/api/download?token=${token}&photoId=${photo.id}`}
                />
              )}
              <span className="block truncate px-3 pt-3 text-xs font-semibold text-[#4a3b32]">
                {getGalleryLabel(photo)}
              </span>
              <span className="block truncate px-3 pb-3 pt-1 text-xs text-[#6e5543]">{photo.file_name}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-[20px] border border-white/70 bg-[#fffaf3]/90 p-6 text-[#4a3b32] shadow-xl shadow-[#7f5a2d]/10">
          No files have been uploaded yet.
        </p>
      )}
    </div>
  );
}
