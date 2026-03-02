import * as React from "react";

export function RevealOnScroll({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      node.classList.add("is-visible");
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          node.classList.add("is-visible");
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.15 },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  return (
    <div className={["reveal-block", className].filter(Boolean).join(" ")} ref={ref}>
      {children}
    </div>
  );
}
