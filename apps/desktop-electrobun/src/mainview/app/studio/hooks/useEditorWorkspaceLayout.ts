import {
  type KeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { PanelImperativeHandle } from "react-resizable-panels";
import { useStudio } from "../state/StudioProvider";
import {
  rebalanceStudioHorizontalPanesForViewport,
  resolveStudioCenterPaneMinWidthForViewport,
  studioLayoutBounds,
} from "../model/studioLayoutModel";

type SizeBounds = {
  minPx: number;
  maxPx: number;
};

type ResizeAxis = "horizontal" | "vertical";

type ResizeHandleKeyDownConfig = {
  axis: ResizeAxis;
  stepPx: number;
  largeStepPx: number;
  invertArrows?: boolean;
  onStep: (deltaPx: number) => void;
  onHome: () => void;
  onEnd: () => void;
};

type ResizeHandleKeyDownEvent = Pick<
  KeyboardEvent<HTMLElement>,
  "key" | "shiftKey" | "preventDefault"
>;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function toPxSize(value: number): string {
  return `${Math.max(value, 0)}px`;
}

function useObservedElementHeight(ref: RefObject<HTMLElement | null>): number | null {
  const [heightPx, setHeightPx] = useState<number | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const updateHeight = () => {
      setHeightPx(Math.round(element.getBoundingClientRect().height));
    };

    updateHeight();
    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return heightPx;
}

function useObservedElementWidth(ref: RefObject<HTMLElement | null>): number | null {
  const [widthPx, setWidthPx] = useState<number | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const updateWidth = () => {
      setWidthPx(Math.round(element.getBoundingClientRect().width));
    };

    updateWidth();
    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return widthPx;
}

function usePointerResizeState() {
  const isPointerResizingRef = useRef(false);

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

  return {
    isPointerResizingRef,
    markPointerResizeStart,
  };
}

function resolveTimelineHeightBounds(
  verticalGroupHeightPx: number | null,
  workspaceContentMinHeightPx: number,
  timelineHandleHeightPx: number,
): SizeBounds {
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
}

function syncPanelFromLayout(
  panel: PanelImperativeHandle,
  collapsed: boolean,
  targetSizePx: number,
): void {
  if (collapsed) {
    if (!panel.isCollapsed()) {
      panel.collapse();
    }
    return;
  }

  if (panel.isCollapsed()) {
    panel.expand();
  }
  const currentSizePx = panel.getSize().inPixels;
  if (Math.abs(currentSizePx - targetSizePx) > 1) {
    panel.resize(toPxSize(targetSizePx));
  }
}

export function createResizeHandleKeyDown({
  axis,
  stepPx,
  largeStepPx,
  invertArrows = false,
  onStep,
  onHome,
  onEnd,
}: ResizeHandleKeyDownConfig): (event: ResizeHandleKeyDownEvent) => void {
  const decreaseKey = axis === "horizontal" ? "ArrowLeft" : "ArrowDown";
  const increaseKey = axis === "horizontal" ? "ArrowRight" : "ArrowUp";

  return (event) => {
    const step = event.shiftKey ? largeStepPx : stepPx;

    if (event.key === decreaseKey) {
      event.preventDefault();
      onStep(invertArrows ? step : -step);
      return;
    }

    if (event.key === increaseKey) {
      event.preventDefault();
      onStep(invertArrows ? -step : step);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      onHome();
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      onEnd();
    }
  };
}

export function useEditorWorkspaceLayout() {
  const studio = useStudio();
  const layout = studio.layout;
  const workspaceContentPreferredMinHeightPx = 220;
  const timelineHandleHeightPx = 10;
  const resizeStepPx = 8;
  const resizeStepPxLarge = 32;
  const timelineResizeStepPx = 8;
  const timelineResizeStepPxLarge = 32;

  const verticalGroupContainerRef = useRef<HTMLDivElement | null>(null);
  const verticalGroupWidthPx = useObservedElementWidth(verticalGroupContainerRef);
  const verticalGroupHeightPx = useObservedElementHeight(verticalGroupContainerRef);
  const leftPanelRef = useRef<PanelImperativeHandle | null>(null);
  const rightPanelRef = useRef<PanelImperativeHandle | null>(null);
  const timelinePanelRef = useRef<PanelImperativeHandle | null>(null);

  const { isPointerResizingRef, markPointerResizeStart } = usePointerResizeState();

  const workspaceContentMinHeightPx =
    verticalGroupHeightPx == null
      ? workspaceContentPreferredMinHeightPx
      : Math.min(
          workspaceContentPreferredMinHeightPx,
          Math.max(
            0,
            verticalGroupHeightPx - timelineHandleHeightPx - studioLayoutBounds.timelineMinHeightPx,
          ),
        );

  const timelineHeightBounds = resolveTimelineHeightBounds(
    verticalGroupHeightPx,
    workspaceContentMinHeightPx,
    timelineHandleHeightPx,
  );

  const timelineHeightPx = clamp(
    layout.timelineHeightPx,
    timelineHeightBounds.minPx,
    timelineHeightBounds.maxPx,
  );
  const centerPaneMinWidthPx = resolveStudioCenterPaneMinWidthForViewport(
    verticalGroupWidthPx ?? Number.NaN,
  );

  const leftPanelKey = layout.leftCollapsed ? "left-collapsed" : "left-expanded";
  const rightPanelKey = layout.rightCollapsed ? "right-collapsed" : "right-expanded";
  const timelinePanelKey = layout.timelineCollapsed ? "timeline-collapsed" : "timeline-expanded";

  const commitHorizontalPanelLayout = useCallback(() => {
    if (!isPointerResizingRef.current) {
      return;
    }

    const leftPanel = leftPanelRef.current;
    const rightPanel = rightPanelRef.current;
    if (!leftPanel || !rightPanel) {
      return;
    }

    const leftSizePx = Math.round(leftPanel.getSize().inPixels);
    const rightSizePx = Math.round(rightPanel.getSize().inPixels);
    const leftCollapsed = leftPanel.isCollapsed() || leftSizePx <= 1;
    const rightCollapsed = rightPanel.isCollapsed() || rightSizePx <= 1;

    if (leftCollapsed !== layout.leftCollapsed) {
      studio.setLeftPaneCollapsed(leftCollapsed);
    }
    if (rightCollapsed !== layout.rightCollapsed) {
      studio.setRightPaneCollapsed(rightCollapsed);
    }

    if (!leftCollapsed) {
      const nextLeftWidth = clamp(
        leftSizePx,
        studioLayoutBounds.leftPaneMinWidthPx,
        studioLayoutBounds.leftPaneMaxWidthPx,
      );
      if (Math.abs(nextLeftWidth - layout.leftPaneWidthPx) > 1) {
        studio.setLeftPaneWidth(nextLeftWidth);
      }
    }

    if (!rightCollapsed) {
      const nextRightWidth = clamp(
        rightSizePx,
        studioLayoutBounds.rightPaneMinWidthPx,
        studioLayoutBounds.rightPaneMaxWidthPx,
      );
      if (Math.abs(nextRightWidth - layout.rightPaneWidthPx) > 1) {
        studio.setRightPaneWidth(nextRightWidth);
      }
    }
  }, [isPointerResizingRef, layout, studio]);

  const commitTimelinePanelLayout = useCallback(() => {
    if (!isPointerResizingRef.current) {
      return;
    }

    const timelinePanel = timelinePanelRef.current;
    if (!timelinePanel) {
      return;
    }

    const timelineSizePx = Math.round(timelinePanel.getSize().inPixels);
    const timelineCollapsed = timelinePanel.isCollapsed() || timelineSizePx <= 1;

    if (timelineCollapsed !== layout.timelineCollapsed) {
      studio.setTimelineCollapsed(timelineCollapsed);
    }

    if (!timelineCollapsed) {
      const nextTimelineHeight = clamp(
        timelineSizePx,
        timelineHeightBounds.minPx,
        timelineHeightBounds.maxPx,
      );
      if (Math.abs(nextTimelineHeight - layout.timelineHeightPx) > 1) {
        studio.setTimelineHeight(nextTimelineHeight);
      }
    }
  }, [
    isPointerResizingRef,
    layout.timelineCollapsed,
    layout.timelineHeightPx,
    studio,
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
        studio.setLeftPaneCollapsed(false);
        leftPanel.expand();
      }

      leftPanel.resize(toPxSize(nextWidth));
      studio.setLeftPaneWidth(nextWidth);
    },
    [layout.leftCollapsed, layout.leftPaneWidthPx, studio],
  );

  const resizeRightPaneFromKeyboard = useCallback(
    (deltaPx: number) => {
      const rightPanel = rightPanelRef.current;
      if (!rightPanel) {
        return;
      }

      const nextWidth = layout.rightPaneWidthPx + deltaPx;
      if (layout.rightCollapsed) {
        studio.setRightPaneCollapsed(false);
        rightPanel.expand();
      }

      rightPanel.resize(toPxSize(nextWidth));
      studio.setRightPaneWidth(nextWidth);
    },
    [layout.rightCollapsed, layout.rightPaneWidthPx, studio],
  );

  const resizeTimelineFromKeyboard = useCallback(
    (deltaPx: number) => {
      const timelinePanel = timelinePanelRef.current;
      if (!timelinePanel) {
        return;
      }

      if (layout.timelineCollapsed) {
        studio.setTimelineCollapsed(false);
        timelinePanel.expand();
      }

      const nextHeight = clamp(
        timelineHeightPx + deltaPx,
        timelineHeightBounds.minPx,
        timelineHeightBounds.maxPx,
      );

      timelinePanel.resize(toPxSize(nextHeight));
      studio.setTimelineHeight(nextHeight);
    },
    [
      layout.timelineCollapsed,
      studio,
      timelineHeightBounds.maxPx,
      timelineHeightBounds.minPx,
      timelineHeightPx,
    ],
  );

  const leftResizeKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      createResizeHandleKeyDown({
        axis: "horizontal",
        stepPx: resizeStepPx,
        largeStepPx: resizeStepPxLarge,
        onStep: resizeLeftPaneFromKeyboard,
        onHome: () =>
          resizeLeftPaneFromKeyboard(
            studioLayoutBounds.leftPaneMinWidthPx - layout.leftPaneWidthPx,
          ),
        onEnd: () =>
          resizeLeftPaneFromKeyboard(
            studioLayoutBounds.leftPaneMaxWidthPx - layout.leftPaneWidthPx,
          ),
      })(event);
    },
    [layout.leftPaneWidthPx, resizeLeftPaneFromKeyboard, resizeStepPx, resizeStepPxLarge],
  );

  const rightResizeKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      createResizeHandleKeyDown({
        axis: "horizontal",
        stepPx: resizeStepPx,
        largeStepPx: resizeStepPxLarge,
        invertArrows: true,
        onStep: resizeRightPaneFromKeyboard,
        onHome: () =>
          resizeRightPaneFromKeyboard(
            studioLayoutBounds.rightPaneMinWidthPx - layout.rightPaneWidthPx,
          ),
        onEnd: () =>
          resizeRightPaneFromKeyboard(
            studioLayoutBounds.rightPaneMaxWidthPx - layout.rightPaneWidthPx,
          ),
      })(event);
    },
    [layout.rightPaneWidthPx, resizeRightPaneFromKeyboard, resizeStepPx, resizeStepPxLarge],
  );

  const timelineResizeKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      createResizeHandleKeyDown({
        axis: "vertical",
        stepPx: timelineResizeStepPx,
        largeStepPx: timelineResizeStepPxLarge,
        onStep: resizeTimelineFromKeyboard,
        onHome: () => resizeTimelineFromKeyboard(timelineHeightBounds.minPx - timelineHeightPx),
        onEnd: () => resizeTimelineFromKeyboard(timelineHeightBounds.maxPx - timelineHeightPx),
      })(event);
    },
    [
      resizeTimelineFromKeyboard,
      timelineHeightBounds.maxPx,
      timelineHeightBounds.minPx,
      timelineHeightPx,
      timelineResizeStepPx,
      timelineResizeStepPxLarge,
    ],
  );

  useEffect(() => {
    if (verticalGroupWidthPx == null) {
      return;
    }

    const leftPanel = leftPanelRef.current;
    const rightPanel = rightPanelRef.current;
    if (!leftPanel || !rightPanel) {
      return;
    }

    const measuredLeftPaneWidthPx = layout.leftCollapsed
      ? 0
      : Math.round(leftPanel.getSize().inPixels);
    const measuredRightPaneWidthPx = layout.rightCollapsed
      ? 0
      : Math.round(rightPanel.getSize().inPixels);
    const rebalanced = rebalanceStudioHorizontalPanesForViewport(
      {
        leftPaneWidthPx: measuredLeftPaneWidthPx,
        rightPaneWidthPx: measuredRightPaneWidthPx,
        leftCollapsed: layout.leftCollapsed,
        rightCollapsed: layout.rightCollapsed,
      },
      verticalGroupWidthPx,
    );

    if (
      !layout.leftCollapsed &&
      Math.abs(rebalanced.leftPaneWidthPx - measuredLeftPaneWidthPx) > 1
    ) {
      leftPanel.resize(toPxSize(rebalanced.leftPaneWidthPx));
      studio.setLeftPaneWidth(rebalanced.leftPaneWidthPx);
    }
    if (
      !layout.rightCollapsed &&
      Math.abs(rebalanced.rightPaneWidthPx - measuredRightPaneWidthPx) > 1
    ) {
      rightPanel.resize(toPxSize(rebalanced.rightPaneWidthPx));
      studio.setRightPaneWidth(rebalanced.rightPaneWidthPx);
    }
  }, [layout.leftCollapsed, layout.rightCollapsed, studio, verticalGroupWidthPx]);

  useEffect(() => {
    const leftPanel = leftPanelRef.current;
    if (!leftPanel) {
      return;
    }

    const nextWidth = clamp(
      layout.leftPaneWidthPx,
      studioLayoutBounds.leftPaneMinWidthPx,
      studioLayoutBounds.leftPaneMaxWidthPx,
    );
    syncPanelFromLayout(leftPanel, layout.leftCollapsed, nextWidth);
  }, [layout.leftCollapsed, layout.leftPaneWidthPx]);

  useEffect(() => {
    const rightPanel = rightPanelRef.current;
    if (!rightPanel) {
      return;
    }

    const nextWidth = clamp(
      layout.rightPaneWidthPx,
      studioLayoutBounds.rightPaneMinWidthPx,
      studioLayoutBounds.rightPaneMaxWidthPx,
    );
    syncPanelFromLayout(rightPanel, layout.rightCollapsed, nextWidth);
  }, [layout.rightCollapsed, layout.rightPaneWidthPx]);

  useEffect(() => {
    const timelinePanel = timelinePanelRef.current;
    if (!timelinePanel) {
      return;
    }

    syncPanelFromLayout(timelinePanel, layout.timelineCollapsed, timelineHeightPx);
  }, [layout.timelineCollapsed, timelineHeightPx]);

  return {
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
  };
}
