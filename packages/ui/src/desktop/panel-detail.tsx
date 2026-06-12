import type { ReactNode } from "react";

import { Card } from "../components/card";
import { cn } from "../lib/utils";

function DesktopPanelCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Card size="sm" className={cn("gg-inspector-option-card py-3 shadow-none", className)}>
      {children}
    </Card>
  );
}

function DesktopPanelCardHeader({
  icon,
  title,
  description,
  trailing,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          {icon ? <span className="text-muted-foreground">{icon}</span> : null}
          <span className="gg-copy-strong">{title}</span>
        </div>
        {description ? <p className="gg-copy-meta">{description}</p> : null}
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}

function DesktopPanelDetailList({ children }: { children: ReactNode }) {
  return (
    <DesktopPanelCard>
      <div className="gg-inspector-detail-list gg-numeric">{children}</div>
    </DesktopPanelCard>
  );
}

function DesktopPanelDetailRow({
  label,
  value,
  className,
  valueClassName,
}: {
  label?: string;
  value: string;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className={cn("gg-inspector-detail-row", className)}>
      {label ? <span className="gg-copy-meta">{label}</span> : null}
      <span
        className={cn(label ? "gg-copy-strong text-right" : "text-foreground/90", valueClassName)}
      >
        {value}
      </span>
    </div>
  );
}

function DesktopPanelDetailRows({
  rows,
}: {
  rows: Array<{ label?: string; value: string; className?: string; valueClassName?: string }>;
}) {
  return (
    <DesktopPanelDetailList>
      {rows.map((row) => (
        <DesktopPanelDetailRow
          key={`${row.className ?? ""}:${row.label ?? ""}:${row.value}`}
          label={row.label}
          value={row.value}
          className={row.className}
          valueClassName={row.valueClassName}
        />
      ))}
    </DesktopPanelDetailList>
  );
}

export {
  DesktopPanelCard,
  DesktopPanelCardHeader,
  DesktopPanelDetailList,
  DesktopPanelDetailRow,
  DesktopPanelDetailRows,
};
