import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { uploadFileToFolder } from "@/lib/gdrive";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { CustomerSlot } from "@/lib/types";
import { isWithinActiveWindow } from "@/lib/utils";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const uploadSlug = String(formData.get("uploadSlug") ?? "");
  const files = formData.getAll("files").filter((value): value is File => value instanceof File);

  if (!uploadSlug || files.length === 0) {
    return NextResponse.json({ error: "Upload slug and at least one file are required." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: slot, error } = await supabase
    .from("customer_slots")
    .select("*")
    .eq("upload_slug", uploadSlug)
    .maybeSingle();

  if (error) throw error;
  if (!slot) return NextResponse.json({ error: "Upload slot not found." }, { status: 404 });

  const customerSlot = slot as CustomerSlot;
  if (
    customerSlot.status !== "ACTIVE" ||
    !customerSlot.gdrive_folder_id ||
    !isWithinActiveWindow(customerSlot.event_start_at)
  ) {
    return NextResponse.json({ error: "This upload link has expired." }, { status: 403 });
  }

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (customerSlot.storage_used_bytes + totalBytes > customerSlot.storage_limit_bytes) {
    return NextResponse.json({ error: "Storage limit reached for this event." }, { status: 413 });
  }

  const uploaded = [];
  for (const file of files) {
    const stream = Readable.from(Buffer.from(await file.arrayBuffer()));
    const driveFile = await uploadFileToFolder(
      customerSlot.gdrive_folder_id,
      stream,
      file.name,
      file.type || "application/octet-stream"
    );

    uploaded.push({
      slot_id: customerSlot.id,
      gdrive_file_id: driveFile.id,
      file_name: file.name,
      mime_type: file.type || "application/octet-stream",
      file_size_bytes: file.size
    });
  }

  const { error: photoError } = await supabase.from("photos").insert(uploaded);
  if (photoError) throw photoError;

  const { error: updateError } = await supabase
    .from("customer_slots")
    .update({ storage_used_bytes: customerSlot.storage_used_bytes + totalBytes })
    .eq("id", customerSlot.id);

  if (updateError) throw updateError;

  return NextResponse.json({ uploaded: uploaded.length });
}
