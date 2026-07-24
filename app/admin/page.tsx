import { redirect } from "next/navigation";
import {
  CloseEventButton,
  ForcePurgeButton,
  ProvisionSlotForm,
  ReopenEventButton,
  SlotLinks,
  StorageLimitForm
} from "@/components/admin-actions";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseAdminClient, requireAdmin } from "@/lib/supabase/server";
import type { CustomerSlot } from "@/lib/types";
import { bytesToHuman } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { isAdmin, user } = await requireAdmin();
  if (!user) redirect("/login");
  if (!isAdmin) redirect("/login");

  const supabase = createSupabaseAdminClient();
  const { data: slots, error } = await supabase
    .from("customer_slots")
    .select("*")
    .order("slot_name", { ascending: true });

  if (error) throw error;

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-8">
      <header className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Photo Box Portal</p>
          <h1 className="text-3xl font-semibold tracking-tight">Customer slots</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Provision, close, reopen, and manually recycle NFC event deliveries.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        {(slots as CustomerSlot[]).map((slot) => {
          const usedPercent = Math.min((slot.storage_used_bytes / slot.storage_limit_bytes) * 100, 100);
          return (
            <Card key={slot.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle>{slot.slot_name}</CardTitle>
                  <p className="mt-2 text-sm text-muted-foreground">{slot.event_name ?? "No active event"}</p>
                </div>
                <StatusBadge status={slot.status} />
              </CardHeader>
              <CardContent className="grid gap-5">
                <div>
                  <div className="mb-2 flex justify-between text-sm">
                    <span>{bytesToHuman(slot.storage_used_bytes)} used</span>
                    <span>{bytesToHuman(slot.storage_limit_bytes)} limit</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${usedPercent}%` }} />
                  </div>
                </div>
                <ProvisionSlotForm slot={slot} />
                <SlotLinks slot={slot} />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <StorageLimitForm slot={slot} />
                  <div className="flex flex-wrap gap-2">
                    <CloseEventButton slot={slot} />
                    <ReopenEventButton slot={slot} />
                    <ForcePurgeButton slot={slot} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </main>
  );
}
