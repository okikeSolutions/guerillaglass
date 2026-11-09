import { type HTMLMotionProps, motion, useReducedMotion } from "motion/react";
import type React from "react";
import type { Variants } from "motion/react";

type TimelineContentProps<T extends keyof HTMLElementTagNameMap> = {
  children?: React.ReactNode;
  animationNum: number;
  className?: string;
  timelineRef: React.RefObject<HTMLElement | null>;
  as?: T;
  customVariants?: Variants;
  once?: boolean;
} & HTMLMotionProps<T>;

// Retained for independent callers. Content is available on the first render;
// sequence numbers no longer delay access to text or actions.
export const TimelineAnimation = <T extends keyof HTMLElementTagNameMap = "div">({
  children,
  animationNum: _animationNum,
  timelineRef: _timelineRef,
  className,
  as,
  customVariants,
  once: _once = true,
  ...props
}: TimelineContentProps<T>) => {
  const reducedMotion = useReducedMotion();
  const MotionComponent = motion[as || "div"] as React.ElementType;
  return (
    <MotionComponent
      {...props}
      initial={false}
      animate="visible"
      variants={reducedMotion ? undefined : customVariants}
      className={className}
    >
      {children}
    </MotionComponent>
  );
};
