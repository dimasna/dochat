"use client";

import { SectionBadge } from "./section-badge";
import { AnimateOnScroll } from "./animate-on-scroll";
import { FrameBox } from "./frame-box";

const testimonials = [
  {
    name: "Sarah Chen",
    handle: "@sarahchen",
    text: "We switched to Dochat and our support resolution time dropped by 70%. The AI actually understands our product.",
  },
  {
    name: "Marcus Rivera",
    handle: "@marcusdev",
    text: "Integration took 5 minutes. Five. Minutes. Our chatbot was live and answering questions before I finished my coffee.",
  },
  {
    name: "Emma Watson",
    handle: "@emmawatson_io",
    text: "The knowledge base feature is incredible. Upload docs and the AI just knows everything. Our customers love it.",
  },
  {
    name: "James Liu",
    handle: "@jamesliu",
    text: "We replaced our expensive support team with Dochat for basic queries. Saved $4k/month and improved response times.",
  },
  {
    name: "Priya Patel",
    handle: "@priyapatel",
    text: "Dochat handles 80% of our customer queries without any human intervention. Game changer for a small team.",
  },
  {
    name: "Alex Thompson",
    handle: "@alexthompson",
    text: "The live conversation monitoring is a killer feature. We can jump in anytime the AI needs help. Best of both worlds.",
  },
];

export const TestimonialsSection = () => (
  <section className="relative z-10 max-w-[1160px] mx-auto px-6">
    <FrameBox corners="bottom" className="py-24 px-8">
      <SectionBadge number="04 / 05" label="Testimonials" sub="Community" />

      <AnimateOnScroll>
        <h2 className="text-4xl font-bold text-foreground tracking-tight mb-12">
          Teams love building with Dochat
        </h2>
      </AnimateOnScroll>

      {/* Marquee inside the frame */}
      <div className="overflow-x-clip -mx-8 py-2">
        <div
          className="flex gap-5 w-max px-8"
          style={{ animation: "marquee 35s linear infinite" }}
        >
          {[...testimonials, ...testimonials].map((t, i) => (
            <div
              key={`${t.name}-${i}`}
              className="border border-border p-6 min-w-[300px] max-w-[340px] shrink-0"
            >
              <div className="flex items-center gap-3 mb-3.5">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-base font-bold text-primary">
                  {t.name[0]}
                </div>
                <div>
                  <div className="text-foreground font-semibold text-sm">
                    {t.name}
                  </div>
                  <div className="text-muted-foreground text-xs">{t.handle}</div>
                </div>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">
                &ldquo;{t.text}&rdquo;
              </p>
            </div>
          ))}
        </div>
      </div>
    </FrameBox>
  </section>
);
