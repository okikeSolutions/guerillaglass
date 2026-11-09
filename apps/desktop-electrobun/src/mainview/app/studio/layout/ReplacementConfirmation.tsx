import { useEffect, useRef } from "react";
import { Button } from "@guerillaglass/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@guerillaglass/ui/components/dialog";
import * as m from "../../../../paraglide/messages.js";
import { useStudio } from "../state/StudioProvider";

export function ReplacementConfirmation() {
  const studio = useStudio();
  const confirmation = studio.replacementConfirmation;
  const keepEditingRef = useRef<HTMLButtonElement>(null);
  const decide = confirmation.decide;
  useEffect(() => () => decide(false), [decide]);
  const recording = confirmation.kind === "recording";
  const options = { locale: studio.locale };
  return (
    <Dialog
      open={confirmation.kind !== null}
      onOpenChange={(open) => {
        if (!open) {
          confirmation.decide(false);
        }
      }}
    >
      <DialogContent
        showCloseButton
        data-testid="replacement-confirmation"
        initialFocus={keepEditingRef}
        closeLabel={m.ui_workflow_close(undefined, options)}
      >
        <DialogTitle>
          {recording
            ? m.ui_replace_recording_title(undefined, options)
            : m.ui_replace_project_title(undefined, options)}
        </DialogTitle>
        <DialogDescription>
          {recording
            ? m.ui_replace_recording_body(undefined, options)
            : m.ui_replace_project_body(undefined, options)}
        </DialogDescription>
        <div className="flex flex-wrap justify-end gap-2">
          <Button ref={keepEditingRef} variant="outline" onClick={() => confirmation.decide(false)}>
            {m.ui_quit_keep_editing(undefined, options)}
          </Button>
          <Button onClick={() => confirmation.decide(true)}>
            {recording
              ? m.ui_replace_record(undefined, options)
              : m.ui_replace_open(undefined, options)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
