import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { createEventPrefix } from "@/lib/r2";
import { createSupabaseAdminClient, requireAdmin } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slotId, eventName, allowVideos } = await request.json();
  if (!slotId || !String(eventName ?? "").trim()) {
    return NextResponse.json({ error: "slotId and eventName are required." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: slot, error: slotError } = await supabase
    .from("customer_slots")
    .select("*")
    .eq("id", slotId)
    .eq("status", "VACANT")
    .maybeSingle();

  if (slotError) throw slotError;
  if (!slot) return NextResponse.json({ error: "Vacant slot not found." }, { status: 404 });

  const cleanEventName = String(eventName).trim();
  const uploadSlug = nanoid(14);
  const downloadToken = nanoid(28);
  const storagePrefix = createEventPrefix(slot.id, cleanEventName);

  const { error } = await supabase
    .from("customer_slots")
    .update({
      status: "ACTIVE",
      event_name: cleanEventName,
      upload_slug: uploadSlug,
      download_token: downloadToken,
      storage_prefix: storagePrefix,
      event_start_at: new Date().toISOString(),
      storage_used_bytes: 0,
      allow_videos: Boolean(allowVideos)
    })
    .eq("id", slotId);

  if (error) throw error;

  return NextResponse.json({ uploadSlug, downloadToken });
}
