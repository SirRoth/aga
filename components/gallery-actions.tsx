"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Photo } from "@/lib/types";

export function GalleryActions({ token, photos }: { token: string; photos: Photo[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(photos.map((photo) => photo.id));
  const selectedQuery = useMemo(() => selected.map((id) => `photoId=${encodeURIComponent(id)}`).join("&"), [selected]);

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

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => (window.location.href = `/api/download/zip?token=${token}`)}>
          <Download className="h-4 w-4" />
          Download Zip
        </Button>
        <Button
          variant="outline"
          disabled={selected.length === 0}
          onClick={() => (window.location.href = `/api/download/zip?token=${token}&${selectedQuery}`)}
        >
          <Download className="h-4 w-4" />
          Download Selected
        </Button>
      </div>
      {photos.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo) => (
            <label className="group relative overflow-hidden rounded-lg border bg-white" key={photo.id}>
              <input
                checked={selected.includes(photo.id)}
                className="absolute left-2 top-2 z-10 h-5 w-5"
                onChange={() => toggle(photo.id)}
                type="checkbox"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={photo.file_name}
                className="aspect-square w-full object-cover"
                src={`/api/download?token=${token}&photoId=${photo.id}`}
              />
              <span className="block truncate px-3 py-2 text-xs">{photo.file_name}</span>
            </label>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border bg-card p-5">No photos have been uploaded yet.</p>
      )}
    </div>
  );
}
