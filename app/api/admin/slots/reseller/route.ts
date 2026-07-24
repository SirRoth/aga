import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { createSupabaseAdminClient, requireAdmin } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slotId, companyName } = await request.json();
  const cleanCompanyName = String(companyName ?? "").trim();

  if (!slotId || !cleanCompanyName) {
    return NextResponse.json({ error: "slotId and companyName are required." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: slot, error: slotError } = await supabase
    .from("customer_slots")
    .select("id,status,upload_slug")
    .eq("id", slotId)
    .maybeSingle();

  if (slotError) throw slotError;
  if (!slot) return NextResponse.json({ error: "Slot not found." }, { status: 404 });
  if (slot.status !== "VACANT") {
    return NextResponse.json({ error: "Only vacant slots can be assigned to resellers." }, { status: 409 });
  }

  const uploadSlug = slot.upload_slug ?? nanoid(14);
  const { error } = await supabase
    .from("customer_slots")
    .update({
      is_reseller: true,
      reseller_suspended: false,
      reseller_company_name: cleanCompanyName,
      slot_name: cleanCompanyName,
      upload_slug: uploadSlug
    })
    .eq("id", slotId);

  if (error) throw error;

  return NextResponse.json({ uploadSlug });
}
