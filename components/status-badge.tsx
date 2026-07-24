import { cn } from "@/lib/utils";
import type { SlotStatus } from "@/lib/types";

const styles: Record<SlotStatus, string> = {
  VACANT: "bg-muted text-muted-foreground",
  ACTIVE: "bg-emerald-100 text-emerald-800",
  EXPIRED_GRACE: "bg-amber-100 text-amber-900"
};

export function StatusBadge({ status }: { status: SlotStatus }) {
  return (
    <span className={cn("inline-flex rounded px-2 py-1 text-xs font-semibold", styles[status])}>
      {status.replace("_", " ")}
    </span>
  );
}
