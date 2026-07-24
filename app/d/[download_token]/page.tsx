import { notFound } from "next/navigation";
import { Download, Heart } from "lucide-react";
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
  const isMessageBox = customerSlot.box_kind === "MESSAGE";

  const { data: photos } = await supabase
    .from("photos")
    .select("*")
    .eq("slot_id", customerSlot.id)
    .order("uploaded_at", { ascending: false });

  return (
    <main className="min-h-screen bg-[#e7d5bd] text-[#2f241d]">
      <section className="min-h-screen bg-[radial-gradient(circle_at_74%_16%,rgba(255,255,255,0.62),transparent_32%),linear-gradient(115deg,#e3c7a4_0%,#f7efe4_42%,#dac09e_100%)] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <header className="mb-8 rounded-[24px] border border-white/70 bg-[#fffaf3]/90 p-6 shadow-2xl shadow-[#7f5a2d]/15 backdrop-blur sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#b17d33]">
                  {customerSlot.event_name}
                </p>
                <h1 className="mt-5 font-serif text-4xl font-semibold leading-tight text-[#2d211a] sm:text-5xl">
                  {isMessageBox ? "Message gallery" : "Photo gallery"}
                </h1>
                <div className="mt-5 h-px w-full max-w-md bg-gradient-to-r from-[#b98537] via-[#dfcaa8] to-transparent" />
                <p className="mt-5 max-w-2xl text-lg leading-8 text-[#4a3b32]">
                  {isMessageBox
                    ? "Download the voice notes, videos, and written messages from your event."
                    : "Download the moments captured at your event. Choose individual memories or collect everything in one zip file."}
                </p>
              </div>
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-[#d8b98e] bg-white/60 text-[#b98537]">
                <Download className="h-8 w-8" />
              </div>
            </div>
          </header>

          {!active ? (
            <div className="rounded-[24px] border border-white/70 bg-[#fffaf3]/90 p-8 text-center shadow-xl shadow-[#7f5a2d]/10">
              <Heart className="mx-auto h-10 w-10 text-[#c18a3b]" strokeWidth={1.6} />
              <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-[#4a3b32]">
                This event download link has expired. Please contact support if you need access to backups.
              </p>
            </div>
          ) : (
            <GalleryActions token={params.download_token} photos={(photos ?? []) as Photo[]} />
          )}
        </div>
      </section>
    </main>
  );
}
