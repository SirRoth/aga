import { notFound } from "next/navigation";
import { UploadForm } from "@/components/upload-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { CustomerSlot } from "@/lib/types";
import { bytesToHuman, isWithinActiveWindow } from "@/lib/utils";

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
  const active = customerSlot.status === "ACTIVE" && isWithinActiveWindow(customerSlot.event_start_at);
  const hasCapacity = customerSlot.storage_used_bytes < customerSlot.storage_limit_bytes;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <p className="text-sm font-medium text-primary">{customerSlot.event_name}</p>
          <CardTitle>Upload event photos</CardTitle>
        </CardHeader>
        <CardContent>
          {active && hasCapacity ? (
            <UploadForm uploadSlug={params.upload_slug} />
          ) : (
            <p className="rounded-md bg-muted p-4 text-sm">
              This upload link is no longer accepting photos. Please contact the event host.
            </p>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            {bytesToHuman(customerSlot.storage_used_bytes)} of {bytesToHuman(customerSlot.storage_limit_bytes)} used.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
