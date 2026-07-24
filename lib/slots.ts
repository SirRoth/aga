import type { SupabaseClient } from "@supabase/supabase-js";
import { deletePrefix } from "@/lib/r2";
import type { CustomerSlot } from "@/lib/types";

export async function recycleSlot(supabase: SupabaseClient, slot: CustomerSlot) {
  if (slot.storage_prefix) {
    await deletePrefix(slot.storage_prefix);
  }

  await supabase.from("photos").delete().eq("slot_id", slot.id);

  const { error } = await supabase
    .from("customer_slots")
    .update({
      status: "VACANT",
      event_name: null,
      upload_slug: slot.is_reseller ? slot.upload_slug : null,
      download_token: null,
      storage_prefix: null,
      event_start_at: null,
      storage_used_bytes: 0,
      allow_videos: false,
      reseller_suspended: slot.is_reseller ? slot.reseller_suspended : false
    })
    .eq("id", slot.id);

  if (error) throw error;
}
