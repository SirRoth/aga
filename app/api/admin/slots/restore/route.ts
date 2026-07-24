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
    .select("upload_slug, download_token, storage_prefix")
    .eq("id", slotId)
    .eq("status", "EXPIRED_GRACE")
    .maybeSingle();

  if (slotError) throw slotError;
  if (!slot?.upload_slug || !slot.download_token || !slot.storage_prefix) {
    return NextResponse.json({ error: "Only complete grace-period events can be reopened." }, { status: 400 });
  }

  const { error } = await supabase.from("customer_slots").update({ status: "ACTIVE" }).eq("id", slotId);
  if (error) throw error;

  return NextResponse.json({ ok: true });
}
