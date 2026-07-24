import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { CustomerSlot } from "@/lib/types";
import { isWithinActiveWindow } from "@/lib/utils";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const uploadSlug = new URL(request.url).searchParams.get("uploadSlug");
  if (!uploadSlug) {
    return NextResponse.json({ error: "uploadSlug is required." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: slot, error } = await supabase
    .from("customer_slots")
    .select("is_reseller,status,event_start_at,reseller_suspended,storage_limit_bytes,storage_used_bytes")
    .eq("upload_slug", uploadSlug)
    .maybeSingle();

  if (error) throw error;
  if (!slot) return NextResponse.json({ error: "Upload slot not found." }, { status: 404 });

  const customerSlot = slot as Pick<
    CustomerSlot,
    | "event_start_at"
    | "is_reseller"
    | "reseller_suspended"
    | "status"
    | "storage_limit_bytes"
    | "storage_used_bytes"
  >;
  const suspended = customerSlot.is_reseller && customerSlot.reseller_suspended;

  return NextResponse.json({
    active:
      customerSlot.status === "ACTIVE" &&
      !suspended &&
      isWithinActiveWindow(customerSlot.event_start_at),
    suspended,
    message: suspended ? "This reseller account is suspended. Please contact your service provider." : null,
    storageLimitBytes: customerSlot.storage_limit_bytes,
    storageUsedBytes: customerSlot.storage_used_bytes
  });
}
