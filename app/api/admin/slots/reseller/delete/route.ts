import { NextResponse } from "next/server";
import { deletePrefix } from "@/lib/r2";
import { createSupabaseAdminClient, requireAdmin } from "@/lib/supabase/server";
import type { CustomerSlot } from "@/lib/types";

export async function POST(request: Request) {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slotId } = await request.json();
  if (!slotId) return NextResponse.json({ error: "slotId is required." }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const { data: slot, error: slotError } = await supabase
    .from("customer_slots")
    .select("*")
    .eq("id", slotId)
    .eq("is_reseller", true)
    .maybeSingle();

  if (slotError) throw slotError;
  if (!slot) return NextResponse.json({ error: "Reseller slot not found." }, { status: 404 });

  const resellerSlot = slot as CustomerSlot;
  if (resellerSlot.storage_prefix) {
    await deletePrefix(resellerSlot.storage_prefix);
  }

  await supabase.from("photos").delete().eq("slot_id", resellerSlot.id);

  const { error } = await supabase
    .from("customer_slots")
    .update({
      is_reseller: false,
      reseller_suspended: false,
      reseller_company_name: null,
      status: "VACANT",
      event_name: null,
      upload_slug: null,
      download_token: null,
      storage_prefix: null,
      event_start_at: null,
      storage_used_bytes: 0,
      allow_videos: false
    })
    .eq("id", resellerSlot.id);

  if (error) throw error;

  return NextResponse.json({ ok: true });
}
