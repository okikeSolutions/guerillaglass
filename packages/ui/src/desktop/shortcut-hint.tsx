import { Kbd, KbdGroup } from "@guerillaglass/ui/components/kbd";

type ShortcutHintProps = {
  label: string;
  keys?: readonly string[];
};

/**
 * Renders an action label with an optional keyboard shortcut hint.
 *
 * When no shortcut is available, the component falls back to the plain label so menus,
 * buttons, and inspector rows can share a single rendering path.
 */
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
