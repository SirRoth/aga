import { NextResponse } from "next/server";
import { createSupabaseAdminClient, requireAdmin } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slotId } = await request.json();
  if (!slotId) return NextResponse.json({ error: "slotId is required." }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const { data: slot, error: slotError } = await supabase
    .from("customer_slots")
    .select("id,status,storage_prefix,storage_used_bytes")
    .eq("id", slotId)
    .maybeSingle();

  if (slotError) throw slotError;
  if (!slot) return NextResponse.json({ error: "Box not found." }, { status: 404 });
  if (slot.status !== "VACANT") {
    return NextResponse.json({ error: "Recycle or close the active event before removing this box." }, { status: 409 });
  }
  if (slot.storage_prefix || Number(slot.storage_used_bytes) > 0) {
    return NextResponse.json({ error: "Recycle this box before removing it." }, { status: 409 });
  }

  const { error: photosError } = await supabase.from("photos").delete().eq("slot_id", slotId);
  if (photosError) throw photosError;

  const { error } = await supabase.from("customer_slots").delete().eq("id", slotId);
  if (error) throw error;

  return NextResponse.json({ ok: true });
}
