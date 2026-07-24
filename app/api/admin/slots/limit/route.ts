import { NextResponse } from "next/server";
import { createSupabaseAdminClient, requireAdmin } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slotId, storageLimitBytes } = await request.json();
  const limit = Number(storageLimitBytes);
  if (!slotId || !Number.isFinite(limit) || limit <= 0) {
    return NextResponse.json({ error: "A positive storageLimitBytes value is required." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("customer_slots")
    .update({ storage_limit_bytes: Math.round(limit) })
    .eq("id", slotId);

  if (error) throw error;
  return NextResponse.json({ ok: true });
}
