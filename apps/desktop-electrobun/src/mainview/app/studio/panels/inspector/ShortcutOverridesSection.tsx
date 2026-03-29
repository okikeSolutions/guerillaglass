import { Keyboard, RotateCcw } from "lucide-react";
import { useHotkeyRecorder } from "@tanstack/react-hotkeys";
import { useState } from "react";
import { Badge } from "@guerillaglass/ui/components/badge";
import { Button } from "@guerillaglass/ui/components/button";
import { Kbd, KbdGroup } from "@guerillaglass/ui/components/kbd";
import { cn } from "@lib/utils";
import {
  resolveStudioShortcutHotkey,
  studioHotkeyDisplayTokens,
  studioShortcutDisplayTokens,
  studioShortcutIds,
  type StudioShortcutId,
} from "@shared/shortcuts";
import { useStudio } from "../../state/StudioProvider";

function shortcutLabelFor(
  shortcutId: StudioShortcutId,
  studio: ReturnType<typeof useStudio>,
): string {
  switch (shortcutId) {
    case "playPause":
      return studio.ui.actions.playPause;
    case "record":
      return studio.ui.actions.startRecording;
    case "trimIn":
      return studio.ui.actions.setTrimIn;
    case "trimOut":
      return studio.ui.actions.setTrimOut;
    case "save":
      return studio.ui.actions.saveProject;
    case "saveAs":
      return studio.ui.actions.saveProjectAs;
    case "export":
      return studio.ui.actions.exportNow;
    case "timelineBlade":
      return studio.ui.actions.timelineToolBlade;
  }
}

function ShortcutTokenGroup({ tokens }: { tokens: readonly string[] }) {
  return (
    <KbdGroup>
      {tokens.map((token) => (
        <Kbd key={token}>{token}</Kbd>
      ))}
    </KbdGroup>
  );
}

function ShortcutOverrideRow({ shortcutId }: { shortcutId: StudioShortcutId }) {
  const studio = useStudio();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const label = shortcutLabelFor(shortcutId, studio);
  const isCustomized = Boolean(studio.shortcutOverrides[shortcutId]);
  const defaultTokens = studioShortcutDisplayTokens(shortcutId, {
    platform: studio.shortcutPlatform,
    spaceKeyLabel: studio.ui.shortcuts.playPause,
  });

  const recorder = useHotkeyRecorder({
    onRecord: (hotkey) => {
      const result = studio.applyShortcutOverride(shortcutId, hotkey);
      if (!result.ok) {
        if (result.reason === "conflict" && result.conflictingShortcutId) {
          setErrorMessage(
            studio.ui.helper.shortcutConflict(
              shortcutLabelFor(result.conflictingShortcutId, studio),
            ),
          );
          return;
        }
        setErrorMessage(studio.ui.helper.shortcutInvalid(result.message));
        return;
      }
      setErrorMessage(null);
    },
    onCancel: () => {
      setErrorMessage(null);
    },
  });

  const activeHotkey = resolveStudioShortcutHotkey(shortcutId, {
    platform: studio.shortcutPlatform,
    overrides: studio.shortcutOverrides,
  });
  const activeTokens = recorder.recordedHotkey
    ? studioHotkeyDisplayTokens(recorder.recordedHotkey, {
        platform: studio.shortcutPlatform,
        spaceKeyLabel: studio.ui.shortcuts.playPause,
      })
    : studioHotkeyDisplayTokens(activeHotkey, {
        platform: studio.shortcutPlatform,
        spaceKeyLabel: studio.ui.shortcuts.playPause,
      });

  return (
    <div className="space-y-2 rounded-md border border-border/70 bg-background/35 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <Keyboard className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="gg-copy-strong">{label}</span>
          </div>
          <p className="gg-copy-meta">
            {isCustomized
              ? studio.ui.helper.shortcutCustomized(defaultTokens.join("+"))
              : studio.ui.helper.shortcutDefault(defaultTokens.join("+"))}
          </p>
        </div>
        <Badge variant="outline">
          {recorder.isRecording
            ? studio.ui.labels.shortcutRecording
            : isCustomized
              ? studio.ui.labels.shortcutCustom
              : studio.ui.labels.shortcutDefault}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ShortcutTokenGroup tokens={activeTokens} />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={recorder.isRecording ? "secondary" : "outline"}
            onClick={() => {
              setErrorMessage(null);
              if (recorder.isRecording) {
                recorder.cancelRecording();
                return;
              }
              recorder.startRecording();
            }}
          >
            {recorder.isRecording
              ? studio.ui.actions.cancelShortcutRecording
              : studio.ui.actions.recordShortcut}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={!isCustomized}
            onClick={() => {
              setErrorMessage(null);
              recorder.cancelRecording();
              studio.resetShortcutOverride(shortcutId);
            }}
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            {studio.ui.actions.resetShortcut}
          </Button>
        </div>
      </div>

      <p
        className={cn("gg-copy-meta", errorMessage ? "text-destructive" : "text-muted-foreground")}
      >
        {errorMessage ??
          (recorder.isRecording
            ? studio.ui.helper.shortcutRecording
            : studio.ui.helper.shortcutCustomization)}
      </p>
    </div>
  );
}

export function ShortcutOverridesSection() {
  const studio = useStudio();

  return (
    <div className="space-y-3">
      <p className="gg-copy-meta">{studio.ui.helper.shortcutCustomization}</p>
      <div className="space-y-2">
        {studioShortcutIds.map((shortcutId) => (
          <ShortcutOverrideRow key={shortcutId} shortcutId={shortcutId} />
        ))}
      </div>
    </div>
  );
}
