"use client";
import { useRef } from "react";
import { Box } from "lucide-react";
import { Button } from "@guerillaglass/ui/components/button";
import { TimelineAnimation } from "./timeline-animation";

interface PricingPlan {
  name: string;
  price: string;
  period: string;
  summary: string;
  features: string[];
  ctaLabel: string;
  featured?: boolean;
}

const PRICING_PLANS: PricingPlan[] = [
  {
    name: "Creator Pro",
    price: "$24",
    period: "/month",
    summary: "For solo makers who need faster recording, editing, and client-ready delivery.",
    features: [
      "Unlimited local projects and exports",
      "Cloud review links with timestamped comments",
      "Up to 5 active review links",
      "Standard support",
    ],
    ctaLabel: "Choose Creator Pro",
  },
  {
    name: "Studio",
    price: "$59",
    period: "/month",
    summary: "For small teams that need one review process instead of endless file handoffs.",
    features: [
      "Everything in Creator Pro",
      "Unlimited review links and collaborator presence",
      "Shared templates and team presets",
      "Priority support",
    ],
    ctaLabel: "Choose Studio",
    featured: true,
  },
  {
    name: "Team",
    price: "$149",
    period: "/month",
    summary: "For larger teams that need seats, governance, and a repeatable delivery workflow.",
    features: [
      "Everything in Studio",
      "Up to 10 seats included",
      "Role-based access controls",
      "Onboarding + SLA support",
    ],
    ctaLabel: "Talk to Sales",
  },
];

export const ProductPacks = () => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const githubUrl = "https://github.com/okikeSolutions/guerillaglass";

  return (
    <section ref={timelineRef} className="py-24 px-6 bg-black/45 text-white min-h-screen">
      <div className="max-w-6xl mx-auto">
        <TimelineAnimation animationNum={1} timelineRef={timelineRef} className="text-center mb-14">
          <TimelineAnimation
            animationNum={2}
            timelineRef={timelineRef}
            as="h1"
            className="text-4xl md:text-5xl font-semibold tracking-tight mb-4 text-white"
          >
            Start with the desktop app. Buy the collaboration layer when you need it.
          </TimelineAnimation>
          <TimelineAnimation
            animationNum={3}
            timelineRef={timelineRef}
            as="div"
            className="text-white/90 text-pretty max-w-2xl leading-relaxed mx-auto space-y-3"
          >
            <p>
              The open-source macOS app covers local capture, editing, and export. Paid plans add
              review links, comments, presence, and team workflows.
            </p>
            <p className="text-sm text-white/70">
              If you just want to record and edit, download the app. If you need approvals and
              collaboration, pick the plan that matches your review volume.
            </p>
            <div className="pt-3">
              <a
                href={githubUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/20"
              >
                Download the open-source app
              </a>
            </div>
          </TimelineAnimation>
        </TimelineAnimation>
        <TimelineAnimation
          animationNum={4}
          timelineRef={timelineRef}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
          {PRICING_PLANS.map((plan, index) => (
            <TimelineAnimation
              key={plan.name}
              animationNum={5 + index}
              timelineRef={timelineRef}
              className={`rounded-3xl p-8 flex flex-col gap-6 transition-all ${
                plan.featured
                  ? "bg-black/60 backdrop-blur-lg ring-2 ring-blue-400/70 shadow-2xl"
                  : "bg-black/20 backdrop-blur-lg ring-1 ring-white/10"
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-2xl font-semibold flex items-center gap-2">
                    <Box className="size-6" strokeWidth={1.5} />
                    {plan.name}
                  </h3>
                  {plan.featured ? (
                    <span className="rounded-full bg-blue-500/20 text-blue-200 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
                      Most Popular
                    </span>
                  ) : null}
                </div>
                <p className="text-sm text-white/70 leading-relaxed">{plan.summary}</p>
              </div>

              <div className="flex items-end gap-2">
                <span className="text-5xl font-semibold">{plan.price}</span>
                <span className="text-white/70 pb-1">{plan.period}</span>
              </div>

              <div className="space-y-3 pt-6 border-t border-white/10">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-3">
                    <span className="text-blue-300 mt-0.5">•</span>
                    <span className="text-sm text-white/85">{feature}</span>
                  </div>
                ))}
              </div>

              <Button
                variant={plan.featured ? "default" : "outline"}
                className={
                  plan.featured
                    ? "h-11 bg-blue-500 hover:bg-blue-400 text-white border-blue-400"
                    : "h-11 border-white/30 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                }
              >
                {plan.ctaLabel}
              </Button>
            </TimelineAnimation>
          ))}
        </TimelineAnimation>

        <TimelineAnimation
          animationNum={9}
          timelineRef={timelineRef}
          as="p"
          className="text-center text-xs text-white/60 mt-8"
        >
          Need a simple rule? Download the app for local work. Buy a paid plan when your workflow
          includes review links, comments, or team collaboration.
        </TimelineAnimation>
      </div>
    </section>
  );
};
