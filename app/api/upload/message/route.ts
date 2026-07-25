import { NextResponse } from "next/server";
import { createObjectKey, uploadObject } from "@/lib/r2";
import { inferMediaMimeType } from "@/lib/media-files";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { CustomerSlot } from "@/lib/types";
import { isWithinActiveWindow } from "@/lib/utils";

export const runtime = "nodejs";

function isAllowedMessageMimeType(mimeType: string) {
  return (
    mimeType.startsWith("audio/") ||
    mimeType.startsWith("video/") ||
    mimeType === "application/msword" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const uploadSlug = String(formData.get("uploadSlug") ?? "");
  const file = formData.get("file");

  if (!uploadSlug || !(file instanceof File)) {
    return NextResponse.json({ error: "uploadSlug and file are required." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: slot, error: slotError } = await supabase
    .from("customer_slots")
    .select("*")
    .eq("upload_slug", uploadSlug)
    .maybeSingle();

  if (slotError) throw slotError;

  const customerSlot = slot as CustomerSlot | null;
  if (customerSlot?.is_reseller && customerSlot.reseller_suspended) {
    return NextResponse.json(
      { error: "This reseller account is suspended. Please contact your service provider." },
      { status: 403 }
    );
  }

  if (
    !customerSlot ||
    customerSlot.box_kind !== "MESSAGE" ||
    customerSlot.status !== "ACTIVE" ||
    !customerSlot.storage_prefix ||
    !isWithinActiveWindow(customerSlot.event_start_at)
  ) {
    return NextResponse.json({ error: "This message upload link has expired." }, { status: 403 });
  }

  if (customerSlot.storage_used_bytes + file.size > customerSlot.storage_limit_bytes) {
    return NextResponse.json({ error: "Storage limit reached for this event." }, { status: 413 });
  }

  const fileName = file.name || "guest-message";
  const objectKey = createObjectKey(customerSlot.storage_prefix, fileName);
  const mimeType = inferMediaMimeType(fileName, objectKey, file.type || "application/octet-stream");

  if (!isAllowedMessageMimeType(mimeType)) {
    return NextResponse.json({ error: "Only voice notes, videos, and text documents are allowed." }, { status: 415 });
  }

  await uploadObject(objectKey, Buffer.from(await file.arrayBuffer()), mimeType);

  const { error: photoError } = await supabase.from("photos").insert({
    slot_id: customerSlot.id,
    object_key: objectKey,
    file_name: fileName,
    mime_type: mimeType,
    file_size_bytes: file.size
  });

  if (photoError) throw photoError;

  const storageUsedBytes = customerSlot.storage_used_bytes + file.size;
  const { error: updateError } = await supabase
    .from("customer_slots")
    .update({ storage_used_bytes: storageUsedBytes })
    .eq("id", customerSlot.id);

  if (updateError) throw updateError;

  return NextResponse.json({
    uploaded: 1,
    storageUsedBytes,
    storageLimitBytes: customerSlot.storage_limit_bytes
  });
}
