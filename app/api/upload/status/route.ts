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
    .select("status,event_start_at,storage_limit_bytes,storage_used_bytes")
    .eq("upload_slug", uploadSlug)
    .maybeSingle();

  if (error) throw error;
  if (!slot) return NextResponse.json({ error: "Upload slot not found." }, { status: 404 });

  const customerSlot = slot as Pick<
    CustomerSlot,
    "event_start_at" | "status" | "storage_limit_bytes" | "storage_used_bytes"
  >;

  return NextResponse.json({
    active: customerSlot.status === "ACTIVE" && isWithinActiveWindow(customerSlot.event_start_at),
    storageLimitBytes: customerSlot.storage_limit_bytes,
    storageUsedBytes: customerSlot.storage_used_bytes
  });
}
