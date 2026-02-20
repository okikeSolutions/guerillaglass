import { type ReactNode, useCallback, useEffect, useRef } from "react";
import type { PanelImperativeHandle } from "react-resizable-panels";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useStudio } from "../studio/context";
import { studioLayoutBounds } from "../studio/studioLayoutState";

type EditorWorkspaceProps = {
  leftPane: ReactNode;
  centerPane: ReactNode;
  rightPane: ReactNode;
  bottomPane: ReactNode;
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export function EditorWorkspace({
  leftPane,
  centerPane,
  rightPane,
  bottomPane,
}: EditorWorkspaceProps) {
  const studio = useStudio();
  const layout = studio.layout;
  const setLeftPaneCollapsed = studio.setLeftPaneCollapsed;
  const setRightPaneCollapsed = studio.setRightPaneCollapsed;
  const setTimelineCollapsed = studio.setTimelineCollapsed;
  const setLeftPaneWidth = studio.setLeftPaneWidth;
  const setRightPaneWidth = studio.setRightPaneWidth;
  const setTimelineHeight = studio.setTimelineHeight;
  const layoutRef = useRef(layout);
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  const toPxSize = useCallback((value: number) => `${Math.max(value, 0)}px`, []);
  const leftPanelRef = useRef<PanelImperativeHandle | null>(null);
  const rightPanelRef = useRef<PanelImperativeHandle | null>(null);
  const timelinePanelRef = useRef<PanelImperativeHandle | null>(null);
  const isPointerResizingRef = useRef(false);
  const resizeStepPx = 8;
  const resizeStepPxLarge = 32;
  const timelineResizeStepPx = 8;
  const timelineResizeStepPxLarge = 32;
  const leftPanelKey = layout.leftCollapsed ? "left-collapsed" : "left-expanded";
  const rightPanelKey = layout.rightCollapsed ? "right-collapsed" : "right-expanded";
  const timelinePanelKey = layout.timelineCollapsed ? "timeline-collapsed" : "timeline-expanded";

  useEffect(() => {
    const clearPointerResize = () => {
      isPointerResizingRef.current = false;
    };
    window.addEventListener("pointerup", clearPointerResize);
    window.addEventListener("pointercancel", clearPointerResize);
    return () => {
      window.removeEventListener("pointerup", clearPointerResize);
      window.removeEventListener("pointercancel", clearPointerResize);
    };
  }, []);

  const markPointerResizeStart = useCallback(() => {
    isPointerResizingRef.current = true;
  }, []);

  const commitHorizontalPanelLayout = useCallback(() => {
    if (!isPointerResizingRef.current) {
      return;
    }
    const leftPanel = leftPanelRef.current;
    const rightPanel = rightPanelRef.current;
    if (!leftPanel || !rightPanel) {
      return;
    }

    const leftSize = leftPanel.getSize();
    const rightSize = rightPanel.getSize();
    const leftCollapsed = leftPanel.isCollapsed() || leftSize.inPixels <= 1;
    const rightCollapsed = rightPanel.isCollapsed() || rightSize.inPixels <= 1;
    const nextLeftWidth = clamp(
      Math.round(leftSize.inPixels),
      studioLayoutBounds.leftPaneMinWidthPx,
      studioLayoutBounds.leftPaneMaxWidthPx,
    );
    const nextRightWidth = clamp(
      Math.round(rightSize.inPixels),
      studioLayoutBounds.rightPaneMinWidthPx,
      studioLayoutBounds.rightPaneMaxWidthPx,
    );

    const currentLayout = layoutRef.current;

    if (leftCollapsed !== currentLayout.leftCollapsed) {
      setLeftPaneCollapsed(leftCollapsed);
    }
    if (rightCollapsed !== currentLayout.rightCollapsed) {
      setRightPaneCollapsed(rightCollapsed);
    }

    if (!leftCollapsed && Math.abs(nextLeftWidth - currentLayout.leftPaneWidthPx) > 1) {
      setLeftPaneWidth(nextLeftWidth);
    }
    if (!rightCollapsed && Math.abs(nextRightWidth - currentLayout.rightPaneWidthPx) > 1) {
      setRightPaneWidth(nextRightWidth);
    }
  }, [setLeftPaneCollapsed, setLeftPaneWidth, setRightPaneCollapsed, setRightPaneWidth]);

  const commitTimelinePanelLayout = useCallback(() => {
    if (!isPointerResizingRef.current) {
      return;
    }
    const timelinePanel = timelinePanelRef.current;
    if (!timelinePanel) {
      return;
    }

    const timelineSize = timelinePanel.getSize();
    const timelineCollapsed = timelinePanel.isCollapsed() || timelineSize.inPixels <= 1;
    const nextTimelineHeight = clamp(
      Math.round(timelineSize.inPixels),
      studioLayoutBounds.timelineMinHeightPx,
      studioLayoutBounds.timelineMaxHeightPx,
    );

    const currentLayout = layoutRef.current;

    if (timelineCollapsed !== currentLayout.timelineCollapsed) {
      setTimelineCollapsed(timelineCollapsed);
    }
    if (!timelineCollapsed && Math.abs(nextTimelineHeight - currentLayout.timelineHeightPx) > 1) {
      setTimelineHeight(nextTimelineHeight);
    }
  }, [setTimelineCollapsed, setTimelineHeight]);

  const resizeLeftPaneFromKeyboard = useCallback(
    (deltaPx: number) => {
      const leftPanel = leftPanelRef.current;
      if (!leftPanel) {
        return;
      }
      const nextWidth = layout.leftPaneWidthPx + deltaPx;
      if (layout.leftCollapsed) {
        setLeftPaneCollapsed(false);
        leftPanel.expand();
      }
      leftPanel.resize(toPxSize(nextWidth));
      setLeftPaneWidth(nextWidth);
    },
    [
      layout.leftCollapsed,
      layout.leftPaneWidthPx,
      setLeftPaneCollapsed,
      setLeftPaneWidth,
      toPxSize,
    ],
  );

  const resizeRightPaneFromKeyboard = useCallback(
    (deltaPx: number) => {
      const rightPanel = rightPanelRef.current;
      if (!rightPanel) {
        return;
      }
      const nextWidth = layout.rightPaneWidthPx + deltaPx;
      if (layout.rightCollapsed) {
        setRightPaneCollapsed(false);
        rightPanel.expand();
      }
      rightPanel.resize(toPxSize(nextWidth));
      setRightPaneWidth(nextWidth);
    },
    [
      layout.rightCollapsed,
      layout.rightPaneWidthPx,
      setRightPaneCollapsed,
      setRightPaneWidth,
      toPxSize,
    ],
  );

  const resizeTimelineFromKeyboard = useCallback(
    (deltaPx: number) => {
      const timelinePanel = timelinePanelRef.current;
      if (!timelinePanel) {
        return;
      }
      if (layout.timelineCollapsed) {
        setTimelineCollapsed(false);
        timelinePanel.expand();
      }
      const nextHeight = layout.timelineHeightPx + deltaPx;
      timelinePanel.resize(toPxSize(nextHeight));
      setTimelineHeight(nextHeight);
    },
    [
      layout.timelineCollapsed,
      layout.timelineHeightPx,
      setTimelineCollapsed,
      setTimelineHeight,
      toPxSize,
    ],
  );

  return (
    <ResizablePanelGroup
      className="h-full min-h-0 overflow-hidden"
      orientation="vertical"
      onLayoutChanged={commitTimelinePanelLayout}
    >
      <ResizablePanel id="workspace-content-pane" minSize={0} className="min-h-0 overflow-hidden">
        <ResizablePanelGroup
          className="gg-editor-shell min-h-0"
          orientation="horizontal"
          data-left-collapsed={layout.leftCollapsed}
          data-right-collapsed={layout.rightCollapsed}
          onLayoutChanged={commitHorizontalPanelLayout}
        >
          <ResizablePanel
            id="editor-left-pane"
            key={leftPanelKey}
            panelRef={leftPanelRef}
            defaultSize={layout.leftCollapsed ? "0px" : toPxSize(layout.leftPaneWidthPx)}
            minSize={toPxSize(studioLayoutBounds.leftPaneMinWidthPx)}
            maxSize={toPxSize(studioLayoutBounds.leftPaneMaxWidthPx)}
            collapsible
            collapsedSize="0px"
            className="min-h-0 min-w-0 overflow-hidden"
          >
            {leftPane}
          </ResizablePanel>
          <ResizableHandle
            withHandle
            className="gg-pane-resize-handle"
            onPointerDown={markPointerResizeStart}
            aria-label={studio.ui.labels.resizeLeftPane}
            aria-valuemin={studioLayoutBounds.leftPaneMinWidthPx}
            aria-valuemax={studioLayoutBounds.leftPaneMaxWidthPx}
            aria-valuenow={layout.leftPaneWidthPx}
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
                  studioLayoutBounds.leftPaneMinWidthPx - layout.leftPaneWidthPx,
                );
                return;
              }
              if (event.key === "End") {
                event.preventDefault();
                resizeLeftPaneFromKeyboard(
                  studioLayoutBounds.leftPaneMaxWidthPx - layout.leftPaneWidthPx,
                );
              }
            }}
          />
          <ResizablePanel
            id="editor-center-pane"
            minSize={0}
            className="min-h-0 min-w-0 overflow-hidden"
          >
            {centerPane}
          </ResizablePanel>
          <ResizableHandle
            withHandle
            className="gg-pane-resize-handle"
            onPointerDown={markPointerResizeStart}
            aria-label={studio.ui.labels.resizeRightPane}
            aria-valuemin={studioLayoutBounds.rightPaneMinWidthPx}
            aria-valuemax={studioLayoutBounds.rightPaneMaxWidthPx}
            aria-valuenow={layout.rightPaneWidthPx}
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
                  studioLayoutBounds.rightPaneMinWidthPx - layout.rightPaneWidthPx,
                );
                return;
              }
              if (event.key === "End") {
                event.preventDefault();
                resizeRightPaneFromKeyboard(
                  studioLayoutBounds.rightPaneMaxWidthPx - layout.rightPaneWidthPx,
                );
              }
            }}
          />
          <ResizablePanel
            id="editor-right-pane"
            key={rightPanelKey}
            panelRef={rightPanelRef}
            defaultSize={layout.rightCollapsed ? "0px" : toPxSize(layout.rightPaneWidthPx)}
            minSize={toPxSize(studioLayoutBounds.rightPaneMinWidthPx)}
            maxSize={toPxSize(studioLayoutBounds.rightPaneMaxWidthPx)}
            collapsible
            collapsedSize="0px"
            className="min-h-0 min-w-0 overflow-hidden"
          >
            {rightPane}
          </ResizablePanel>
        </ResizablePanelGroup>
      </ResizablePanel>
      <ResizableHandle
        withHandle
        className="gg-timeline-resize-handle"
        onPointerDown={markPointerResizeStart}
        aria-label={studio.ui.labels.resizeTimeline}
        aria-valuemin={studioLayoutBounds.timelineMinHeightPx}
        aria-valuemax={studioLayoutBounds.timelineMaxHeightPx}
        aria-valuenow={layout.timelineCollapsed ? 0 : layout.timelineHeightPx}
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
              studioLayoutBounds.timelineMinHeightPx - layout.timelineHeightPx,
            );
            return;
          }
          if (event.key === "End") {
            event.preventDefault();
            resizeTimelineFromKeyboard(
              studioLayoutBounds.timelineMaxHeightPx - layout.timelineHeightPx,
            );
          }
        }}
      />
      <ResizablePanel
        id="workspace-timeline-pane"
        key={timelinePanelKey}
        panelRef={timelinePanelRef}
        defaultSize={layout.timelineCollapsed ? "0px" : toPxSize(layout.timelineHeightPx)}
        minSize={toPxSize(studioLayoutBounds.timelineMinHeightPx)}
        maxSize={toPxSize(studioLayoutBounds.timelineMaxHeightPx)}
        collapsible
        collapsedSize="0px"
        className="min-h-0 overflow-hidden"
      >
        {bottomPane}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
