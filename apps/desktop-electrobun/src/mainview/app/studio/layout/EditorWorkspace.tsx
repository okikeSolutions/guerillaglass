import type { ReactNode } from "react";
import { Button } from "@guerillaglass/ui/components/button";
import * as m from "../../../../paraglide/messages.js";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@guerillaglass/ui/components/resizable";
import { studioLayoutBounds } from "../contracts/studioLayoutModel";
import { useEditorWorkspaceLayout } from "../hooks/useEditorWorkspaceLayout";

type EditorWorkspaceProps = {
  leftPane: ReactNode;
  centerPane: ReactNode;
  rightPane: ReactNode;
  bottomPane?: ReactNode | null;
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
    <div ref={verticalGroupContainerRef} className="flex h-full min-h-0 flex-col overflow-hidden">
      {layout.leftCollapsed || layout.rightCollapsed ? (
        <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
          {layout.leftCollapsed ? (
            <Button size="sm" variant="outline" onClick={studio.toggleLeftPaneCollapsed}>
              {m.ui_restore_project_panel(undefined, { locale: studio.locale })}
            </Button>
          ) : null}
          {layout.rightCollapsed ? (
            <Button
              size="sm"
              variant="outline"
              className="ml-auto"
              onClick={studio.toggleRightPaneCollapsed}
            >
              {m.ui_restore_inspector(undefined, { locale: studio.locale })}
            </Button>
          ) : null}
        </div>
      ) : null}
      <ResizablePanelGroup
        className="min-h-0 flex-1 overflow-hidden"
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
              inert={layout.leftCollapsed}
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
              inert={layout.rightCollapsed}
              className="flex min-h-0 min-w-0 overflow-hidden"
            >
              {rightPane}
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>

        {bottomPane ? (
          <>
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
              inert={layout.timelineCollapsed}
              className="min-h-0 overflow-hidden"
            >
              {bottomPane}
            </ResizablePanel>
          </>
        ) : null}
      </ResizablePanelGroup>
      {bottomPane && layout.timelineCollapsed ? (
        <div className="flex shrink-0 justify-center border-t px-3 py-2">
          <Button size="sm" variant="outline" onClick={studio.toggleTimelineCollapsed}>
            {m.ui_restore_timeline(undefined, { locale: studio.locale })}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
