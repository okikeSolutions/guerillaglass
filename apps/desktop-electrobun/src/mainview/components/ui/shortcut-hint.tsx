import { Kbd, KbdGroup } from "@/components/ui/kbd";

type ShortcutHintProps = {
  label: string;
  keys?: readonly string[];
};

export function ShortcutHint({ label, keys }: ShortcutHintProps) {
  if (!keys || keys.length === 0) {
    return <span>{label}</span>;
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span>{label}</span>
      <KbdGroup>
        {keys.map((key) => (
          <Kbd key={key}>{key}</Kbd>
        ))}
      </KbdGroup>
    </span>
  );
}
