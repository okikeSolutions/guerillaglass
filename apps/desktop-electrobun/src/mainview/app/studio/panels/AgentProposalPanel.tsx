import { useRef, useState } from "react";
import { useStore } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { Schema, Result } from "effect";
import {
  EditStoryboard,
  compileStoryboard,
  describeSceneChanges,
  type EditProposalBaseline,
} from "@guerillaglass/engine-contract/domains/editWorkflow";
import type { TimelineItem } from "@guerillaglass/engine-contract/shared/valueObjects";
import type { ProjectState } from "@guerillaglass/engine-contract/domains/project";
import { Button } from "@guerillaglass/ui/components/button";
import { Textarea } from "@guerillaglass/ui/components/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@guerillaglass/ui/components/dialog";
import { getAgentProposalMessages } from "@shared/localization";
import { engineApi } from "@lib/engine";
import { useStudio } from "../state/StudioProvider";
import { studioQueryKeys } from "../hooks/core/useStudioDataQueries";

const decodeStoryboard = Schema.decodeUnknownResult(Schema.fromJsonString(EditStoryboard));

type ProposalReviewProps = {
  available: boolean;
  busy: boolean;
  dirty: boolean;
  editorSignature: string;
  validate: (storyboard: EditStoryboard) => Promise<EditProposalBaseline>;
  apply: (storyboard: EditStoryboard) => Promise<void>;
};

/** Proposal review keeps validation tied to the exact editor and text snapshot. */
export function AgentProposalReview({
  available,
  busy,
  dirty,
  editorSignature,
  validate,
  apply,
}: ProposalReviewProps) {
  const labels = getAgentProposalMessages();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, setPending] = useState<"validate" | "apply" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [validation, setValidation] = useState<{
    storyboard: EditStoryboard;
    baseline: EditProposalBaseline;
    text: string;
    signature: string;
  } | null>(null);
  const operation = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const current = Boolean(
    validation && validation.text === text && validation.signature === editorSignature && !dirty,
  );
  const disabled = busy || pending !== null;
  const changes = validation
    ? describeSceneChanges(
        validation.baseline.timeline,
        compileStoryboard(validation.storyboard).timeline,
      )
    : [];
  const previous = new Map(
    validation?.baseline.timeline.items.map((item) => [item.id, item]) ?? [],
  );
  const scenes = new Map(
    validation?.storyboard.scenes.map((scene) => [scene.item.id, scene]) ?? [],
  );
  const itemLabel = (item: TimelineItem | undefined) =>
    !item
      ? "—"
      : item.kind === "gap"
        ? `${labels.gap} ${item.durationSeconds.toFixed(2)} s`
        : `${item.sourceStartSeconds.toFixed(2)}–${item.sourceEndSeconds.toFixed(2)} s${item.camera ? ` · ${item.camera.length} ${labels.camera}` : ""}`;

  const renderItem = (item: TimelineItem | undefined) => (
    <div>
      <span>{itemLabel(item)}</span>
      {item?.kind === "clip" && item.camera ? (
        <details className="mt-1 max-w-56">
          <summary className="cursor-pointer">{labels.camera}</summary>
          <ul className="max-h-32 overflow-y-auto">
            {item.camera.map((key) => (
              <li key={key.timeSeconds}>
                {`${key.timeSeconds.toFixed(2)} s · ${key.zoom.toFixed(2)}× · (${key.centerX.toFixed(2)}, ${key.centerY.toFixed(2)})`}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );

  async function validateProposal() {
    if (operation.current || busy || dirty || !available) {
      return;
    }
    setNotice(null);
    setValidation(null);
    setConfirmed(false);
    if (new TextEncoder().encode(text).length > 2 * 1024 * 1024) {
      setNotice(labels.invalid);
      return;
    }
    const decoded = decodeStoryboard(text);
    if (Result.isFailure(decoded)) {
      setNotice(labels.invalid);
      return;
    }
    operation.current = true;
    setPending("validate");
    try {
      const baseline = await validate(decoded.success);
      setValidation({ storyboard: decoded.success, baseline, text, signature: editorSignature });
    } catch {
      setNotice(labels.failed);
    } finally {
      operation.current = false;
      setPending(null);
    }
  }

  async function applyProposal() {
    if (operation.current || busy || !current || !validation || !confirmed || !available) {
      return;
    }
    operation.current = true;
    setPending("apply");
    setNotice(null);
    try {
      await apply(validation.storyboard);
      setNotice(labels.applied);
    } catch {
      setNotice(labels.apply_failed);
    } finally {
      setValidation(null);
      setConfirmed(false);
      operation.current = false;
      setPending(null);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        {labels.entry}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!pending) {
            setOpen(next);
            setConfirmed(false);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{labels.entry}</DialogTitle>
            <DialogDescription>{labels.help}</DialogDescription>
          </DialogHeader>
          {!available ? <p role="status">{labels.no_project}</p> : null}
          {dirty ? <p role="status">{labels.save_first}</p> : null}
          <div>
            <Button
              variant="secondary"
              disabled={pending !== null}
              onClick={() => fileInput.current?.click()}
            >
              {labels.import}
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept=".json,application/json"
              aria-label={labels.import}
              hidden
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (!file || pending !== null) {
                  return;
                }
                setValidation(null);
                setConfirmed(false);
                setNotice(null);
                if (file.size > 2 * 1024 * 1024) {
                  setNotice(labels.invalid);
                  return;
                }
                void file
                  .text()
                  .then((contents) => setText(contents))
                  .catch(() => setNotice(labels.invalid));
              }}
            />
          </div>
          <details open={validation === null}>
            <summary className="cursor-pointer text-sm">{labels.input}</summary>
            <label className="mt-2 grid gap-2 text-sm">
              {labels.input}
              <Textarea
                aria-label={labels.input}
                placeholder={labels.input_help}
                value={text}
                onChange={(event) => {
                  setText(event.target.value);
                  setConfirmed(false);
                  setNotice(null);
                }}
                disabled={pending !== null}
                className="h-32 min-h-32 max-h-48 field-sizing-fixed overflow-y-auto font-mono text-xs"
              />
            </label>
          </details>
          <div>
            <Button
              variant="secondary"
              onClick={() => void validateProposal()}
              disabled={disabled || dirty || !available || !text.trim()}
            >
              {pending === "validate" ? labels.validating : labels.validate}
            </Button>
          </div>
          {validation ? (
            <>
              <p role="status" className="text-sm">
                {current ? labels.valid : labels.changed}
              </p>
              <div className="text-sm">
                <h3 className="font-medium">{labels.brief}</h3>
                <p className="whitespace-pre-wrap">{validation.storyboard.brief}</p>
              </div>
              <div className="overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr>
                      {[labels.scene, labels.before, labels.after, labels.changes].map((label) => (
                        <th key={label} className="border-b p-2">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {changes.map((change) => {
                      const scene = scenes.get(change.id);
                      const status =
                        [
                          change.added ? labels.added : "",
                          change.removed ? labels.removed : "",
                          change.modified ? labels.modified : "",
                          change.moved ? labels.moved : "",
                        ]
                          .filter(Boolean)
                          .join(", ") || labels.unchanged;
                      return (
                        <tr key={change.id}>
                          <td className="max-w-64 border-b p-2">
                            <div className="font-medium">{scene?.title ?? change.id}</div>
                            <div>{change.id}</div>
                            <p>{scene?.purpose}</p>
                          </td>
                          <td className="border-b p-2">{renderItem(previous.get(change.id))}</td>
                          <td className="border-b p-2">{renderItem(scene?.item)}</td>
                          <td className="border-b p-2">{status}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                  disabled={!current || disabled || !available}
                />
                {labels.confirm}
              </label>
              <div>
                <Button
                  onClick={() => void applyProposal()}
                  disabled={!current || !confirmed || disabled || !available}
                >
                  {pending === "apply" ? labels.applying : labels.apply}
                </Button>
              </div>
            </>
          ) : null}
          {notice ? (
            <p role="status" className="text-sm">
              {notice}
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button
              variant="ghost"
              disabled={pending !== null}
              onClick={() => {
                setOpen(false);
                setConfirmed(false);
              }}
            >
              {labels.close}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Connects proposal review to the existing editor and native project session. */
export function AgentProposalPanel() {
  const studio = useStudio();
  const queryClient = useQueryClient();
  const values = useStore(studio.settingsForm.store, (state) => state.values);
  const project = studio.projectQuery.data;
  const dirty = Boolean(
    project &&
    (studio.hasUnsavedTimelineEdits ||
      (project.autoZoom && JSON.stringify(values.autoZoom) !== JSON.stringify(project.autoZoom)) ||
      (project.backgroundFraming &&
        JSON.stringify(values.backgroundFraming) !== JSON.stringify(project.backgroundFraming))),
  );
  const editorSignature = JSON.stringify([
    project?.projectPath,
    studio.timelineDocument,
    values.autoZoom,
    values.backgroundFraming,
  ]);
  return (
    <AgentProposalReview
      available={Boolean(
        project?.projectPath &&
        studio.recordingURL &&
        studio.capabilitiesQuery.data?.agent?.editPlanVersion === 1,
      )}
      busy={studio.isRunningAction || Boolean(studio.captureStatusQuery.data?.isRecording)}
      dirty={dirty}
      editorSignature={editorSignature}
      validate={engineApi.validateProposal}
      apply={async (storyboard) => {
        const saved: ProjectState = await engineApi.applyProposal(storyboard);
        studio.playbackStore.pause();
        studio.playbackStore.seek(0);
        studio.clearInspectorSelection();
        queryClient.setQueryData(studioQueryKeys.projectCurrent(), saved);
      }}
    />
  );
}
