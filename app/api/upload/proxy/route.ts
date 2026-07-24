import { NextResponse } from "next/server";
import { uploadObject } from "@/lib/r2";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { CustomerSlot } from "@/lib/types";
import { isWithinActiveWindow } from "@/lib/utils";

export const runtime = "nodejs";

function isAllowedMimeType(mimeType: string, slot: CustomerSlot) {
  if (slot.box_kind === "MESSAGE") {
    return (
      mimeType.startsWith("audio/") ||
      mimeType.startsWith("video/") ||
      mimeType === "application/msword" ||
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
  }

  return mimeType.startsWith("image/") || (slot.allow_videos && mimeType.startsWith("video/"));
}

function allowedFileMessage(slot: CustomerSlot) {
  if (slot.box_kind === "MESSAGE") return "Only voice notes, videos, and text documents are allowed.";
  return slot.allow_videos ? "Only photo and video files are allowed." : "Only photo files are allowed.";
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const uploadSlug = String(formData.get("uploadSlug") ?? "");
  const objectKey = String(formData.get("objectKey") ?? "");
  const mimeType = String(formData.get("mimeType") ?? "application/octet-stream");
  const sizeBytes = Number(formData.get("sizeBytes") ?? 0);
  const file = formData.get("file");

  if (!uploadSlug || !objectKey || !(file instanceof File)) {
    return NextResponse.json({ error: "uploadSlug, objectKey, and file are required." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: slot, error } = await supabase
    .from("customer_slots")
    .select("*")
    .eq("upload_slug", uploadSlug)
    .maybeSingle();

  if (error) throw error;

  const customerSlot = slot as CustomerSlot | null;
  if (customerSlot?.is_reseller && customerSlot.reseller_suspended) {
    return NextResponse.json(
      { error: "This reseller account is suspended. Please contact your service provider." },
      { status: 403 }
    );
  }

  if (
    !customerSlot ||
    customerSlot.status !== "ACTIVE" ||
    !customerSlot.storage_prefix ||
    !isWithinActiveWindow(customerSlot.event_start_at)
  ) {
    return NextResponse.json({ error: "This upload link has expired." }, { status: 403 });
  }

  if (!objectKey.startsWith(customerSlot.storage_prefix)) {
    return NextResponse.json({ error: "Upload object key is outside this event." }, { status: 400 });
  }

  if (!isAllowedMimeType(mimeType, customerSlot)) {
    return NextResponse.json({ error: allowedFileMessage(customerSlot) }, { status: 415 });
  }

  if (customerSlot.storage_used_bytes + sizeBytes > customerSlot.storage_limit_bytes) {
    return NextResponse.json({ error: "Storage limit reached for this event." }, { status: 413 });
  }

  await uploadObject(objectKey, Buffer.from(await file.arrayBuffer()), mimeType);

  return NextResponse.json({ ok: true });
}
