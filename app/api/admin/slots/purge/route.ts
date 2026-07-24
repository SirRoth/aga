import { NextResponse } from "next/server";
import { recycleSlot } from "@/lib/slots";
import { createSupabaseAdminClient, requireAdmin } from "@/lib/supabase/server";
import type { CustomerSlot } from "@/lib/types";

export async function POST(request: Request) {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slotId } = await request.json();
  if (!slotId) return NextResponse.json({ error: "slotId is required." }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const { data: slot, error } = await supabase.from("customer_slots").select("*").eq("id", slotId).maybeSingle();
  if (error) throw error;
  if (!slot) return NextResponse.json({ error: "Slot not found." }, { status: 404 });

  await recycleSlot(supabase, slot as CustomerSlot);
  return NextResponse.json({ ok: true });
}
