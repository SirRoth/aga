import { notFound, redirect } from "next/navigation";
import { Camera, Heart, MessageSquareHeart } from "lucide-react";
import { MessageUploadForm } from "@/components/message-upload-form";
import { UploadForm } from "@/components/upload-form";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { CustomerSlot } from "@/lib/types";
import { isWithinActiveWindow } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function UploadPage({ params }: { params: { upload_slug: string } }) {
  const supabase = createSupabaseAdminClient();
  const { data: slot } = await supabase
    .from("customer_slots")
    .select("*")
    .eq("upload_slug", params.upload_slug)
    .maybeSingle();

  if (!slot) notFound();

  const customerSlot = slot as CustomerSlot;
  const suspended = customerSlot.is_reseller && customerSlot.reseller_suspended;
  if (suspended) redirect("/account-suspended");

  const active =
    customerSlot.status === "ACTIVE" &&
    !suspended &&
    isWithinActiveWindow(customerSlot.event_start_at);
  const hasCapacity = customerSlot.storage_used_bytes < customerSlot.storage_limit_bytes;
  const isMessageBox = customerSlot.box_kind === "MESSAGE";

  return (
    <main className="min-h-screen bg-[#e7d5bd] text-[#2f241d]">
      <section className="grid min-h-screen gap-8 bg-[radial-gradient(circle_at_74%_16%,rgba(255,255,255,0.62),transparent_32%),linear-gradient(115deg,#e3c7a4_0%,#f7efe4_42%,#dac09e_100%)] p-4 sm:p-6 lg:grid-cols-[minmax(0,640px)_1fr] lg:p-8">
        <div className="flex items-center">
          <div className="w-full rounded-[24px] border border-white/70 bg-[#fffaf3]/90 p-6 shadow-2xl shadow-[#7f5a2d]/15 backdrop-blur sm:p-8 lg:p-10">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#b17d33]">
              {customerSlot.event_name}
            </p>
            <h1 className="mt-7 font-serif text-4xl font-semibold leading-tight text-[#2d211a] sm:text-5xl">
              Upload here!
            </h1>
            <div className="mt-5 h-px w-full bg-gradient-to-r from-[#b98537] via-[#dfcaa8] to-transparent" />

            <div className="my-8 grid grid-cols-[56px_1fr] gap-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-[#b98537] text-[#b98537]">
                {isMessageBox ? <MessageSquareHeart className="h-7 w-7" /> : <Camera className="h-7 w-7" />}
              </div>
              <p className="text-lg leading-8 text-[#352b25]">
                {isMessageBox
                  ? "Leave a voice note, record a video, or write a message for the event host."
                  : "We'd love to see the memories you captured. Upload your photos and videos from the event and help us relive the moments together."}
              </p>
            </div>

            {active && hasCapacity ? (
              isMessageBox ? (
                <MessageUploadForm
                  uploadSlug={params.upload_slug}
                  eventName={customerSlot.event_name}
                  storageLimitBytes={customerSlot.storage_limit_bytes}
                  storageUsedBytes={customerSlot.storage_used_bytes}
                />
              ) : (
                <UploadForm
                  uploadSlug={params.upload_slug}
                  allowVideos={customerSlot.allow_videos}
                  storageLimitBytes={customerSlot.storage_limit_bytes}
                  storageUsedBytes={customerSlot.storage_used_bytes}
                />
              )
            ) : (
              <p className="rounded-lg border border-[#ead9c2] bg-white/70 p-4 text-sm">
                This upload link is no longer accepting submissions. Please contact the event host.
              </p>
            )}

            <div className="mt-10 text-center">
              <Heart className="mx-auto h-10 w-10 text-[#c18a3b]" strokeWidth={1.6} />
              <h2 className="mt-4 font-serif text-4xl font-semibold">Thank you!</h2>
              <div className="mx-auto mt-3 h-px w-24 bg-gradient-to-r from-transparent via-[#c18a3b] to-transparent" />
              <p className="mx-auto mt-5 max-w-md text-base leading-7 text-[#4a3b32]">
                Thank you for being part of this special occasion and for sharing your memories with us.
              </p>
            </div>
          </div>
        </div>

        <aside className="hidden items-center justify-center lg:flex">
          <div className="max-w-md text-center">
            <Heart className="mx-auto h-20 w-20 text-[#b98537]" strokeWidth={1.4} />
            <h2 className="mt-6 font-serif text-5xl font-semibold leading-tight text-[#2d211a]">
              Your moments
              <br />
              matter
            </h2>
            <div className="mx-auto mt-7 flex w-40 items-center justify-center gap-3 text-[#c18a3b]">
              <span className="h-px flex-1 bg-current" />
              <span className="h-2 w-2 rounded-full bg-current" />
              <span className="h-px flex-1 bg-current" />
            </div>
            <p className="mx-auto mt-7 max-w-sm text-xl leading-9 text-[#3f3028]">
              Every smile, every laugh, every moment captured becomes a memory we&apos;ll treasure forever.
            </p>
            <div className="mt-12 rounded-full border border-white/60 bg-white/30 px-6 py-3 text-sm font-medium text-[#8d632b] backdrop-blur">
              {isMessageBox ? "Secure event message drop" : "Secure event photo drop"}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
