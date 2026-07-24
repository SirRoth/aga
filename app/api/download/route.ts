import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getDownloadStream } from "@/lib/gdrive";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { CustomerSlot, Photo } from "@/lib/types";
import { isWithinActiveWindow } from "@/lib/utils";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const photoId = url.searchParams.get("photoId");

  if (!token || !photoId) {
    return NextResponse.json({ error: "token and photoId are required." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: slot } = await supabase
    .from("customer_slots")
    .select("*")
    .eq("download_token", token)
    .maybeSingle();

  const customerSlot = slot as CustomerSlot | null;
  if (!customerSlot || customerSlot.status !== "ACTIVE" || !isWithinActiveWindow(customerSlot.event_start_at)) {
    return NextResponse.json({ error: "Download link expired." }, { status: 403 });
  }

  const { data: photo } = await supabase
    .from("photos")
    .select("*")
    .eq("id", photoId)
    .eq("slot_id", customerSlot.id)
    .maybeSingle();

  if (!photo) return NextResponse.json({ error: "Photo not found." }, { status: 404 });

  const photoRow = photo as Photo;
  const stream = await getDownloadStream(photoRow.gdrive_file_id);
  const webStream = Readable.toWeb(stream) as ReadableStream;

  return new Response(webStream, {
    headers: {
      "content-type": photoRow.mime_type,
      "content-disposition": `inline; filename="${photoRow.file_name.replaceAll('"', "")}"`
    }
  });
}
