import { redirect } from "next/navigation";
import {
  AddCustomerBoxForm,
  AddResellerBoxForm,
  AdminAutoRefresh,
  CloseEventButton,
  DeleteResellerButton,
  ForcePurgeButton,
  ProvisionSlotForm,
  RemoveBoxButton,
  ResellerSetupForm,
  ResellerSuspendButton,
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

type AdminTab = "customers" | "resellers" | "messages" | "message-resellers";

function SlotCard({ slot, mode }: { slot: CustomerSlot; mode: "customer" | "reseller-setup" | "reseller" }) {
  const usedPercent = Math.min((slot.storage_used_bytes / slot.storage_limit_bytes) * 100, 100);

  return (
    <Card key={slot.id}>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>{slot.slot_name}</CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            {slot.reseller_suspended
              ? "Suspended for reseller account"
              : mode === "reseller-setup"
              ? "Available for reseller assignment"
              : slot.event_name ?? (slot.is_reseller ? "No active reseller event" : "No active event")}
          </p>
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
        {mode === "reseller-setup" ? <ResellerSetupForm slot={slot} /> : <ProvisionSlotForm slot={slot} />}
        <SlotLinks slot={slot} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StorageLimitForm slot={slot} />
          <div className="flex flex-wrap gap-2">
            <CloseEventButton slot={slot} />
            <ReopenEventButton slot={slot} />
            {slot.is_reseller ? <ResellerSuspendButton slot={slot} /> : null}
            <ForcePurgeButton slot={slot} />
            {slot.is_reseller ? <DeleteResellerButton slot={slot} /> : null}
            <RemoveBoxButton slot={slot} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function AdminPage({
  searchParams
}: {
  searchParams?: { tab?: string };
}) {
  const { isAdmin, user } = await requireAdmin();
  if (!user) redirect("/login");
  if (!isAdmin) redirect("/login");

  const supabase = createSupabaseAdminClient();
  const { data: slots, error } = await supabase
    .from("customer_slots")
    .select("*")
    .order("slot_name", { ascending: true });

  if (error) throw error;
  const allSlots = slots as CustomerSlot[];
  const activeTab: AdminTab =
    searchParams?.tab === "resellers"
      ? "resellers"
      : searchParams?.tab === "messages"
      ? "messages"
      : searchParams?.tab === "message-resellers"
      ? "message-resellers"
      : "customers";
  const tabBoxKind = activeTab === "messages" || activeTab === "message-resellers" ? "MESSAGE" : "PHOTO";
  const customerSlots = allSlots.filter((slot) => !slot.is_reseller && slot.box_kind === "PHOTO");
  const resellerSlots = allSlots.filter((slot) => slot.is_reseller && slot.box_kind === "PHOTO");
  const resellerAssignableSlots = allSlots.filter(
    (slot) => !slot.is_reseller && slot.box_kind === "PHOTO" && slot.status === "VACANT"
  );
  const messageSlots = allSlots.filter((slot) => !slot.is_reseller && slot.box_kind === "MESSAGE");
  const messageResellerSlots = allSlots.filter((slot) => slot.is_reseller && slot.box_kind === "MESSAGE");
  const messageResellerAssignableSlots = allSlots.filter(
    (slot) => !slot.is_reseller && slot.box_kind === "MESSAGE" && slot.status === "VACANT"
  );
  const visibleSlots =
    activeTab === "customers"
      ? customerSlots.map((slot) => <SlotCard key={slot.id} slot={slot} mode="customer" />)
      : activeTab === "resellers"
      ? [
          ...resellerSlots.map((slot) => <SlotCard key={slot.id} slot={slot} mode="reseller" />),
          ...resellerAssignableSlots.map((slot) => <SlotCard key={slot.id} slot={slot} mode="reseller-setup" />)
        ]
      : activeTab === "messages"
      ? messageSlots.map((slot) => <SlotCard key={slot.id} slot={slot} mode="customer" />)
      : [
          ...messageResellerSlots.map((slot) => <SlotCard key={slot.id} slot={slot} mode="reseller" />),
          ...messageResellerAssignableSlots.map((slot) => (
            <SlotCard key={slot.id} slot={slot} mode="reseller-setup" />
          ))
        ];
  const activeTabTitle =
    activeTab === "resellers"
      ? "Resellers"
      : activeTab === "messages"
      ? "Message boxes"
      : activeTab === "message-resellers"
      ? "Message resellers"
      : "Customer slots";
  const isResellerTab = activeTab === "resellers" || activeTab === "message-resellers";

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-8">
      <AdminAutoRefresh />
      <header className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Photo Box Portal</p>
          <h1 className="text-3xl font-semibold tracking-tight">{activeTabTitle}</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Provision, close, reopen, and manually recycle NFC event deliveries.
        </p>
      </header>

      <nav className="mb-6 flex flex-wrap gap-2">
        {[
          { key: "customers", label: "Customer slots", href: "/admin" },
          { key: "resellers", label: "Resellers", href: "/admin?tab=resellers" },
          { key: "messages", label: "Message boxes", href: "/admin?tab=messages" },
          { key: "message-resellers", label: "Message resellers", href: "/admin?tab=message-resellers" }
        ].map((tab) => (
          <a
            className={`rounded-md border px-4 py-2 text-sm font-medium ${
              activeTab === tab.key ? "bg-primary text-primary-foreground" : "bg-white hover:bg-muted"
            }`}
            href={tab.href}
            key={tab.key}
          >
            {tab.label}
          </a>
        ))}
      </nav>

      <section className="mb-6 rounded-md border bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">
              {isResellerTab
                ? tabBoxKind === "MESSAGE"
                  ? "Add message reseller"
                  : "Add reseller box"
                : tabBoxKind === "MESSAGE"
                ? "Add message box"
                : "Add customer box"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isResellerTab
                ? "Create a reseller box with a stable NFC upload link."
                : "Create another box for direct event provisioning."}
            </p>
          </div>
          <div className="sm:min-w-96">
            {isResellerTab ? <AddResellerBoxForm boxKind={tabBoxKind} /> : <AddCustomerBoxForm boxKind={tabBoxKind} />}
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {visibleSlots}
      </div>
    </main>
  );
}
