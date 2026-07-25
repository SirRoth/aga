"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Mic, RotateCcw, Upload, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { bytesToHuman } from "@/lib/utils";

type PresignedUpload = {
  objectKey: string;
  uploadUrl: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

type MessageMode = "voice" | "video" | "text";

function getSupportedRecorderMimeType(mode: Exclude<MessageMode, "text">) {
  const mimeTypes =
    mode === "video"
      ? ["video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
      : ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];

  return mimeTypes.find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
}

function getRecordingExtension(mimeType: string, mode: Exclude<MessageMode, "text">) {
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("webm")) return "webm";
  return mode === "video" ? "webm" : "webm";
}

function uploadWithProgress(upload: PresignedUpload, file: File, onProgress: (loadedBytes: number) => void) {
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function textToWordFile(message: string, eventName: string | null) {
  const title = eventName ? `${eventName} message` : "Guest message";
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body {
      margin: 56px;
      color: #2f241d;
      background: #fffaf3;
      font-family: "Brush Script MT", "Segoe Script", "Lucida Handwriting", cursive;
      font-size: 28px;
      line-height: 1.65;
    }
    h1 {
      color: #b98537;
      font-family: Georgia, serif;
      font-size: 26px;
      font-weight: normal;
      letter-spacing: 2px;
      text-transform: uppercase;
    }
    .message {
      border-top: 1px solid #d8b98e;
      margin-top: 24px;
      padding-top: 28px;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="message">${escapeHtml(message)}</div>
</body>
</html>`;
  const safeDate = new Date().toISOString().replace(/[:.]/g, "-");
  return new File([html], `guest-message-${safeDate}.doc`, { type: "application/msword" });
}

export function MessageUploadForm({
  uploadSlug,
  eventName,
  storageLimitBytes,
  storageUsedBytes
}: {
  uploadSlug: string;
  eventName: string | null;
  storageLimitBytes: number;
  storageUsedBytes: number;
}) {
  const router = useRouter();
  const previewRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [mode, setMode] = useState<MessageMode>("voice");
  const [recording, setRecording] = useState(false);
  const [recordedFile, setRecordedFile] = useState<File | null>(null);
  const [recordedUrl, setRecordedUrl] = useState("");
  const [textMessage, setTextMessage] = useState("");
  const [message, setMessage] = useState("");
  const [usedBytes, setUsedBytes] = useState(storageUsedBytes);
  const [progressPercent, setProgressPercent] = useState(0);
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
      if (status.suspended) router.push("/account-suspended");
    }

    refreshStorage();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") refreshStorage();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [router, uploadSlug]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
  }, [recordedUrl]);

  function resetRecording() {
    recorderRef.current?.state === "recording" && recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    chunksRef.current = [];
    setRecording(false);
    setRecordedFile(null);
    setRecordedUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return "";
    });
    setMessage("");
  }

  async function startRecording(nextMode: Exclude<MessageMode, "text">) {
    resetRecording();
    setMode(nextMode);
    setMessage("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        nextMode === "video" ? { audio: true, video: true } : { audio: true }
      );
      streamRef.current = stream;
      if (previewRef.current && nextMode === "video") {
        previewRef.current.srcObject = stream;
      }

      const mimeType = getSupportedRecorderMimeType(nextMode);
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || (nextMode === "video" ? "video/webm" : "audio/webm");
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const extension = getRecordingExtension(mimeType, nextMode);
        const file = new File([blob], `guest-${nextMode}-${Date.now()}.${extension}`, { type: mimeType });
        const url = URL.createObjectURL(blob);
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        if (previewRef.current) {
          previewRef.current.srcObject = null;
          previewRef.current.load();
        }
        setRecordedFile(file);
        setRecordedUrl(url);
        setRecording(false);
      };
      recorder.start();
      setRecording(true);
    } catch {
      setMessage("Could not access the microphone or camera on this device.");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
  }

  function uploadFile(file: File) {
    setMessage("");
    setProgressPercent(0);

    startTransition(async () => {
      try {
        if (usedBytes + file.size > storageLimitBytes) {
          setMessage("This message is larger than the remaining event storage.");
          return;
        }

        const presignResponse = await fetch("/api/upload/presign", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            uploadSlug,
            files: [{ fileName: file.name, mimeType: file.type, sizeBytes: file.size }]
          })
        });
        const presignResult = await presignResponse.json();
        if (!presignResponse.ok) {
          setMessage(presignResult.error ?? "Upload failed.");
          return;
        }

        const upload = presignResult.uploads[0] as PresignedUpload;
        try {
          await uploadWithProgress(upload, file, (loadedBytes) => {
            setProgressPercent(Math.round((loadedBytes / file.size) * 100));
          });
        } catch (error) {
          setMessage("Direct upload failed. Retrying through server...");
          const fallbackData = new FormData();
          fallbackData.set("uploadSlug", uploadSlug);
          fallbackData.set("objectKey", upload.objectKey);
          fallbackData.set("mimeType", upload.mimeType);
          fallbackData.set("sizeBytes", String(upload.sizeBytes));
          fallbackData.set("file", file);

          const fallbackResponse = await fetch("/api/upload/proxy", { method: "POST", body: fallbackData });
          if (!fallbackResponse.ok) {
            const fallbackResult = await fallbackResponse.json().catch(() => null);
            setMessage(fallbackResult?.error ?? (error instanceof Error ? error.message : "Upload failed."));
            return;
          }
          setProgressPercent(100);
        }

        const completeResponse = await fetch("/api/upload/presign", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            uploadSlug,
            uploads: [
              {
                objectKey: upload.objectKey,
                fileName: upload.fileName,
                mimeType: upload.mimeType,
                sizeBytes: upload.sizeBytes
              }
            ]
          })
        });
        const completeResult = await completeResponse.json();
        if (!completeResponse.ok) {
          setMessage(completeResult.error ?? "Upload failed.");
          return;
        }

        resetRecording();
        setUsedBytes(completeResult.storageUsedBytes);
        setTextMessage("");
        setMessage("Message uploaded. Thank you.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Upload failed.");
      }
    });
  }

  function uploadText() {
    const cleanText = textMessage.trim();
    if (!cleanText) {
      setMessage("Write a message before uploading.");
      return;
    }
    uploadFile(textToWordFile(cleanText, eventName));
  }

  return (
    <div className="grid gap-5">
      <div>
        <div className="mb-2 flex justify-between text-sm text-[#9b8069]">
          <span>{bytesToHuman(usedBytes)} stored</span>
          <span>{bytesToHuman(storageLimitBytes)} limit</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[#eadbc9]">
          <div className="h-full rounded-full bg-[#b98537]" style={{ width: `${usedPercent}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { key: "voice" as const, label: "Voice", icon: Mic },
          { key: "video" as const, label: "Video", icon: Video },
          { key: "text" as const, label: "Text", icon: FileText }
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              className={`flex h-12 items-center justify-center gap-2 rounded-lg border text-sm font-semibold ${
                mode === item.key
                  ? "border-[#b98537] bg-[#b98537] text-white"
                  : "border-[#e5d2ba] bg-white/55 text-[#4a3b32]"
              }`}
              key={item.key}
              onClick={() => {
                resetRecording();
                setMode(item.key);
              }}
              type="button"
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      {mode === "text" ? (
        <div className="grid gap-3">
          <textarea
            className="min-h-44 rounded-xl border border-[#e5d2ba] bg-white/65 p-4 text-base leading-7 text-[#2f241d] outline-none ring-[#b98537] placeholder:text-[#9b8069] focus:ring-2"
            value={textMessage}
            onChange={(event) => setTextMessage(event.target.value)}
            placeholder="Write your message here..."
          />
          <Button
            className="h-14 rounded-lg bg-[#b98537] text-base font-semibold text-white hover:bg-[#a87530]"
            disabled={pending || !textMessage.trim()}
            onClick={uploadText}
          >
            <Upload className="h-4 w-4" />
            Upload message
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 rounded-xl border border-[#e5d2ba] bg-white/55 p-4">
          {mode === "video" ? (
            <video
              className="aspect-video w-full rounded-lg bg-[#2f241d] object-cover"
              controls={Boolean(recordedUrl)}
              muted={!recordedUrl}
              playsInline
              ref={previewRef}
              src={recordedUrl || undefined}
              autoPlay={!recordedUrl}
            />
          ) : recordedUrl ? (
            <audio className="w-full" controls src={recordedUrl} />
          ) : (
            <div className="flex min-h-36 flex-col items-center justify-center rounded-lg border border-dashed border-[#d8b98e] text-center text-[#6e5543]">
              <Mic className="mb-3 h-9 w-9 text-[#b98537]" />
              Record a voice note for the event host.
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {!recording && !recordedFile ? (
              <Button
                className="bg-[#b98537] text-white hover:bg-[#a87530]"
                disabled={pending}
                onClick={() => startRecording(mode === "video" ? "video" : "voice")}
              >
                {mode === "video" ? <Video className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                Start recording
              </Button>
            ) : null}
            {recording ? (
              <Button className="bg-[#b98537] text-white hover:bg-[#a87530]" onClick={stopRecording}>
                Stop recording
              </Button>
            ) : null}
            {recordedFile ? (
              <>
                <Button
                  className="bg-[#b98537] text-white hover:bg-[#a87530]"
                  disabled={pending}
                  onClick={() => uploadFile(recordedFile)}
                >
                  <Upload className="h-4 w-4" />
                  Upload
                </Button>
                <Button variant="outline" disabled={pending} onClick={resetRecording}>
                  <RotateCcw className="h-4 w-4" />
                  Retake
                </Button>
              </>
            ) : null}
          </div>
        </div>
      )}

      {pending ? (
        <div className="rounded-xl border border-[#e5d2ba] bg-white/55 p-4">
          <div className="mb-2 flex justify-between gap-3 text-sm text-[#6e5543]">
            <span>Uploading message...</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#eadbc9]">
            <div className="h-full rounded-full bg-[#d8a24d]" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      ) : null}
      {message ? (
        <p className="rounded-lg border border-[#e5d2ba] bg-white/65 p-3 text-sm text-[#4a3b32]">{message}</p>
      ) : null}
    </div>
  );
}
