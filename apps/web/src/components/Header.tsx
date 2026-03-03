import { TimelineAnimation } from "./timeline-animation";
import { useRef } from "react";
import { useMediaQuery } from "#/hooks/use-media-query";

export default function Header() {
  const timelineRef = useRef<HTMLDivElement>(null);
  const isMobile = useMediaQuery("(max-width: 768px)");

  return (
    <section
      ref={timelineRef}
      className="relative min-h-screen bg-black text-white overflow-hidden flex flex-col"
    >
      {!isMobile && (
        <header className="relative z-10 flex items-center justify-between px-10 p-4">
          <TimelineAnimation
            once={true}
            animationNum={1}
            timelineRef={timelineRef}
            className="flex items-center gap-2"
          >
            <svg
              className="fill-white w-8 h-8"
              width="97"
              height="108"
              viewBox="0 0 97 108"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M55.5 0C61.0005 0.00109895 64.5005 2.50586 64.5 7.5V17C64.5 24.5059 68.5005 27.5 81 27.5H88C94.0005 27.5059 96.5 29.5059 96.5 37.5V98.5C96.5 106.006 95.0005 107.5 88 107.5H41.5C36.5005 107.5 32 104.506 32 98.5V88C32 84.5 28.5 80 20.5 80H8.5C3 80 0 76.5 0 71.5V6.5C0.00048844 1.50586 2.50049 0.00585937 8.5 0H55.5ZM31 20C28.7909 20 27 21.7909 27 24V74C27 76.2091 28.7909 78 31 78H58C60.2091 78 62 76.2091 62 74V24C62 21.7909 60.2091 20 58 20H31Z" />
            </svg>
          </TimelineAnimation>

          <TimelineAnimation
            once={true}
            as="nav"
            animationNum={2}
            timelineRef={timelineRef}
            className="hidden md:flex items-center gap-12 text-sm text-white font-medium"
          >
            <a href="#" className="hover:text-white transition">
              Record
            </a>
            <a href="#" className="hover:text-white transition">
              Edit
            </a>
            <a href="#" className="hover:text-white transition">
              Deliver
            </a>
            <a href="#" className="hover:text-white transition">
              Pricing
            </a>
          </TimelineAnimation>
          <TimelineAnimation
            once={true}
            as="button"
            animationNum={3}
            timelineRef={timelineRef}
            className="flex items-center gap-2 w-fit px-8 py-4 rounded-full font-bold text-lg bg-neutral-800 text-white"
          >
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            <span className="text-sm font-medium">Download</span>
          </TimelineAnimation>
        </header>
      )}
    </section>
  );
}
