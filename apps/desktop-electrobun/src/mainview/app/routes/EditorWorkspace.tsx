import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const workspaceContentPreferredMinHeightPx = 220;
  const timelineHandleHeightPx = 10;
  const layoutRef = useRef(layout);
  const verticalGroupContainerRef = useRef<HTMLDivElement | null>(null);
  const [verticalGroupHeightPx, setVerticalGroupHeightPx] = useState<number | null>(null);
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
    const container = verticalGroupContainerRef.current;
    if (!container) {
      return;
    }
    const updateHeight = () => {
      setVerticalGroupHeightPx(Math.round(container.getBoundingClientRect().height));
    };
    updateHeight();
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(updateHeight);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const workspaceContentMinHeightPx = useMemo(() => {
    if (verticalGroupHeightPx == null) {
      return workspaceContentPreferredMinHeightPx;
    }
    const maxPermittedMinHeight = Math.max(
      0,
      verticalGroupHeightPx - timelineHandleHeightPx - studioLayoutBounds.timelineMinHeightPx,
    );
    return Math.min(workspaceContentPreferredMinHeightPx, maxPermittedMinHeight);
  }, [verticalGroupHeightPx, workspaceContentPreferredMinHeightPx]);

  const timelineHeightBounds = useMemo(() => {
    if (verticalGroupHeightPx == null) {
      return {
        minPx: studioLayoutBounds.timelineMinHeightPx,
        maxPx: studioLayoutBounds.timelineMaxHeightPx,
      };
    }
    const maxTimelineByAvailableSpace = Math.max(
      0,
      verticalGroupHeightPx - timelineHandleHeightPx - workspaceContentMinHeightPx,
    );
    const minPx = Math.min(studioLayoutBounds.timelineMinHeightPx, maxTimelineByAvailableSpace);
    const maxPx = Math.min(studioLayoutBounds.timelineMaxHeightPx, maxTimelineByAvailableSpace);
    return {
      minPx,
      maxPx: Math.max(minPx, maxPx),
    };
  }, [verticalGroupHeightPx, workspaceContentMinHeightPx]);

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
      timelineHeightBounds.minPx,
      timelineHeightBounds.maxPx,
    );

    const currentLayout = layoutRef.current;

    if (timelineCollapsed !== currentLayout.timelineCollapsed) {
      setTimelineCollapsed(timelineCollapsed);
    }
    if (!timelineCollapsed && Math.abs(nextTimelineHeight - currentLayout.timelineHeightPx) > 1) {
      setTimelineHeight(nextTimelineHeight);
    }
  }, [
    setTimelineCollapsed,
    setTimelineHeight,
    timelineHeightBounds.maxPx,
    timelineHeightBounds.minPx,
  ]);

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
      const nextHeight = clamp(
        layout.timelineHeightPx + deltaPx,
        timelineHeightBounds.minPx,
        timelineHeightBounds.maxPx,
      );
      timelinePanel.resize(toPxSize(nextHeight));
      setTimelineHeight(nextHeight);
    },
    [
      layout.timelineCollapsed,
      layout.timelineHeightPx,
      setTimelineCollapsed,
      setTimelineHeight,
      timelineHeightBounds.maxPx,
      timelineHeightBounds.minPx,
      toPxSize,
    ],
  );

  useEffect(() => {
    if (layout.timelineCollapsed) {
      return;
    }
    const timelinePanel = timelinePanelRef.current;
    if (!timelinePanel) {
      return;
    }
    const clampedTimelineHeight = clamp(
      layout.timelineHeightPx,
      timelineHeightBounds.minPx,
      timelineHeightBounds.maxPx,
    );
    if (Math.abs(clampedTimelineHeight - layout.timelineHeightPx) <= 1) {
      return;
    }
    timelinePanel.resize(toPxSize(clampedTimelineHeight));
    setTimelineHeight(clampedTimelineHeight);
  }, [
    layout.timelineCollapsed,
    layout.timelineHeightPx,
    setTimelineHeight,
    timelineHeightBounds.maxPx,
    timelineHeightBounds.minPx,
    toPxSize,
  ]);

  return (
    <div ref={verticalGroupContainerRef} className="h-full min-h-0 overflow-hidden">
      <ResizablePanelGroup
        className="h-full min-h-0 overflow-hidden"
        orientation="vertical"
        onLayoutChanged={commitTimelinePanelLayout}
      >
        <ResizablePanel
          id="workspace-content-pane"
          minSize={toPxSize(workspaceContentMinHeightPx)}
          className="flex min-h-0 overflow-hidden"
        >
          <ResizablePanelGroup
            className="gg-editor-shell min-h-0 flex-1"
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
              className="flex min-h-0 min-w-0 overflow-hidden"
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
              className="flex min-h-0 min-w-0 overflow-hidden"
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
              className="flex min-h-0 min-w-0 overflow-hidden"
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
          aria-valuemin={timelineHeightBounds.minPx}
          aria-valuemax={timelineHeightBounds.maxPx}
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
              resizeTimelineFromKeyboard(timelineHeightBounds.minPx - layout.timelineHeightPx);
              return;
            }
            if (event.key === "End") {
              event.preventDefault();
              resizeTimelineFromKeyboard(timelineHeightBounds.maxPx - layout.timelineHeightPx);
            }
          }}
        />
        <ResizablePanel
          id="workspace-timeline-pane"
          key={timelinePanelKey}
          panelRef={timelinePanelRef}
          defaultSize={layout.timelineCollapsed ? "0px" : toPxSize(layout.timelineHeightPx)}
          minSize={toPxSize(timelineHeightBounds.minPx)}
          maxSize={toPxSize(timelineHeightBounds.maxPx)}
          collapsible
          collapsedSize="0px"
          className="min-h-0 overflow-hidden"
        >
          {bottomPane}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
