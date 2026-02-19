import { type CSSProperties, type MouseEvent, type ReactNode, useCallback } from "react";
import { useStudio } from "../studio/context";

type EditorWorkspaceProps = {
  leftPane: ReactNode;
  centerPane: ReactNode;
  rightPane: ReactNode;
};

export function EditorWorkspace({ leftPane, centerPane, rightPane }: EditorWorkspaceProps) {
  const studio = useStudio();

  const startPaneResize = useCallback(
    (side: "left" | "right", event: MouseEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
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

      const onMouseMove = (moveEvent: globalThis.MouseEvent) => {
        const delta = moveEvent.clientX - startX;
        const nextWidth = side === "left" ? initialWidth + delta : initialWidth - delta;
        if (side === "left") {
          studio.setLeftPaneWidth(nextWidth);
        } else {
          studio.setRightPaneWidth(nextWidth);
        }
      };

      const onMouseUp = () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [studio],
  );

  const style = {
    "--gg-left-pane-width": `${studio.layout.leftCollapsed ? 0 : studio.layout.leftPaneWidthPx}px`,
    "--gg-right-pane-width": `${studio.layout.rightCollapsed ? 0 : studio.layout.rightPaneWidthPx}px`,
    "--gg-left-splitter-width": studio.layout.leftCollapsed ? "0px" : "6px",
    "--gg-right-splitter-width": studio.layout.rightCollapsed ? "0px" : "6px",
  } as CSSProperties;

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
        onMouseDown={(event) => startPaneResize("left", event)}
        role="separator"
        aria-label={studio.ui.labels.resizeLeftPane}
        aria-orientation="vertical"
      />
      {centerPane}
      <div
        className="gg-pane-resize-handle"
        data-disabled={studio.layout.rightCollapsed}
        onMouseDown={(event) => startPaneResize("right", event)}
        role="separator"
        aria-label={studio.ui.labels.resizeRightPane}
        aria-orientation="vertical"
      />
      {rightPane}
    </section>
  );
}
