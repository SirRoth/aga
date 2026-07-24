"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, CheckCircle2, Copy, HardDrive, RefreshCcw, Rocket, ShieldOff, Undo2, Video } from "lucide-react";
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
          disabled={slot.status !== "VACANT"}
        />
        <Button onClick={submit} disabled={slot.status !== "VACANT" || pending || !eventName.trim()}>
          <Rocket className="h-4 w-4" />
          Provision
        </Button>
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
        <input
          checked={allowVideos}
          className="peer sr-only"
          disabled={slot.status !== "VACANT"}
          onChange={(event) => setAllowVideos(event.target.checked)}
          type="checkbox"
        />
        <span className="flex h-5 w-5 items-center justify-center rounded-full border border-input bg-white text-transparent peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-disabled:opacity-50">
          <CheckCircle2 className="h-4 w-4" />
        </span>
        Allow video uploads
      </label>
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
