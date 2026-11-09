import { useId, useRef, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import * as m from "../paraglide/messages.js";

// Native modal dialogs provide focus containment, background inertness and Escape.
export default function MotionDrawer({ children }: { children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  return (
    <>
      <button
        className="site-menu-button"
        type="button"
        ref={trigger}
        aria-label={m.web_ui_menu_open()}
        aria-haspopup="dialog"
        onClick={() => dialog.current?.showModal()}
      >
        <Menu aria-hidden="true" size={22} />
      </button>
      <dialog
        className="site-menu-dialog"
        ref={dialog}
        aria-labelledby={titleId}
        onClose={() => trigger.current?.focus()}
        onKeyDown={(event) => {
          if (event.key !== "Tab") {
            return;
          }
          const controls = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled),a[href]"),
          );
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            dialog.current?.close();
          }
        }}
      >
        <div className="site-menu-panel">
          <div className="site-menu-heading">
            <h2 id={titleId}>{m.web_ui_menu_title()}</h2>
            <button
              className="site-menu-button"
              type="button"
              aria-label={m.web_ui_menu_close()}
              onClick={() => dialog.current?.close()}
            >
              <X aria-hidden="true" size={22} />
            </button>
          </div>
          <div
            onClick={(event) => {
              const target = event.target as Element | null;
              if (typeof target?.closest === "function" && target.closest("a[href]")) {
                dialog.current?.close();
              }
            }}
          >
            {children}
          </div>
        </div>
      </dialog>
    </>
  );
}
