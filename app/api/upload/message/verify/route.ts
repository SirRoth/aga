import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { CustomerSlot } from "@/lib/types";
import { isWithinActiveWindow } from "@/lib/utils";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const uploadSlug = url.searchParams.get("uploadSlug");
  const photoId = url.searchParams.get("photoId");

  if (!uploadSlug || !photoId) {
    return NextResponse.json({ error: "uploadSlug and photoId are required." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: slot, error: slotError } = await supabase
    .from("customer_slots")
    .select("*")
    .eq("upload_slug", uploadSlug)
    .maybeSingle();

  if (slotError) throw slotError;

  const customerSlot = slot as CustomerSlot | null;
  if (
    !customerSlot ||
    customerSlot.status !== "ACTIVE" ||
    !customerSlot.storage_prefix ||
    !isWithinActiveWindow(customerSlot.event_start_at)
  ) {
    return NextResponse.json({ error: "Upload link expired." }, { status: 403 });
  }

  const { data: photo, error: photoError } = await supabase
    .from("photos")
    .select("id,file_size_bytes")
    .eq("id", photoId)
    .eq("slot_id", customerSlot.id)
    .maybeSingle();

  if (photoError) throw photoError;

  return NextResponse.json({
    found: Boolean(photo),
    storageUsedBytes: customerSlot.storage_used_bytes,
    storageLimitBytes: customerSlot.storage_limit_bytes
  });
}
