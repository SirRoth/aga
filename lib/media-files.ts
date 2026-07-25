export function cleanFileNameFromObjectKey(objectKey: string) {
  const baseName = objectKey.split("/").pop() ?? objectKey;
  const match = baseName.match(/^[0-9a-f-]{36}-(.+)$/i);
  return match?.[1] || baseName;
}

export function inferMediaMimeType(fileName: string, objectKey: string, storedMimeType?: string | null) {
  const lowerName = fileName.toLowerCase();
  const lowerKey = objectKey.toLowerCase();
  const extension = lowerName.split(".").pop();

  if (lowerName.startsWith("guest-voice") || lowerKey.includes("-guest-voice-")) return "audio/webm";
  if (lowerName.startsWith("guest-video") || lowerKey.includes("-guest-video-")) {
    return extension === "mp4" ? "video/mp4" : "video/webm";
  }
  if (extension === "doc") return "application/msword";
  if (extension === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (extension === "webm") return "video/webm";
  if (extension === "mp4") return storedMimeType?.startsWith("audio/") ? "audio/mp4" : "video/mp4";
  if (extension === "ogg") return "audio/ogg";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "gif") return "image/gif";

  if (storedMimeType && storedMimeType !== "application/octet-stream") return storedMimeType;
  return "application/octet-stream";
}

export function isAudioFile(fileName: string, objectKey: string, mimeType: string) {
  return inferMediaMimeType(fileName, objectKey, mimeType).startsWith("audio/");
}

export function isVideoFile(fileName: string, objectKey: string, mimeType: string) {
  return inferMediaMimeType(fileName, objectKey, mimeType).startsWith("video/");
}

export function isWordFile(fileName: string, objectKey: string, mimeType: string) {
  return inferMediaMimeType(fileName, objectKey, mimeType).includes("word");
}
