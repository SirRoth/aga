import { NextResponse } from "next/server";
import { createSupabaseAdminClient, requireAdmin } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slotId, suspended } = await request.json();
  if (!slotId || typeof suspended !== "boolean") {
    return NextResponse.json({ error: "slotId and suspended are required." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("customer_slots")
    .update({ reseller_suspended: suspended })
    .eq("id", slotId)
    .eq("is_reseller", true);

  if (error) throw error;

  return NextResponse.json({ ok: true });
}
