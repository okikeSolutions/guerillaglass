"use client";
import React, { useState } from "react";
import { ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@guerillaglass/ui/lib/utils";
import { TimelineAnimation } from "./timeline-animation";

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: "general" | "technical" | "billing" | "account";
  img: string;
}

const FAQ_DATA: FAQItem[] = [
  {
    id: "g1",
    category: "general",
    question: "What problem does Guerilla Glass solve?",
    answer:
      "It helps teams stop stitching together separate tools for recording, editing, exporting, and review when they need to ship clear product videos fast.",
    img: "https://images.unsplash.com/photo-1768280511074-3b3effe7a139?q=80&w=764&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  },
  {
    id: "g2",
    category: "general",
    question: "How does Guerilla Glass solve it?",
    answer:
      "It gives you one local-first desktop workflow for screen capture, timeline editing, review links, comments, and export so the whole video process stays in one place.",
    img: "https://images.unsplash.com/photo-1759269834957-3457c9ee46c7?q=80&w=627&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  },
  {
    id: "t1",
    category: "technical",
    question: "What do I need to do to get started?",
    answer:
      "Download the open-source macOS app if you want local capture and editing. Choose a paid plan when you need cloud review links, comments, and team collaboration.",
    img: "https://images.unsplash.com/photo-1754405300142-246a9bf917d9?q=80&w=627&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  },
  {
    id: "t2",
    category: "technical",
    question: "Which platforms are supported today?",
    answer:
      "Phase 1 production capture and export is macOS 13+. Windows and Linux native engines are in progress with protocol-compatible foundations already in place.",
    img: "https://images.unsplash.com/photo-1738510992679-41f599ec9399?q=80&w=627&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  },
  {
    id: "b1",
    category: "billing",
    question: "Which permissions are required?",
    answer:
      "Screen Recording is required for display/window capture. Microphone and Input Monitoring are requested only when those features are enabled; denied Input Monitoring keeps recording running with click/auto-zoom effects degraded.",
    img: "https://images.unsplash.com/photo-1738510992679-41f599ec9399?q=80&w=627&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  },
  {
    id: "b2",
    category: "billing",
    question: "Do I need a paid plan to capture and export?",
    answer:
      "No. Local capture/edit/export remains available regardless of billing state. Paid tiers map to cloud collaboration and review capabilities.",
    img: "https://images.unsplash.com/photo-1688909906484-738d78601884?q=80&w=764&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  },
];

export const FaqInteractivePreview = () => {
  const timelineRef = React.useRef<HTMLDivElement>(null);
  // @ts-ignore
  const [activeItem, setActiveItem] = useState<FAQItem | null>(FAQ_DATA[0]);

  return (
    <section
      className="min-h-screen w-full flex flex-col justify-center items-center relative bg-black/45"
      ref={timelineRef}
    >
      <TimelineAnimation
        timelineRef={timelineRef}
        animationNum={0}
        as="h1"
        className="text-2xl sm:text-3xl font-medium text-white mb-10 text-center"
      >
        Quick answers before you download or buy
      </TimelineAnimation>
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 px-4 py-12 relative z-10">
        <div className="space-y-4 ">
          {FAQ_DATA.slice(0, 6).map((item) => (
            <motion.button
              key={item.id}
              onMouseEnter={() => setActiveItem(item)}
              onClick={() => setActiveItem(item)}
              className={cn(
                "w-full text-left px-4 py-6 rounded-2xl cursor-pointer transition-shadow duration-300 flex items-center justify-between group",
                activeItem?.id === item.id
                  ? "bg-black/20 backdrop-blur-lg text-white shadow-2xl scale-[1.02]"
                  : "bg-black/20 backdrop-blur-lg text-white hover:bg-black/30",
              )}
            >
              <span className="text-lg font-semibold font-spaceGrotesk">{item.question}</span>
              <ArrowRight
                className={cn(
                  "transition-transform",
                  activeItem?.id === item.id
                    ? "translate-x-0"
                    : "-translate-x-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0",
                )}
              />
            </motion.button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeItem?.id}
            // layoutId={activeItem?.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-black/20 backdrop-blur-lg rounded-xl p-6 relative h-full min-h-[500px] flex flex-col justify-center shadow-[0px_0px_0px_1px_rgba(0,0,0,0.04),0px_1px_1px_0px_rgba(0,0,0,0.05),0px_2px_2px_0px_rgba(0,0,0,0.05),0px_2px_4px_0px_rgba(0,0,0,0.05)]"
          >
            <div className="relative z-10 space-y-4">
              <span className=" text-xs font-semibold uppercase tracking-widest rounded-full text-white inline-block">
                Product FAQ
              </span>
              <h3 className="text-3xl font-semibold font-spaceGrotesk text-white leading-tight">
                {activeItem?.question}
              </h3>
              <p className="text-white leading-relaxed">{activeItem?.answer}</p>
              <img
                src={activeItem?.img}
                alt={activeItem?.question}
                className="aspect-video rounded-lg mt-4 object-cover"
              />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
};
