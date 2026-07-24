import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteFolderAndContents } from "@/lib/gdrive";
import type { CustomerSlot } from "@/lib/types";

export async function recycleSlot(supabase: SupabaseClient, slot: CustomerSlot) {
  if (slot.gdrive_folder_id) {
    await deleteFolderAndContents(slot.gdrive_folder_id);
  }

  await supabase.from("photos").delete().eq("slot_id", slot.id);

  const { error } = await supabase
    .from("customer_slots")
    .update({
      status: "VACANT",
      event_name: null,
      upload_slug: null,
      download_token: null,
      gdrive_folder_id: null,
      event_start_at: null,
      storage_used_bytes: 0
    })
    .eq("id", slot.id);

  if (error) throw error;
}
