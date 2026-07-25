import { PassThrough, Readable } from "node:stream";
import archiver from "archiver";
import { NextResponse } from "next/server";
import { getObjectStream } from "@/lib/r2";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { CustomerSlot, Photo } from "@/lib/types";
import { isWithinActiveWindow } from "@/lib/utils";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const selectedPhotoIds = url.searchParams.getAll("photoId");

  if (!token) return NextResponse.json({ error: "token is required." }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const { data: slot } = await supabase
    .from("customer_slots")
    .select("*")
    .eq("download_token", token)
    .maybeSingle();

  const customerSlot = slot as CustomerSlot | null;
  if (
    !customerSlot ||
    customerSlot.status !== "ACTIVE" ||
    customerSlot.reseller_suspended ||
    !isWithinActiveWindow(customerSlot.event_start_at)
  ) {
    return NextResponse.json({ error: "Download link expired." }, { status: 403 });
  }

  let query = supabase.from("photos").select("*").eq("slot_id", customerSlot.id);
  if (selectedPhotoIds.length > 0) query = query.in("id", selectedPhotoIds);
  const { data: photos, error } = await query.order("uploaded_at", { ascending: true });
  if (error) throw error;

  const passThrough = new PassThrough();
  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.pipe(passThrough);

  queueMicrotask(async () => {
    try {
      for (const photo of (photos ?? []) as Photo[]) {
        const object = await getObjectStream(photo.object_key);
        archive.append(object.stream, { name: photo.file_name });
      }
      await archive.finalize();
    } catch (error) {
      archive.destroy(error as Error);
    }
  });

  return new Response(Readable.toWeb(passThrough) as ReadableStream, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${(customerSlot.event_name ?? "photos").replaceAll('"', "")}.zip"`
    }
  });
}
