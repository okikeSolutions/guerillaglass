import { ChevronRight, Volume2, VolumeX } from "lucide-react";
import type { ReactNode } from "react";
import { captureFrameRates, type CaptureFrameRate } from "@guerillaglass/engine-protocol";
import { Button } from "@guerillaglass/ui/components/button";
import { Checkbox } from "@guerillaglass/ui/components/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@guerillaglass/ui/components/collapsible";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@guerillaglass/ui/components/field";
import { Input } from "@guerillaglass/ui/components/input";
import { Progress } from "@guerillaglass/ui/components/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@guerillaglass/ui/components/select";
import { Slider } from "@guerillaglass/ui/components/slider";
import { cn } from "@lib/utils";

export function InspectorSection({
  title,
  children,
  className,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen} className={cn("gg-inspector-section", className)}>
      <CollapsibleTrigger className="gg-inspector-section-trigger">
        <ChevronRight className="gg-inspector-section-chevron" />
        <h3 className="gg-inspector-section-header border-0 pb-0">{title}</h3>
      </CollapsibleTrigger>
      <CollapsibleContent className="gg-inspector-section-content">
        <div className="gg-inspector-section-body">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function InspectorOptionCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("gg-inspector-option-card", className)}>{children}</div>;
}

export function InspectorOptionHeader({
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

export function InspectorDetailList({ children }: { children: ReactNode }) {
  return (
    <InspectorOptionCard>
      <div className="gg-inspector-detail-list gg-numeric">{children}</div>
    </InspectorOptionCard>
  );
}

export function InspectorDetailRow({
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

export function InspectorDetailRows({
  rows,
}: {
  rows: Array<{ label?: string; value: string; className?: string; valueClassName?: string }>;
}) {
  return (
    <InspectorDetailList>
      {rows.map((row) => (
        <InspectorDetailRow
          key={`${row.className ?? ""}:${row.label ?? ""}:${row.value}`}
          label={row.label}
          value={row.value}
          className={row.className}
          valueClassName={row.valueClassName}
        />
      ))}
    </InspectorDetailList>
  );
}

export function InspectorToggleField({
  icon,
  label,
  checked,
  onCheckedChange,
  description,
}: {
  icon?: ReactNode;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  description?: string;
}) {
  return (
    <InspectorOptionCard>
      <Field>
        <FieldLabel className="flex w-full items-center justify-between gap-3 border-0 px-0 py-0">
          <span className="flex min-w-0 items-center gap-2">
            {icon ? <span className="text-muted-foreground">{icon}</span> : null}
            <span className="gg-copy-strong">{label}</span>
          </span>
          <Checkbox
            checked={checked}
            onCheckedChange={(nextChecked) => onCheckedChange(nextChecked === true)}
          />
        </FieldLabel>
        {description ? (
          <FieldDescription className="gg-copy-meta pt-1">{description}</FieldDescription>
        ) : null}
      </Field>
    </InspectorOptionCard>
  );
}

export function InspectorSliderField({
  icon,
  label,
  value,
  displayValue,
  min,
  max,
  step,
  onValueChange,
  className,
}: {
  icon?: ReactNode;
  label: string;
  value: number;
  displayValue?: string;
  min: number;
  max: number;
  step?: number;
  onValueChange: (value: number) => void;
  className?: string;
}) {
  return (
    <InspectorOptionCard className="space-y-3">
      <Field>
        <FieldLabel className="flex w-full items-center justify-between gap-3 border-0 px-0 py-0">
          <span className="flex min-w-0 items-center gap-2">
            {icon ? <span className="text-muted-foreground">{icon}</span> : null}
            <span className="gg-copy-strong">{label}</span>
          </span>
          {displayValue ? <span className="gg-copy-meta gg-numeric">{displayValue}</span> : null}
        </FieldLabel>
        <FieldContent>
          <Slider
            className={className}
            min={min}
            max={max}
            step={step}
            value={[value]}
            onValueChange={(nextValue) => onValueChange(readSliderValue(nextValue))}
          />
        </FieldContent>
      </Field>
    </InspectorOptionCard>
  );
}

export function InspectorSelectField({
  label,
  value,
  options,
  onValueChange,
  description,
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onValueChange: (value: string | null) => void;
  description?: string;
}) {
  return (
    <InspectorOptionCard className="space-y-3">
      <Field>
        <FieldLabel className="border-0 px-0 py-0 gg-copy-strong">{label}</FieldLabel>
        {description ? (
          <FieldDescription className="gg-copy-meta pt-1">{description}</FieldDescription>
        ) : null}
        <FieldContent>
          <Select value={value} onValueChange={onValueChange}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldContent>
      </Field>
    </InspectorOptionCard>
  );
}

export function InspectorNumericField({
  label,
  value,
  min,
  step,
  onValueChange,
  description,
}: {
  label: string;
  value: number;
  min?: number;
  step?: number;
  onValueChange: (value: number) => void;
  description?: string;
}) {
  return (
    <InspectorOptionCard className="space-y-3">
      <Field>
        <FieldLabel className="border-0 px-0 py-0 gg-copy-strong">{label}</FieldLabel>
        {description ? (
          <FieldDescription className="gg-copy-meta pt-1">{description}</FieldDescription>
        ) : null}
        <FieldContent>
          <Input
            type="number"
            min={min}
            step={step}
            value={value}
            onChange={(event) => onValueChange(Number(event.target.value) || 0)}
          />
        </FieldContent>
      </Field>
    </InspectorOptionCard>
  );
}

export function readSliderValue(value: number | readonly number[]): number {
  if (typeof value === "number") {
    return value;
  }
  return value[0] ?? 0;
}

export function parseCaptureFrameRate(value: string | null): CaptureFrameRate | null {
  if (value == null) {
    return null;
  }

  const parsedValue = Number(value);
  for (const frameRate of captureFrameRates) {
    if (frameRate === parsedValue) {
      return frameRate;
    }
  }
  return null;
}

export function AudioMixerChannel({
  label,
  level,
  muted,
  onToggleMuted,
  onValueChange,
  value,
  muteLabel,
  unmuteLabel,
}: {
  label: string;
  level: number;
  muted: boolean;
  value: number;
  muteLabel: string;
  unmuteLabel: string;
  onValueChange: (value: number) => void;
  onToggleMuted: () => void;
}) {
  return (
    <InspectorOptionCard className="space-y-3">
      <InspectorOptionHeader
        title={label}
        trailing={
          <Button
            type="button"
            size="icon-xs"
            variant="outline"
            aria-label={muted ? unmuteLabel : muteLabel}
            title={muted ? unmuteLabel : muteLabel}
            onClick={onToggleMuted}
          >
            {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </Button>
        }
      />
      <Progress value={Math.round(level * 100)} />
      <Slider
        className="gg-inspector-slider"
        min={0}
        max={1}
        step={0.05}
        value={[value]}
        onValueChange={(nextValue) => onValueChange(readSliderValue(nextValue))}
      />
    </InspectorOptionCard>
  );
}
