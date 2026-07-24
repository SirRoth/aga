"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  Building2,
  CheckCircle2,
  Copy,
  HardDrive,
  Plus,
  RefreshCcw,
  Rocket,
  ShieldCheck,
  ShieldOff,
  Trash2,
  Undo2,
  Video
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CustomerSlot } from "@/lib/types";

function absoluteUrl(path: string) {
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

function isEditingFormField() {
  const element = document.activeElement;
  if (!element) return false;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName);
}

export function AdminAutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible" && !isEditingFormField()) router.refresh();
    };

    const interval = window.setInterval(refresh, 5000);
    window.addEventListener("focus", refresh);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [router]);

  return null;
}

export function ProvisionSlotForm({ slot }: { slot: CustomerSlot }) {
  const [eventName, setEventName] = useState("");
  const [allowVideos, setAllowVideos] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      await fetch("/api/admin/slots/provision", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slotId: slot.id, eventName, allowVideos })
      });
      window.location.reload();
    });
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={eventName}
          onChange={(event) => setEventName(event.target.value)}
          placeholder="Event name"
          disabled={slot.status !== "VACANT" || slot.reseller_suspended}
        />
        <Button
          onClick={submit}
          disabled={slot.status !== "VACANT" || slot.reseller_suspended || pending || !eventName.trim()}
        >
          <Rocket className="h-4 w-4" />
          Provision
        </Button>
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
        <input
          checked={allowVideos}
          className="peer sr-only"
          disabled={slot.status !== "VACANT" || slot.reseller_suspended}
          onChange={(event) => setAllowVideos(event.target.checked)}
          type="checkbox"
        />
        <span className="flex h-5 w-5 items-center justify-center rounded-full border border-input bg-white text-transparent peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-disabled:opacity-50">
          <CheckCircle2 className="h-4 w-4" />
        </span>
        Allow video uploads
      </label>
      {slot.reseller_suspended ? (
        <p className="text-xs text-destructive">This reseller is suspended. Unsuspend before provisioning.</p>
      ) : null}
    </div>
  );
}

export function AddCustomerBoxForm() {
  const [slotName, setSlotName] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const response = await fetch("/api/admin/slots/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slotName })
      });
      if (response.ok) {
        setSlotName("");
        window.location.reload();
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Input value={slotName} onChange={(event) => setSlotName(event.target.value)} placeholder="Box name" />
      <Button onClick={submit} disabled={pending || !slotName.trim()}>
        <Plus className="h-4 w-4" />
        Add customer box
      </Button>
    </div>
  );
}

export function AddResellerBoxForm() {
  const [companyName, setCompanyName] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const response = await fetch("/api/admin/slots/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isReseller: true, resellerCompanyName: companyName })
      });
      if (response.ok) {
        setCompanyName("");
        window.location.reload();
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Input
        value={companyName}
        onChange={(event) => setCompanyName(event.target.value)}
        placeholder="Reseller company name"
      />
      <Button onClick={submit} disabled={pending || !companyName.trim()}>
        <Plus className="h-4 w-4" />
        Add reseller box
      </Button>
    </div>
  );
}

export function ResellerSetupForm({ slot }: { slot: CustomerSlot }) {
  const [companyName, setCompanyName] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      await fetch("/api/admin/slots/reseller", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slotId: slot.id, companyName })
      });
      window.location.reload();
    });
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Input
        value={companyName}
        onChange={(event) => setCompanyName(event.target.value)}
        placeholder="Reseller company name"
        disabled={slot.status !== "VACANT"}
      />
      <Button onClick={submit} disabled={slot.status !== "VACANT" || pending || !companyName.trim()}>
        <Building2 className="h-4 w-4" />
        Create reseller box
      </Button>
    </div>
  );
}

export function RemoveBoxButton({ slot }: { slot: CustomerSlot }) {
  const [pending, startTransition] = useTransition();
  const canRemove = slot.status === "VACANT" && !slot.storage_prefix && slot.storage_used_bytes === 0;

  function removeBox() {
    if (!window.confirm(`Remove ${slot.slot_name} from the admin portal?`)) return;

    startTransition(async () => {
      const response = await fetch("/api/admin/slots/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slotId: slot.id })
      });

      if (response.ok) {
        window.location.reload();
        return;
      }

      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      window.alert(data?.error ?? "Could not remove this box.");
    });
  }

  return (
    <Button
      variant="outline"
      onClick={removeBox}
      disabled={!canRemove || pending}
      title={canRemove ? "Remove box" : "Recycle this box before removing it"}
    >
      <Trash2 className="h-4 w-4" />
      Remove box
    </Button>
  );
}

export function StorageLimitForm({ slot }: { slot: CustomerSlot }) {
  const [gb, setGb] = useState((slot.storage_limit_bytes / 1024 ** 3).toString());
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      await fetch("/api/admin/slots/limit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slotId: slot.id, storageLimitBytes: Math.round(Number(gb) * 1024 ** 3) })
      });
      window.location.reload();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        className="max-w-24"
        min="0.1"
        step="0.1"
        type="number"
        value={gb}
        onChange={(event) => setGb(event.target.value)}
        aria-label="Storage limit in GB"
      />
      <Button variant="outline" onClick={submit} disabled={pending || Number(gb) <= 0}>
        <HardDrive className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function ForcePurgeButton({ slot }: { slot: CustomerSlot }) {
  const [pending, startTransition] = useTransition();

  function purge() {
    if (!window.confirm(`Permanently purge and recycle ${slot.slot_name}?`)) return;
    startTransition(async () => {
      await fetch("/api/admin/slots/purge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slotId: slot.id })
      });
      window.location.reload();
    });
  }

  return (
    <Button variant="destructive" onClick={purge} disabled={slot.status === "VACANT" || pending}>
      <RefreshCcw className="h-4 w-4" />
      Recycle
    </Button>
  );
}

export function ResellerSuspendButton({ slot }: { slot: CustomerSlot }) {
  const [pending, startTransition] = useTransition();
  if (!slot.is_reseller) return null;

  const nextSuspended = !slot.reseller_suspended;

  function toggleSuspension() {
    const action = nextSuspended ? "Suspend" : "Unsuspend";
    if (!window.confirm(`${action} ${slot.reseller_company_name ?? slot.slot_name}?`)) return;

    startTransition(async () => {
      await fetch("/api/admin/slots/reseller/suspend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slotId: slot.id, suspended: nextSuspended })
      });
      window.location.reload();
    });
  }

  return (
    <Button variant="outline" onClick={toggleSuspension} disabled={pending}>
      {slot.reseller_suspended ? <ShieldCheck className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
      {slot.reseller_suspended ? "Unsuspend" : "Suspend"}
    </Button>
  );
}

export function DeleteResellerButton({ slot }: { slot: CustomerSlot }) {
  const [pending, startTransition] = useTransition();
  if (!slot.is_reseller) return null;

  function deleteReseller() {
    if (
      !window.confirm(
        `Delete reseller ${slot.reseller_company_name ?? slot.slot_name}? This purges the current event and frees the box for another reseller.`
      )
    ) {
      return;
    }

    startTransition(async () => {
      await fetch("/api/admin/slots/reseller/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slotId: slot.id })
      });
      window.location.reload();
    });
  }

  return (
    <Button variant="destructive" onClick={deleteReseller} disabled={pending}>
      <Trash2 className="h-4 w-4" />
      Delete reseller
    </Button>
  );
}

export function CloseEventButton({ slot }: { slot: CustomerSlot }) {
  const [pending, startTransition] = useTransition();

  function closeEvent() {
    if (!window.confirm(`Close ${slot.slot_name}? Uploads and downloads will stop, but files stay in R2.`)) return;
    startTransition(async () => {
      await fetch("/api/admin/slots/expire", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slotId: slot.id })
      });
      window.location.reload();
    });
  }

  return (
    <Button variant="outline" onClick={closeEvent} disabled={slot.status !== "ACTIVE" || pending}>
      <ShieldOff className="h-4 w-4" />
      Close
    </Button>
  );
}

export function ReopenEventButton({ slot }: { slot: CustomerSlot }) {
  const [pending, startTransition] = useTransition();

  function reopenEvent() {
    startTransition(async () => {
      await fetch("/api/admin/slots/restore", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slotId: slot.id })
      });
      window.location.reload();
    });
  }

  return (
    <Button variant="outline" onClick={reopenEvent} disabled={slot.status !== "EXPIRED_GRACE" || pending}>
      <Undo2 className="h-4 w-4" />
      Reopen
    </Button>
  );
}

export function SlotLinks({ slot }: { slot: CustomerSlot }) {
  if (!slot.upload_slug && !slot.download_token) {
    return <span className="text-sm text-muted-foreground">Links appear after provisioning.</span>;
  }

  const links = [
    slot.upload_slug ? { label: "NFC", href: `/u/${slot.upload_slug}` } : null,
    slot.download_token ? { label: "Download", href: `/d/${slot.download_token}` } : null
  ].filter(Boolean) as { label: string; href: string }[];

  return (
    <div className="grid gap-2 text-sm">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Video className="h-4 w-4" />
        {slot.allow_videos ? "Photos and videos enabled" : "Photos only"}
      </div>
      {slot.is_reseller && slot.reseller_suspended ? (
        <div className="flex items-center gap-2 text-xs font-medium text-destructive">
          <Ban className="h-4 w-4" />
          Reseller suspended
        </div>
      ) : null}
      {links.map((link) => (
        <button
          className="flex min-w-0 items-center justify-between rounded-md border bg-white px-3 py-2 text-left"
          key={link.href}
          onClick={() => navigator.clipboard.writeText(absoluteUrl(link.href))}
          title={`Copy ${link.label} link`}
          type="button"
        >
          <span className="truncate">
            <strong>{link.label}</strong> {link.href}
          </span>
          <Copy className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      ))}
    </div>
  );
}
