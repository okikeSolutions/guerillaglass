import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../components/collapsible";
import { cn } from "../lib/utils";

type DesktopPanelSectionProps = {
  title: ReactNode;
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
};

function DesktopPanelSection({
  title,
  children,
  className,
  defaultOpen = false,
}: DesktopPanelSectionProps) {
  return (
    <Collapsible defaultOpen={defaultOpen} className={cn("gg-inspector-section", className)}>
      <CollapsibleTrigger className="gg-inspector-section-trigger">
        <ChevronRight className="gg-inspector-section-chevron" />
        <h3 className="gg-inspector-section-header border-0 pb-0">{title}</h3>
      </CollapsibleTrigger>
      <CollapsibleContent className="gg-inspector-section-content">
        <div className="gg-inspector-section-body">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export { DesktopPanelSection };
export type { DesktopPanelSectionProps };
