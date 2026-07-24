import { NextResponse } from "next/server";
import { createSupabaseAdminClient, requireAdmin } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slotId } = await request.json();
  if (!slotId) return NextResponse.json({ error: "slotId is required." }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("customer_slots")
    .update({ status: "EXPIRED_GRACE" })
    .eq("id", slotId)
    .eq("status", "ACTIVE");

  if (error) throw error;
  return NextResponse.json({ ok: true });
}
