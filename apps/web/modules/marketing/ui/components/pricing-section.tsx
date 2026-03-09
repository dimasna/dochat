"use client";

import Link from "next/link";
import { Button } from "@workspace/ui/components/button";
import { CheckIcon } from "lucide-react";
import { SectionBadge } from "./section-badge";
import { AnimateOnScroll } from "./animate-on-scroll";
import { FrameBox } from "./frame-box";

const plans = [
  {
    name: "Free",
    price: "$0",
    desc: "100 credits / month",
    features: [
      "100 message credits",
      "1 AI agent",
      "2 knowledge bases",
      "Community support",
    ],
    highlight: false,
  },
  {
    name: "Starter",
    price: "$30",
    desc: "2,000 credits / month",
    features: [
      "2,000 message credits",
      "2 AI agents",
      "5 knowledge bases",
      "20 sources per KB",
    ],
    highlight: false,
  },
  {
    name: "Growth",
    price: "$129",
    desc: "10,000 credits / month",
    features: [
      "10,000 message credits",
      "5 AI agents",
      "10 knowledge bases",
      "Priority support",
    ],
    highlight: true,
  },
  {
    name: "Scale",
    price: "$450",
    desc: "40,000 credits / month",
    features: [
      "40,000 message credits",
      "15 AI agents",
      "25 knowledge bases",
      "Dedicated support",
    ],
    highlight: false,
  },
];

export const PricingSection = () => (
  <section id="pricing" className="max-w-[1160px] mx-auto px-6">
    <FrameBox corners="bottom" className="py-24 px-8">
      <SectionBadge number="03 / 05" label="Pricing" sub="Simple pricing" />

      <AnimateOnScroll>
        <h2 className="text-4xl font-bold text-foreground tracking-tight mb-3">
          Simple, transparent pricing
        </h2>
        <p className="text-muted-foreground text-base mb-12 max-w-[600px]">
          Start free, scale when you need to.
        </p>
      </AnimateOnScroll>

      {/* Plan grid — framed cells */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 border border-border">
        {plans.map((plan, i) => (
          <AnimateOnScroll key={plan.name} delay={i * 80}>
            <div
              className={`relative h-full p-8 ${
                i < plans.length - 1 ? "border-b lg:border-b-0 lg:border-r border-border" : ""
              }`}
            >
              {plan.highlight && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary" />
              )}
              <div className="text-sm text-muted-foreground font-medium mb-2">
                {plan.name}
              </div>
              <div className="flex items-baseline gap-1 mb-1.5">
                <span className="text-[40px] font-bold text-foreground">
                  {plan.price}
                </span>
                <span className="text-muted-foreground text-sm">/mo</span>
              </div>
              <p className="text-muted-foreground text-[13px] mb-6">
                {plan.desc}
              </p>
              <Button
                className="w-full mb-6"
                variant={plan.highlight ? "default" : "outline"}
                asChild
              >
                <Link href="/sign-up">Get started</Link>
              </Button>
              {plan.features.map((f) => (
                <div
                  key={f}
                  className="flex items-center gap-2 mb-2.5 text-[13px] text-muted-foreground"
                >
                  <CheckIcon className="size-3 text-primary shrink-0" />
                  {f}
                </div>
              ))}
            </div>
          </AnimateOnScroll>
        ))}
      </div>

      {/* Enterprise */}
      <AnimateOnScroll delay={350}>
        <div className="border border-border border-t-0 p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="text-sm text-muted-foreground font-medium mb-1">
              Enterprise
            </div>
            <div className="text-foreground font-semibold text-lg">
              Custom pricing for large organizations
            </div>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {[
              "Unlimited credits",
              "Unlimited agents",
              "Custom integrations",
              "Dedicated support",
            ].map((f) => (
              <span
                key={f}
                className="flex items-center gap-2 text-[13px] text-muted-foreground"
              >
                <CheckIcon className="size-3 text-primary" />
                {f}
              </span>
            ))}
          </div>
          <Button variant="outline" asChild className="shrink-0">
            <a href="mailto:support@dochat.site">Contact us</a>
          </Button>
        </div>
      </AnimateOnScroll>
    </FrameBox>
  </section>
);
