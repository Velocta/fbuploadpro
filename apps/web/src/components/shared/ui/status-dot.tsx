/**
 * StatusDot — built new (shadcn has none). Status presentation is the
 * research pattern (OD-3): colour + icon + text, NEVER colour alone
 * (UI Rule 7 / UX Rule 27). The four statuses mirror the token signal set
 * (operational / queued / critical / idle). `label` overrides the default
 * text; hiding the text is not an option this component offers — the icon
 * and the accessible name always travel with the dot.
 */
import * as React from "react";
import { CheckIcon, CircleIcon, ClockIcon, TriangleAlertIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const STATUS_META = {
  operational: { label: "Operational", Icon: CheckIcon, dotClass: "bg-signal-operational", textClass: "text-signal-operational" },
  queued: { label: "Queued", Icon: ClockIcon, dotClass: "bg-signal-queued", textClass: "text-signal-queued" },
  critical: { label: "Critical", Icon: TriangleAlertIcon, dotClass: "bg-signal-critical", textClass: "text-signal-critical" },
  idle: { label: "Idle", Icon: CircleIcon, dotClass: "bg-signal-idle", textClass: "text-signal-idle" },
} as const;

type Status = keyof typeof STATUS_META;

type StatusDotProps = React.ComponentProps<"span"> & {
  status: Status;
  label?: string;
};

function StatusDot({ status, label, className, ...props }: StatusDotProps) {
  const meta = STATUS_META[status];
  const { Icon } = meta;
  const text = label ?? meta.label;
  return (
    <span
      data-slot="status-dot"
      data-status={status}
      role="status"
      aria-label={text}
      className={cn("inline-flex items-center gap-1.5 text-metadata font-medium", meta.textClass, className)}
      {...props}
    >
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", meta.dotClass)} />
      <Icon aria-hidden className="size-3.5 shrink-0" />
      <span>{text}</span>
    </span>
  );
}

export { StatusDot, STATUS_META };
export type { Status, StatusDotProps };
