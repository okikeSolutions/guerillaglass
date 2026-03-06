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
    summary: "For solo creators shipping tutorials, demos, and launch videos every week.",
    features: [
      "Unlimited local projects and exports",
      "Cloud review links with timestamped comments",
      "Up to 5 active review links",
      "Standard support",
    ],
    ctaLabel: "Start Creator Pro",
  },
  {
    name: "Studio",
    price: "$59",
    period: "/month",
    summary: "For freelancers and small production teams managing review-heavy workflows.",
    features: [
      "Everything in Creator Pro",
      "Unlimited review links and collaborator presence",
      "Shared templates and team presets",
      "Priority support",
    ],
    ctaLabel: "Start Studio",
    featured: true,
  },
  {
    name: "Team",
    price: "$149",
    period: "/month",
    summary: "For growing media and product teams that need governance and scale.",
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
            Paid Plans for Creator Teams
          </TimelineAnimation>
          <TimelineAnimation
            animationNum={3}
            timelineRef={timelineRef}
            as="div"
            className="text-white/90 text-pretty max-w-2xl leading-relaxed mx-auto space-y-3"
          >
            <p>
              Placeholder pricing positioned for professional screen recording and review tools.
              There is no free tier.
            </p>
            <p className="text-sm text-white/70">
              Local capture/edit/export remains available in the open-source desktop core. Billing
              unlocks cloud review and collaboration capabilities.
            </p>
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
          Placeholder pricing for go-to-market validation. Final packaging and billing limits may
          adjust before launch.
        </TimelineAnimation>
      </div>
    </section>
  );
};
