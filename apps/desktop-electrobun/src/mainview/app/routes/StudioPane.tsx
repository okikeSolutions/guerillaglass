import type { ComponentProps, ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

type StudioPaneProps<T extends ElementType> = {
  as?: T;
  side: "left" | "center" | "right";
  children: ReactNode;
  className?: string;
} & Omit<ComponentProps<T>, "as" | "children" | "className">;

export function StudioPane<T extends ElementType = "aside">({
  as,
  side,
  children,
  className,
  ...props
}: StudioPaneProps<T>) {
  const Component = (as ?? "aside") as ElementType;
  return (
    <Component
      className={cn(
        "gg-pane",
        side === "left" && "gg-pane-left",
        side === "center" && "gg-pane-center",
        side === "right" && "gg-pane-right",
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

export function StudioPaneHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("gg-pane-header", className)} {...props} />;
}

export function StudioPaneTitle({ className, ...props }: ComponentProps<"h2">) {
  return <h2 className={cn("gg-pane-title", className)} {...props} />;
}

export function StudioPaneSubtitle({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("gg-pane-subtitle", className)} {...props} />;
}

export function StudioPaneBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("gg-pane-body", className)} {...props} />;
}
