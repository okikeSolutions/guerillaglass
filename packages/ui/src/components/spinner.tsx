import { cn } from "../lib/utils";
import { Loader2Icon } from "lucide-react";

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <Loader2Icon
      role={props["aria-label"] ? "status" : undefined}
      aria-hidden={!props["aria-label"]}
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  );
}

export { Spinner };
