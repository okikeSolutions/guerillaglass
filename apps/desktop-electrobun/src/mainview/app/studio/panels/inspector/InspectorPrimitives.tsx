import { ChevronRight, Volume2, VolumeX } from "lucide-react";
import type { ReactNode } from "react";
import { captureFrameRates, type CaptureFrameRate } from "@guerillaglass/engine-protocol";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

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

export function InspectorDetailList({ children }: { children: ReactNode }) {
  return <div className="gg-inspector-detail-list gg-numeric">{children}</div>;
}

export function InspectorDetailRow({ value, className }: { value: string; className?: string }) {
  return <div className={cn("gg-inspector-detail-row", className)}>{value}</div>;
}

export function InspectorDetailRows({
  rows,
}: {
  rows: Array<{ value: string; className?: string }>;
}) {
  return (
    <InspectorDetailList>
      {rows.map((row) => (
        <InspectorDetailRow
          key={`${row.className ?? ""}:${row.value}`}
          value={row.value}
          className={row.className}
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
    <Field>
      <FieldLabel className="gg-inspector-toggle-row">
        <Checkbox
          checked={checked}
          onCheckedChange={(nextChecked) => onCheckedChange(nextChecked === true)}
        />
        {icon}
        {label}
      </FieldLabel>
      {description ? (
        <FieldDescription className="px-1.5 pt-0.5">{description}</FieldDescription>
      ) : null}
    </Field>
  );
}

export function InspectorSelectField({
  label,
  value,
  options,
  onValueChange,
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onValueChange: (value: string | null) => void;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
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
  );
}

export function InspectorNumericField({
  label,
  value,
  min,
  step,
  onValueChange,
}: {
  label: string;
  value: number;
  min?: number;
  step?: number;
  onValueChange: (value: number) => void;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
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
  );
}

export function clampDbfsToMeter(audioLevelDbfs: number): number {
  if (!Number.isFinite(audioLevelDbfs)) {
    return 0;
  }
  return Math.min(1, Math.max(0, (audioLevelDbfs + 60) / 60));
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
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="gg-copy-strong">{label}</span>
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
      </div>
      <Progress value={Math.round(level * 100)} />
      <Slider
        className="gg-inspector-slider"
        min={0}
        max={1}
        step={0.05}
        value={[value]}
        onValueChange={(nextValue) => onValueChange(readSliderValue(nextValue))}
      />
    </div>
  );
}
