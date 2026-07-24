import { NextResponse } from "next/server";
import { assertObjectExists, createObjectKey, createPresignedUploadUrl } from "@/lib/r2";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { CustomerSlot } from "@/lib/types";
import { isWithinActiveWindow } from "@/lib/utils";

export const runtime = "nodejs";

type UploadFileRequest = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

async function getActiveSlot(uploadSlug: string) {
  const supabase = createSupabaseAdminClient();
  const { data: slot, error } = await supabase
    .from("customer_slots")
    .select("*")
    .eq("upload_slug", uploadSlug)
    .maybeSingle();

  if (error) throw error;
  if (!slot) return { supabase, slot: null };

  const customerSlot = slot as CustomerSlot;
  const active =
    customerSlot.status === "ACTIVE" &&
    Boolean(customerSlot.storage_prefix) &&
    isWithinActiveWindow(customerSlot.event_start_at);

  return { supabase, slot: active ? customerSlot : null };
}

export async function POST(request: Request) {
  const { uploadSlug, files } = (await request.json()) as {
    uploadSlug?: string;
    files?: UploadFileRequest[];
  };

  if (!uploadSlug || !files?.length) {
    return NextResponse.json({ error: "uploadSlug and files are required." }, { status: 400 });
  }

  const { slot } = await getActiveSlot(uploadSlug);
  if (!slot?.storage_prefix) {
    return NextResponse.json({ error: "This upload link has expired." }, { status: 403 });
  }

  const totalBytes = files.reduce((sum, file) => sum + Number(file.sizeBytes ?? 0), 0);
  if (!Number.isFinite(totalBytes) || totalBytes <= 0) {
    return NextResponse.json({ error: "File sizes are invalid." }, { status: 400 });
  }

  if (slot.storage_used_bytes + totalBytes > slot.storage_limit_bytes) {
    return NextResponse.json({ error: "Storage limit reached for this event." }, { status: 413 });
  }

  const uploads = await Promise.all(
    files.map(async (file) => {
      const objectKey = createObjectKey(slot.storage_prefix!, file.fileName);
      const mimeType = file.mimeType || "application/octet-stream";
      return {
        objectKey,
        fileName: file.fileName,
        mimeType,
        sizeBytes: file.sizeBytes,
        uploadUrl: await createPresignedUploadUrl(objectKey, mimeType, file.sizeBytes)
      };
    })
  );

  return NextResponse.json({ uploads });
}

export async function PUT(request: Request) {
  const { uploadSlug, uploads } = (await request.json()) as {
    uploadSlug?: string;
    uploads?: Array<{
      objectKey: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
    }>;
  };

  if (!uploadSlug || !uploads?.length) {
    return NextResponse.json({ error: "uploadSlug and uploads are required." }, { status: 400 });
  }

  const { supabase, slot } = await getActiveSlot(uploadSlug);
  if (!slot?.storage_prefix) {
    return NextResponse.json({ error: "This upload link has expired." }, { status: 403 });
  }

  const totalBytes = uploads.reduce((sum, upload) => sum + Number(upload.sizeBytes ?? 0), 0);
  if (slot.storage_used_bytes + totalBytes > slot.storage_limit_bytes) {
    return NextResponse.json({ error: "Storage limit reached for this event." }, { status: 413 });
  }

  for (const upload of uploads) {
    if (!upload.objectKey.startsWith(slot.storage_prefix)) {
      return NextResponse.json({ error: "Upload object key is outside this event." }, { status: 400 });
    }

    await assertObjectExists(upload.objectKey);
  }

  const { error: photoError } = await supabase.from("photos").insert(
    uploads.map((upload) => ({
      slot_id: slot.id,
      object_key: upload.objectKey,
      file_name: upload.fileName,
      mime_type: upload.mimeType || "application/octet-stream",
      file_size_bytes: upload.sizeBytes
    }))
  );

  if (photoError) throw photoError;

  const { error: updateError } = await supabase
    .from("customer_slots")
    .update({ storage_used_bytes: slot.storage_used_bytes + totalBytes })
    .eq("id", slot.id);

  if (updateError) throw updateError;

  return NextResponse.json({ uploaded: uploads.length });
}
