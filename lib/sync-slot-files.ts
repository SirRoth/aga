import type { SupabaseClient } from "@supabase/supabase-js";
import { cleanFileNameFromObjectKey, inferMediaMimeType } from "@/lib/media-files";
import { getObjectMetadata, listObjects } from "@/lib/r2";
import type { CustomerSlot, Photo } from "@/lib/types";

export async function syncSlotFilesFromR2(supabase: SupabaseClient, slot: CustomerSlot) {
  if (!slot.storage_prefix) return;

  const { data: existingRows, error: existingError } = await supabase
    .from("photos")
    .select("*")
    .eq("slot_id", slot.id);

  if (existingError) throw existingError;

  const existingPhotos = (existingRows ?? []) as Photo[];
  const existingByKey = new Map(existingPhotos.map((row) => [row.object_key, row]));
  const r2Objects = await listObjects(slot.storage_prefix);
  const missingObjects = r2Objects.filter((object) => !existingByKey.has(object.key));
  const r2TotalBytes = r2Objects.reduce((sum, object) => sum + object.sizeBytes, 0);

  await Promise.all(
    r2Objects.map(async (object) => {
      const existingPhoto = existingByKey.get(object.key);
      if (!existingPhoto) return;

      const metadata = await getObjectMetadata(object.key).catch(() => null);
      const fileName = cleanFileNameFromObjectKey(object.key);
      const mimeType = inferMediaMimeType(fileName, object.key, metadata?.contentType ?? existingPhoto.mime_type);
      const fileSizeBytes = metadata?.contentLength ?? object.sizeBytes;

      if (
        existingPhoto.file_name === fileName &&
        existingPhoto.mime_type === mimeType &&
        existingPhoto.file_size_bytes === fileSizeBytes
      ) {
        return;
      }

      const { error: updateError } = await supabase
        .from("photos")
        .update({
          file_name: fileName,
          mime_type: mimeType,
          file_size_bytes: fileSizeBytes
        })
        .eq("id", existingPhoto.id);

      if (updateError) throw updateError;
    })
  );

  if (!missingObjects.length) {
    if (r2TotalBytes > slot.storage_used_bytes) {
      await supabase.from("customer_slots").update({ storage_used_bytes: r2TotalBytes }).eq("id", slot.id);
    }
    return;
  }

  const rows = await Promise.all(
    missingObjects.map(async (object) => {
      const fileName = cleanFileNameFromObjectKey(object.key);
      const metadata = await getObjectMetadata(object.key).catch(() => null);
      const mimeType = inferMediaMimeType(fileName, object.key, metadata?.contentType);

      return {
        slot_id: slot.id,
        object_key: object.key,
        file_name: fileName,
        mime_type: mimeType,
        file_size_bytes: metadata?.contentLength ?? object.sizeBytes
      };
    })
  );

  const { error: insertError } = await supabase.from("photos").insert(rows);
  if (insertError) throw insertError;

  const totalBytes = Math.max(slot.storage_used_bytes, r2TotalBytes);
  await supabase.from("customer_slots").update({ storage_used_bytes: totalBytes }).eq("id", slot.id);
}
