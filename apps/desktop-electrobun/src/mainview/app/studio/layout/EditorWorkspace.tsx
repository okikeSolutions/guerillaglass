import type { ReactNode } from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { studioLayoutBounds } from "../model/studioLayoutModel";
import { useEditorWorkspaceLayout } from "../hooks/useEditorWorkspaceLayout";

type EditorWorkspaceProps = {
  leftPane: ReactNode;
  centerPane: ReactNode;
  rightPane: ReactNode;
  bottomPane: ReactNode;
};

function toPxSize(value: number): string {
  return `${Math.max(value, 0)}px`;
}

export function EditorWorkspace({
  leftPane,
  centerPane,
  rightPane,
  bottomPane,
}: EditorWorkspaceProps) {
  const {
    studio,
    layout,
    verticalGroupContainerRef,
    leftPanelRef,
    rightPanelRef,
    timelinePanelRef,
    workspaceContentMinHeightPx,
    timelineHeightBounds,
    timelineHeightPx,
    centerPaneMinWidthPx,
    leftPanelKey,
    rightPanelKey,
    timelinePanelKey,
    markPointerResizeStart,
    commitHorizontalPanelLayout,
    commitTimelinePanelLayout,
    leftResizeKeyDown,
    rightResizeKeyDown,
    timelineResizeKeyDown,
  } = useEditorWorkspaceLayout();

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
              onKeyDown={leftResizeKeyDown}
            />
            <ResizablePanel
              id="editor-center-pane"
              minSize={toPxSize(centerPaneMinWidthPx)}
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
              onKeyDown={rightResizeKeyDown}
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
          aria-valuenow={layout.timelineCollapsed ? 0 : timelineHeightPx}
          onKeyDown={timelineResizeKeyDown}
        />

        <ResizablePanel
          id="workspace-timeline-pane"
          key={timelinePanelKey}
          panelRef={timelinePanelRef}
          defaultSize={layout.timelineCollapsed ? "0px" : toPxSize(timelineHeightPx)}
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
