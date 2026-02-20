import { type ReactNode, useCallback, useEffect, useRef } from "react";
import { useThrottler } from "@tanstack/react-pacer";
import type { PanelImperativeHandle, PanelSize } from "react-resizable-panels";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useStudio } from "../studio/context";
import { studioLayoutBounds } from "../studio/studioLayoutState";
import { TimelineDock } from "./TimelineDock";

type EditorWorkspaceProps = {
  leftPane: ReactNode;
  centerPane: ReactNode;
  rightPane: ReactNode;
};

export function EditorWorkspace({ leftPane, centerPane, rightPane }: EditorWorkspaceProps) {
  const studio = useStudio();
  const toPxSize = useCallback((value: number) => `${Math.max(value, 0)}px`, []);
  const leftPanelRef = useRef<PanelImperativeHandle | null>(null);
  const rightPanelRef = useRef<PanelImperativeHandle | null>(null);
  const timelinePanelRef = useRef<PanelImperativeHandle | null>(null);
  const lastLeftPanelSizePxRef = useRef(studio.layout.leftPaneWidthPx);
  const lastRightPanelSizePxRef = useRef(studio.layout.rightPaneWidthPx);
  const lastTimelinePanelSizePxRef = useRef(studio.layout.timelineHeightPx);
  const resizeStepPx = 8;
  const resizeStepPxLarge = 32;
  const paneResizeThrottleMs = 16;
  const timelineResizeStepPx = 8;
  const timelineResizeStepPxLarge = 32;
  const timelineResizeThrottleMs = 16;

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

  const timelineResizeThrottler = useThrottler(
    (nextHeightPx: number) => {
      studio.setTimelineHeight(nextHeightPx);
    },
    {
      leading: true,
      trailing: true,
      wait: timelineResizeThrottleMs,
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
    if (Math.abs(lastLeftPanelSizePxRef.current - studio.layout.leftPaneWidthPx) <= 1) {
      return;
    }
    if (Math.abs(leftPanel.getSize().inPixels - studio.layout.leftPaneWidthPx) > 1) {
      leftPanel.resize(toPxSize(studio.layout.leftPaneWidthPx));
    }
  }, [studio.layout.leftCollapsed, studio.layout.leftPaneWidthPx, toPxSize]);

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
    if (Math.abs(lastRightPanelSizePxRef.current - studio.layout.rightPaneWidthPx) <= 1) {
      return;
    }
    if (Math.abs(rightPanel.getSize().inPixels - studio.layout.rightPaneWidthPx) > 1) {
      rightPanel.resize(toPxSize(studio.layout.rightPaneWidthPx));
    }
  }, [studio.layout.rightCollapsed, studio.layout.rightPaneWidthPx, toPxSize]);

  useEffect(() => {
    const timelinePanel = timelinePanelRef.current;
    if (!timelinePanel) {
      return;
    }
    if (studio.layout.timelineCollapsed) {
      if (!timelinePanel.isCollapsed()) {
        timelinePanel.collapse();
      }
      return;
    }
    if (timelinePanel.isCollapsed()) {
      timelinePanel.expand();
    }
    if (Math.abs(lastTimelinePanelSizePxRef.current - studio.layout.timelineHeightPx) <= 1) {
      return;
    }
    if (Math.abs(timelinePanel.getSize().inPixels - studio.layout.timelineHeightPx) > 1) {
      timelinePanel.resize(toPxSize(studio.layout.timelineHeightPx));
    }
  }, [studio.layout.timelineCollapsed, studio.layout.timelineHeightPx, toPxSize]);

  useEffect(() => {
    return () => {
      leftPaneResizeThrottler.cancel();
      rightPaneResizeThrottler.cancel();
      timelineResizeThrottler.cancel();
    };
  }, [leftPaneResizeThrottler, rightPaneResizeThrottler, timelineResizeThrottler]);

  const syncLeftPaneSize = useCallback(
    (panelSize: PanelSize) => {
      lastLeftPanelSizePxRef.current = panelSize.inPixels;
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
      lastRightPanelSizePxRef.current = panelSize.inPixels;
      if (panelSize.inPixels <= 1) {
        rightPaneResizeThrottler.cancel();
        studio.setRightPaneCollapsed(true);
        return;
      }
      rightPaneResizeThrottler.maybeExecute(panelSize.inPixels);
    },
    [rightPaneResizeThrottler, studio],
  );

  const syncTimelineHeight = useCallback(
    (panelSize: PanelSize) => {
      lastTimelinePanelSizePxRef.current = panelSize.inPixels;
      if (panelSize.inPixels <= 1) {
        timelineResizeThrottler.cancel();
        studio.setTimelineCollapsed(true);
        return;
      }
      studio.setTimelineCollapsed(false);
      timelineResizeThrottler.maybeExecute(panelSize.inPixels);
    },
    [studio, timelineResizeThrottler],
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
      leftPanel.resize(toPxSize(nextWidth));
      studio.setLeftPaneWidth(nextWidth);
    },
    [studio, toPxSize],
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
      rightPanel.resize(toPxSize(nextWidth));
      studio.setRightPaneWidth(nextWidth);
    },
    [studio, toPxSize],
  );

  const resizeTimelineFromKeyboard = useCallback(
    (deltaPx: number) => {
      const timelinePanel = timelinePanelRef.current;
      if (!timelinePanel) {
        return;
      }
      if (studio.layout.timelineCollapsed) {
        studio.setTimelineCollapsed(false);
        timelinePanel.expand();
      }
      const nextHeight = studio.layout.timelineHeightPx + deltaPx;
      timelinePanel.resize(toPxSize(nextHeight));
      studio.setTimelineHeight(nextHeight);
    },
    [studio, toPxSize],
  );

  return (
    <ResizablePanelGroup
      className="h-full min-h-0"
      orientation="vertical"
      onLayoutChanged={() => {
        timelineResizeThrottler.flush();
      }}
    >
      <ResizablePanel id="workspace-content-pane" minSize={0}>
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
            defaultSize={toPxSize(studio.layout.leftPaneWidthPx)}
            minSize={toPxSize(studioLayoutBounds.leftPaneMinWidthPx)}
            maxSize={toPxSize(studioLayoutBounds.leftPaneMaxWidthPx)}
            collapsible
            collapsedSize="0px"
            onResize={syncLeftPaneSize}
          >
            {leftPane}
          </ResizablePanel>
          <ResizableHandle
            withHandle
            className="gg-pane-resize-handle"
            aria-label={studio.ui.labels.resizeLeftPane}
            aria-valuemin={studioLayoutBounds.leftPaneMinWidthPx}
            aria-valuemax={studioLayoutBounds.leftPaneMaxWidthPx}
            aria-valuenow={studio.layout.leftPaneWidthPx}
            onKeyDown={(event) => {
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
          <ResizablePanel id="editor-center-pane" minSize={0}>
            {centerPane}
          </ResizablePanel>
          <ResizableHandle
            withHandle
            className="gg-pane-resize-handle"
            aria-label={studio.ui.labels.resizeRightPane}
            aria-valuemin={studioLayoutBounds.rightPaneMinWidthPx}
            aria-valuemax={studioLayoutBounds.rightPaneMaxWidthPx}
            aria-valuenow={studio.layout.rightPaneWidthPx}
            onKeyDown={(event) => {
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
            defaultSize={toPxSize(studio.layout.rightPaneWidthPx)}
            minSize={toPxSize(studioLayoutBounds.rightPaneMinWidthPx)}
            maxSize={toPxSize(studioLayoutBounds.rightPaneMaxWidthPx)}
            collapsible
            collapsedSize="0px"
            onResize={syncRightPaneSize}
          >
            {rightPane}
          </ResizablePanel>
        </ResizablePanelGroup>
      </ResizablePanel>
      <ResizableHandle
        withHandle
        className="gg-timeline-resize-handle"
        aria-label={studio.ui.labels.resizeTimeline}
        aria-valuemin={studioLayoutBounds.timelineMinHeightPx}
        aria-valuemax={studioLayoutBounds.timelineMaxHeightPx}
        aria-valuenow={studio.layout.timelineCollapsed ? 0 : studio.layout.timelineHeightPx}
        onKeyDown={(event) => {
          const step = event.shiftKey ? timelineResizeStepPxLarge : timelineResizeStepPx;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            resizeTimelineFromKeyboard(-step);
            return;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            resizeTimelineFromKeyboard(step);
            return;
          }
          if (event.key === "Home") {
            event.preventDefault();
            resizeTimelineFromKeyboard(
              studioLayoutBounds.timelineMinHeightPx - studio.layout.timelineHeightPx,
            );
            return;
          }
          if (event.key === "End") {
            event.preventDefault();
            resizeTimelineFromKeyboard(
              studioLayoutBounds.timelineMaxHeightPx - studio.layout.timelineHeightPx,
            );
          }
        }}
      />
      <ResizablePanel
        id="workspace-timeline-pane"
        panelRef={timelinePanelRef}
        defaultSize={toPxSize(studio.layout.timelineHeightPx)}
        minSize={toPxSize(studioLayoutBounds.timelineMinHeightPx)}
        maxSize={toPxSize(studioLayoutBounds.timelineMaxHeightPx)}
        collapsible
        collapsedSize="0px"
        onResize={syncTimelineHeight}
      >
        <TimelineDock />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
