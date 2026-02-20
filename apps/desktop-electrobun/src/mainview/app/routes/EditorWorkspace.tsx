import { type ReactNode, useCallback, useEffect, useRef } from "react";
import { useThrottler } from "@tanstack/react-pacer";
import type { PanelImperativeHandle, PanelSize } from "react-resizable-panels";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useStudio } from "../studio/context";
import { studioLayoutBounds } from "../studio/studioLayoutState";

type EditorWorkspaceProps = {
  leftPane: ReactNode;
  centerPane: ReactNode;
  rightPane: ReactNode;
};

export function EditorWorkspace({ leftPane, centerPane, rightPane }: EditorWorkspaceProps) {
  const studio = useStudio();
  const leftPanelRef = useRef<PanelImperativeHandle | null>(null);
  const rightPanelRef = useRef<PanelImperativeHandle | null>(null);
  const resizeStepPx = 8;
  const resizeStepPxLarge = 32;
  const paneResizeThrottleMs = 16;

  const leftPaneResizeThrottler = useThrottler(
    (nextWidthPx: number) => {
      studio.setLeftPaneWidth(nextWidthPx);
    },
    {
      leading: true,
      trailing: true,
      wait: paneResizeThrottleMs,
    },
    () => null,
  );

  const rightPaneResizeThrottler = useThrottler(
    (nextWidthPx: number) => {
      studio.setRightPaneWidth(nextWidthPx);
    },
    {
      leading: true,
      trailing: true,
      wait: paneResizeThrottleMs,
    },
    () => null,
  );

  useEffect(() => {
    const leftPanel = leftPanelRef.current;
    if (!leftPanel) {
      return;
    }
    if (studio.layout.leftCollapsed) {
      if (!leftPanel.isCollapsed()) {
        leftPanel.collapse();
      }
      return;
    }
    if (leftPanel.isCollapsed()) {
      leftPanel.expand();
    }
    if (Math.abs(leftPanel.getSize().inPixels - studio.layout.leftPaneWidthPx) > 1) {
      leftPanel.resize(studio.layout.leftPaneWidthPx);
    }
  }, [studio.layout.leftCollapsed, studio.layout.leftPaneWidthPx]);

  useEffect(() => {
    const rightPanel = rightPanelRef.current;
    if (!rightPanel) {
      return;
    }
    if (studio.layout.rightCollapsed) {
      if (!rightPanel.isCollapsed()) {
        rightPanel.collapse();
      }
      return;
    }
    if (rightPanel.isCollapsed()) {
      rightPanel.expand();
    }
    if (Math.abs(rightPanel.getSize().inPixels - studio.layout.rightPaneWidthPx) > 1) {
      rightPanel.resize(studio.layout.rightPaneWidthPx);
    }
  }, [studio.layout.rightCollapsed, studio.layout.rightPaneWidthPx]);

  useEffect(() => {
    return () => {
      leftPaneResizeThrottler.cancel();
      rightPaneResizeThrottler.cancel();
    };
  }, [leftPaneResizeThrottler, rightPaneResizeThrottler]);

  const syncLeftPaneSize = useCallback(
    (panelSize: PanelSize) => {
      if (panelSize.inPixels <= 1) {
        leftPaneResizeThrottler.cancel();
        studio.setLeftPaneCollapsed(true);
        return;
      }
      leftPaneResizeThrottler.maybeExecute(panelSize.inPixels);
    },
    [leftPaneResizeThrottler, studio],
  );

  const syncRightPaneSize = useCallback(
    (panelSize: PanelSize) => {
      if (panelSize.inPixels <= 1) {
        rightPaneResizeThrottler.cancel();
        studio.setRightPaneCollapsed(true);
        return;
      }
      rightPaneResizeThrottler.maybeExecute(panelSize.inPixels);
    },
    [rightPaneResizeThrottler, studio],
  );

  const resizeLeftPaneFromKeyboard = useCallback(
    (deltaPx: number) => {
      const leftPanel = leftPanelRef.current;
      if (!leftPanel) {
        return;
      }
      const nextWidth = studio.layout.leftPaneWidthPx + deltaPx;
      if (studio.layout.leftCollapsed) {
        studio.setLeftPaneCollapsed(false);
        leftPanel.expand();
      }
      leftPanel.resize(nextWidth);
      studio.setLeftPaneWidth(nextWidth);
    },
    [studio],
  );

  const resizeRightPaneFromKeyboard = useCallback(
    (deltaPx: number) => {
      const rightPanel = rightPanelRef.current;
      if (!rightPanel) {
        return;
      }
      const nextWidth = studio.layout.rightPaneWidthPx + deltaPx;
      if (studio.layout.rightCollapsed) {
        studio.setRightPaneCollapsed(false);
        rightPanel.expand();
      }
      rightPanel.resize(nextWidth);
      studio.setRightPaneWidth(nextWidth);
    },
    [studio],
  );

  return (
    <ResizablePanelGroup
      className="gg-editor-shell"
      orientation="horizontal"
      data-left-collapsed={studio.layout.leftCollapsed}
      data-right-collapsed={studio.layout.rightCollapsed}
      onLayoutChanged={() => {
        leftPaneResizeThrottler.flush();
        rightPaneResizeThrottler.flush();
      }}
    >
      <ResizablePanel
        id="editor-left-pane"
        panelRef={leftPanelRef}
        defaultSize={studio.layout.leftPaneWidthPx}
        minSize={studioLayoutBounds.leftPaneMinWidthPx}
        maxSize={studioLayoutBounds.leftPaneMaxWidthPx}
        collapsible
        collapsedSize={0}
        onResize={syncLeftPaneSize}
      >
        {leftPane}
      </ResizablePanel>
      <ResizableHandle
        withHandle
        className="gg-pane-resize-handle"
        data-disabled={studio.layout.leftCollapsed}
        disabled={studio.layout.leftCollapsed}
        aria-label={studio.ui.labels.resizeLeftPane}
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
            resizeLeftPaneFromKeyboard(
              studioLayoutBounds.leftPaneMinWidthPx - studio.layout.leftPaneWidthPx,
            );
            return;
          }
          if (event.key === "End") {
            event.preventDefault();
            resizeLeftPaneFromKeyboard(
              studioLayoutBounds.leftPaneMaxWidthPx - studio.layout.leftPaneWidthPx,
            );
          }
        }}
      />
      <ResizablePanel id="editor-center-pane" minSize={420}>
        {centerPane}
      </ResizablePanel>
      <ResizableHandle
        withHandle
        className="gg-pane-resize-handle"
        data-disabled={studio.layout.rightCollapsed}
        disabled={studio.layout.rightCollapsed}
        aria-label={studio.ui.labels.resizeRightPane}
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
            resizeRightPaneFromKeyboard(
              studioLayoutBounds.rightPaneMinWidthPx - studio.layout.rightPaneWidthPx,
            );
            return;
          }
          if (event.key === "End") {
            event.preventDefault();
            resizeRightPaneFromKeyboard(
              studioLayoutBounds.rightPaneMaxWidthPx - studio.layout.rightPaneWidthPx,
            );
          }
        }}
      />
      <ResizablePanel
        id="editor-right-pane"
        panelRef={rightPanelRef}
        defaultSize={studio.layout.rightPaneWidthPx}
        minSize={studioLayoutBounds.rightPaneMinWidthPx}
        maxSize={studioLayoutBounds.rightPaneMaxWidthPx}
        collapsible
        collapsedSize={0}
        onResize={syncRightPaneSize}
      >
        {rightPane}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
