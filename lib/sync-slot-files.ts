import type { SupabaseClient } from "@supabase/supabase-js";
import { getObjectMetadata, listObjects } from "@/lib/r2";
import type { CustomerSlot, Photo } from "@/lib/types";

function fileNameFromObjectKey(objectKey: string) {
  const baseName = objectKey.split("/").pop() ?? objectKey;
  const match = baseName.match(/^[0-9a-f-]{36}-(.+)$/i);
  return match?.[1] || baseName;
}

function fallbackMimeType(fileName: string) {
  const lowerName = fileName.toLowerCase();
  const extension = lowerName.split(".").pop();
  if (extension === "webm") return lowerName.startsWith("guest-voice") ? "audio/webm" : "video/webm";
  if (extension === "mp4") return "video/mp4";
  if (extension === "ogg") return "audio/ogg";
  if (extension === "doc") return "application/msword";
  if (extension === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "gif") return "image/gif";
  return "application/octet-stream";
}

export async function syncSlotFilesFromR2(supabase: SupabaseClient, slot: CustomerSlot) {
  if (!slot.storage_prefix) return;

  const { data: existingRows, error: existingError } = await supabase
    .from("photos")
    .select("object_key")
    .eq("slot_id", slot.id);

  if (existingError) throw existingError;

  const existingKeys = new Set(((existingRows ?? []) as Pick<Photo, "object_key">[]).map((row) => row.object_key));
  const r2Objects = await listObjects(slot.storage_prefix);
  const missingObjects = r2Objects.filter((object) => !existingKeys.has(object.key));
  const r2TotalBytes = r2Objects.reduce((sum, object) => sum + object.sizeBytes, 0);

  if (!missingObjects.length) {
    if (r2TotalBytes > slot.storage_used_bytes) {
      await supabase.from("customer_slots").update({ storage_used_bytes: r2TotalBytes }).eq("id", slot.id);
    }
    return;
  }

  const rows = await Promise.all(
    missingObjects.map(async (object) => {
      const fileName = fileNameFromObjectKey(object.key);
      const metadata = await getObjectMetadata(object.key).catch(() => null);

      return {
        slot_id: slot.id,
        object_key: object.key,
        file_name: fileName,
        mime_type: metadata?.contentType || fallbackMimeType(fileName),
        file_size_bytes: metadata?.contentLength ?? object.sizeBytes
      };
    })
  );

  const { error: insertError } = await supabase.from("photos").insert(rows);
  if (insertError) throw insertError;

  const totalBytes = Math.max(slot.storage_used_bytes, r2TotalBytes);
  await supabase.from("customer_slots").update({ storage_used_bytes: totalBytes }).eq("id", slot.id);
}
