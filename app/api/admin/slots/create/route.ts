import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { createSupabaseAdminClient, requireAdmin } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slotName, resellerCompanyName, isReseller } = await request.json();
  const supabase = createSupabaseAdminClient();

  if (isReseller) {
    const cleanCompanyName = String(resellerCompanyName ?? "").trim();
    if (!cleanCompanyName) {
      return NextResponse.json({ error: "Reseller company name is required." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("customer_slots")
      .insert({
        is_reseller: true,
        reseller_company_name: cleanCompanyName,
        reseller_suspended: false,
        slot_name: cleanCompanyName,
        upload_slug: nanoid(14)
      })
      .select("id,upload_slug")
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  }

  const cleanSlotName = String(slotName ?? "").trim();
  if (!cleanSlotName) {
    return NextResponse.json({ error: "Box name is required." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("customer_slots")
    .insert({ slot_name: cleanSlotName, is_reseller: false })
    .select("id")
    .single();

  if (error) throw error;
  return NextResponse.json(data);
}
