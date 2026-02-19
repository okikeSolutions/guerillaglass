import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
  useRef,
} from "react";
import { useThrottler } from "@tanstack/react-pacer";
import { useStudio } from "../studio/context";
import { studioLayoutBounds } from "../studio/studioLayoutState";

type EditorWorkspaceProps = {
  leftPane: ReactNode;
  centerPane: ReactNode;
  rightPane: ReactNode;
};

type PaneResizeDragState = {
  initialWidth: number;
  pointerId: number;
  side: "left" | "right";
  startX: number;
};

export function EditorWorkspace({ leftPane, centerPane, rightPane }: EditorWorkspaceProps) {
  const studio = useStudio();
  const resizeStepPx = 8;
  const resizeStepPxLarge = 32;
  const paneResizeThrottleMs = 16;
  const activePaneResizeRef = useRef<PaneResizeDragState | null>(null);

  const applyPaneResize = useCallback(
    ({
      clientX,
      initialWidth,
      side,
      startX,
    }: {
      clientX: number;
      initialWidth: number;
      side: "left" | "right";
      startX: number;
    }) => {
      const delta = clientX - startX;
      const nextWidth = side === "left" ? initialWidth + delta : initialWidth - delta;
      if (side === "left") {
        studio.setLeftPaneWidth(nextWidth);
      } else {
        studio.setRightPaneWidth(nextWidth);
      }
    },
    [studio],
  );

  const paneResizeThrottler = useThrottler(
    applyPaneResize,
    {
      leading: true,
      trailing: true,
      wait: paneResizeThrottleMs,
    },
    () => null,
  );

  const beginPaneResize = useCallback(
    (side: "left" | "right", event: ReactPointerEvent<HTMLDivElement>) => {
      if (!event.isPrimary || event.button !== 0) {
        return;
      }
      if (side === "left" && studio.layout.leftCollapsed) {
        return;
      }
      if (side === "right" && studio.layout.rightCollapsed) {
        return;
      }

      event.preventDefault();
      const startX = event.clientX;
      const initialWidth =
        side === "left" ? studio.layout.leftPaneWidthPx : studio.layout.rightPaneWidthPx;
      activePaneResizeRef.current = {
        initialWidth,
        pointerId: event.pointerId,
        side,
        startX,
      };

      paneResizeThrottler.cancel();
      applyPaneResize({
        clientX: startX,
        initialWidth,
        side,
        startX,
      });
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [applyPaneResize, paneResizeThrottler, studio],
  );

  const continuePaneResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const activeDrag = activePaneResizeRef.current;
      if (!activeDrag || event.pointerId !== activeDrag.pointerId) {
        return;
      }

      paneResizeThrottler.maybeExecute({
        clientX: event.clientX,
        initialWidth: activeDrag.initialWidth,
        side: activeDrag.side,
        startX: activeDrag.startX,
      });
    },
    [paneResizeThrottler],
  );

  const endPaneResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const activeDrag = activePaneResizeRef.current;
      if (!activeDrag || event.pointerId !== activeDrag.pointerId) {
        return;
      }

      paneResizeThrottler.maybeExecute({
        clientX: event.clientX,
        initialWidth: activeDrag.initialWidth,
        side: activeDrag.side,
        startX: activeDrag.startX,
      });
      paneResizeThrottler.flush();
      paneResizeThrottler.cancel();

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      activePaneResizeRef.current = null;
    },
    [paneResizeThrottler],
  );

  const cancelPaneResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const activeDrag = activePaneResizeRef.current;
      if (!activeDrag || event.pointerId !== activeDrag.pointerId) {
        return;
      }

      paneResizeThrottler.cancel();
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      activePaneResizeRef.current = null;
    },
    [paneResizeThrottler],
  );

  const style = {
    "--gg-left-pane-width": `${studio.layout.leftCollapsed ? 0 : studio.layout.leftPaneWidthPx}px`,
    "--gg-right-pane-width": `${studio.layout.rightCollapsed ? 0 : studio.layout.rightPaneWidthPx}px`,
    "--gg-left-splitter-width": studio.layout.leftCollapsed ? "0px" : "6px",
    "--gg-right-splitter-width": studio.layout.rightCollapsed ? "0px" : "6px",
  } as CSSProperties;

  const resizeLeftPaneFromKeyboard = useCallback(
    (deltaPx: number) => {
      studio.setLeftPaneWidth(studio.layout.leftPaneWidthPx + deltaPx);
    },
    [studio],
  );

  const resizeRightPaneFromKeyboard = useCallback(
    (deltaPx: number) => {
      studio.setRightPaneWidth(studio.layout.rightPaneWidthPx + deltaPx);
    },
    [studio],
  );

  return (
    <section
      className="gg-editor-shell"
      style={style}
      data-left-collapsed={studio.layout.leftCollapsed}
      data-right-collapsed={studio.layout.rightCollapsed}
    >
      {leftPane}
      <div
        className="gg-pane-resize-handle"
        data-disabled={studio.layout.leftCollapsed}
        onPointerDown={(event) => beginPaneResize("left", event)}
        onPointerMove={continuePaneResize}
        onPointerUp={endPaneResize}
        onPointerCancel={cancelPaneResize}
        role="separator"
        aria-label={studio.ui.labels.resizeLeftPane}
        aria-orientation="vertical"
        tabIndex={studio.layout.leftCollapsed ? -1 : 0}
        aria-disabled={studio.layout.leftCollapsed}
        aria-valuemin={studioLayoutBounds.leftPaneMinWidthPx}
        aria-valuemax={studioLayoutBounds.leftPaneMaxWidthPx}
        aria-valuenow={studio.layout.leftPaneWidthPx}
        onKeyDown={(event) => {
          if (studio.layout.leftCollapsed) {
            return;
          }

          const step = event.shiftKey ? resizeStepPxLarge : resizeStepPx;
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            resizeLeftPaneFromKeyboard(-step);
            return;
          }
          if (event.key === "ArrowRight") {
            event.preventDefault();
            resizeLeftPaneFromKeyboard(step);
            return;
          }
          if (event.key === "Home") {
            event.preventDefault();
            studio.setLeftPaneWidth(studioLayoutBounds.leftPaneMinWidthPx);
            return;
          }
          if (event.key === "End") {
            event.preventDefault();
            studio.setLeftPaneWidth(studioLayoutBounds.leftPaneMaxWidthPx);
          }
        }}
      />
      {centerPane}
      <div
        className="gg-pane-resize-handle"
        data-disabled={studio.layout.rightCollapsed}
        onPointerDown={(event) => beginPaneResize("right", event)}
        onPointerMove={continuePaneResize}
        onPointerUp={endPaneResize}
        onPointerCancel={cancelPaneResize}
        role="separator"
        aria-label={studio.ui.labels.resizeRightPane}
        aria-orientation="vertical"
        tabIndex={studio.layout.rightCollapsed ? -1 : 0}
        aria-disabled={studio.layout.rightCollapsed}
        aria-valuemin={studioLayoutBounds.rightPaneMinWidthPx}
        aria-valuemax={studioLayoutBounds.rightPaneMaxWidthPx}
        aria-valuenow={studio.layout.rightPaneWidthPx}
        onKeyDown={(event) => {
          if (studio.layout.rightCollapsed) {
            return;
          }

          const step = event.shiftKey ? resizeStepPxLarge : resizeStepPx;
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            resizeRightPaneFromKeyboard(step);
            return;
          }
          if (event.key === "ArrowRight") {
            event.preventDefault();
            resizeRightPaneFromKeyboard(-step);
            return;
          }
          if (event.key === "Home") {
            event.preventDefault();
            studio.setRightPaneWidth(studioLayoutBounds.rightPaneMinWidthPx);
            return;
          }
          if (event.key === "End") {
            event.preventDefault();
            studio.setRightPaneWidth(studioLayoutBounds.rightPaneMaxWidthPx);
          }
        }}
      />
      {rightPane}
    </section>
  );
}
