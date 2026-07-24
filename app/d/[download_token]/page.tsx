import { notFound } from "next/navigation";
import { GalleryActions } from "@/components/gallery-actions";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { CustomerSlot, Photo } from "@/lib/types";
import { isWithinActiveWindow } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DownloadPage({ params }: { params: { download_token: string } }) {
  const supabase = createSupabaseAdminClient();
  const { data: slot } = await supabase
    .from("customer_slots")
    .select("*")
    .eq("download_token", params.download_token)
    .maybeSingle();

  if (!slot) notFound();

  const customerSlot = slot as CustomerSlot;
  const active =
    customerSlot.status === "ACTIVE" &&
    !customerSlot.reseller_suspended &&
    isWithinActiveWindow(customerSlot.event_start_at);

  const { data: photos } = await supabase
    .from("photos")
    .select("*")
    .eq("slot_id", customerSlot.id)
    .order("uploaded_at", { ascending: false });

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-8">
      <header className="mb-6">
        <p className="text-sm font-medium text-primary">{customerSlot.event_name}</p>
        <h1 className="text-3xl font-semibold tracking-tight">Photo gallery</h1>
      </header>

      {!active ? (
        <p className="rounded-lg border bg-card p-5">
          This event download link has expired. Please contact support if you need access to backups.
        </p>
      ) : (
        <GalleryActions token={params.download_token} photos={(photos ?? []) as Photo[]} />
      )}
    </main>
  );
}
