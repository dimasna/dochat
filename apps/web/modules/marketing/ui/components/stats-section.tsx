"use client";

import { SectionBadge } from "./section-badge";
import { AnimateCounter } from "./animate-counter";
import { AnimateOnScroll } from "./animate-on-scroll";
import { FrameBox } from "./frame-box";

export const StatsSection = () => (
  <section className="max-w-[1160px] mx-auto px-6">
    <FrameBox corners="bottom" className="py-16 px-8">
      <SectionBadge number="02 / 05" label="Performance" sub="Built to deliver" />

      <AnimateOnScroll>
        <h2 className="text-4xl font-bold text-foreground tracking-tight mb-3">
          Real results, real impact
        </h2>
        <p className="text-muted-foreground text-base mb-12 max-w-[600px]">
          Built from the ground up to deliver exceptional customer experiences.
        </p>
      </AnimateOnScroll>

      <div className="grid md:grid-cols-2 border border-border">
        {/* Resolution rates */}
        <AnimateOnScroll delay={100}>
          <div className="h-full p-8 md:border-r border-b md:border-b-0 border-border">
            <h3 className="text-foreground font-semibold text-lg mb-1.5">
              Instant resolution
            </h3>
            <p className="text-muted-foreground text-sm mb-7 leading-relaxed">
              AI agents resolve most queries without human intervention.
            </p>
            {[
              { name: "Dochat AI", pct: 94, highlight: true },
              { name: "Traditional chatbot", pct: 52, highlight: false },
              { name: "Email support", pct: 28, highlight: false },
            ].map((bar) => (
              <div key={bar.name} className="mb-4">
                <div className="flex justify-between mb-1.5 text-[13px]">
                  <span
                    className={
                      bar.highlight ? "text-primary" : "text-muted-foreground"
                    }
                  >
                    {bar.name}
                  </span>
                  <span
                    className={`font-mono ${bar.highlight ? "text-primary" : "text-muted-foreground"}`}
                  >
                    <AnimateCounter end={bar.pct} suffix="%" />
                  </span>
                </div>
                <div className="bg-muted rounded h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded transition-all duration-[1.5s] ease-out ${
                      bar.highlight ? "bg-primary" : "bg-muted-foreground/20"
                    }`}
                    style={{ width: `${bar.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </AnimateOnScroll>

        {/* Speed metrics */}
        <AnimateOnScroll delay={200}>
          <div className="h-full p-8">
            <h3 className="text-foreground font-semibold text-lg mb-1.5">
              Lightning fast responses
            </h3>
            <p className="text-muted-foreground text-sm mb-7 leading-relaxed">
              Sub-second response times powered by optimized AI inference.
            </p>
            <div className="grid grid-cols-3 gap-px bg-border">
              {[
                { label: "Response", value: 1.2, suffix: "s", sub: "avg latency", decimals: 1 },
                { label: "Uptime", value: 99.9, suffix: "%", sub: "reliability", decimals: 1 },
                { label: "Rating", value: 4.8, suffix: "/5", sub: "avg score", decimals: 1 },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="bg-background p-4 text-center"
                >
                  <div className="text-[11px] text-muted-foreground font-mono uppercase tracking-widest mb-2">
                    {stat.label}
                  </div>
                  <div className="text-2xl font-bold text-primary font-mono">
                    <AnimateCounter
                      end={stat.value}
                      suffix={stat.suffix}
                      decimals={stat.decimals}
                    />
                  </div>
                  <div className="text-[11px] text-muted-foreground/60 mt-1">
                    {stat.sub}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </AnimateOnScroll>
      </div>
    </FrameBox>
  </section>
);
