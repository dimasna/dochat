"use client";

import { BotIcon, CodeIcon, MessageCircleIcon } from "lucide-react";
import { SectionBadge } from "./section-badge";
import { AnimateOnScroll } from "./animate-on-scroll";
import { FrameBox } from "./frame-box";

const features = [
  {
    icon: BotIcon,
    title: "Custom AI Agents",
    description:
      "Train AI agents on your knowledge base. Upload docs, websites, or FAQs and your agent learns everything.",
  },
  {
    icon: MessageCircleIcon,
    title: "Live Conversations",
    description:
      "Monitor and manage all customer conversations in real time. Jump in when needed.",
  },
  {
    icon: CodeIcon,
    title: "One-Line Integration",
    description:
      "Add a single script tag to your site. Works with React, Vue, WordPress, anything.",
  },
];

const codeLines = [
  {
    parts: [
      { t: "<!-- ", c: "#6a737d" },
      { t: "Add Dochat to your website", c: "#6a737d" },
      { t: " -->", c: "#6a737d" },
    ],
  },
  {
    parts: [
      { t: "<", c: "#24292e" },
      { t: "script", c: "#0550ae" },
    ],
  },
  {
    parts: [
      { t: "  src", c: "#8250df" },
      { t: '="', c: "#24292e" },
      { t: "https://dochat.site/widget.js", c: "#116329" },
      { t: '"', c: "#24292e" },
    ],
  },
  {
    parts: [
      { t: "  data-agent-id", c: "#8250df" },
      { t: '="', c: "#24292e" },
      { t: "ag_7xK2mPqR9vL4", c: "#116329" },
      { t: '"', c: "#24292e" },
    ],
  },
  { parts: [{ t: "  async", c: "#8250df" }] },
  {
    parts: [
      { t: ">", c: "#24292e" },
      { t: "</", c: "#24292e" },
      { t: "script", c: "#0550ae" },
      { t: ">", c: "#24292e" },
    ],
  },
  { parts: [] },
  {
    parts: [
      { t: "<!-- ", c: "#6a737d" },
      { t: "That's it! Your AI agent is live ", c: "#6a737d" },
      { t: "-->", c: "#6a737d" },
    ],
  },
];

export const FeaturesSection = () => (
  <section id="features" className="max-w-[1160px] mx-auto px-6">
    <FrameBox corners="bottom" className="py-24 px-8">
      <SectionBadge number="01 / 05" label="Features" sub="Built for teams" />

      <AnimateOnScroll>
        <h2 className="text-4xl font-bold text-foreground tracking-tight mb-3">
          Everything you need to automate support
        </h2>
        <p className="text-muted-foreground text-base mb-12 max-w-[600px]">
          From knowledge base to live deployment — powerful features that just
          work.
        </p>
      </AnimateOnScroll>

      {/* Feature cards — framed cells */}
      <div className="grid md:grid-cols-3 mb-12">
        {features.map((f, i) => (
          <AnimateOnScroll key={f.title} delay={i * 100}>
            <div
              className={`h-full p-7 border-b border-border md:border-b-0 ${
                i < features.length - 1 ? "md:border-r" : ""
              }`}
            >
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4">
                <f.icon className="size-5" />
              </div>
              <h3 className="text-foreground font-semibold text-base mb-2">
                {f.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {f.description}
              </p>
            </div>
          </AnimateOnScroll>
        ))}
      </div>

      {/* Code + Chat output — framed panels */}
      <AnimateOnScroll delay={300}>
        <div className="grid md:grid-cols-2 border border-border">
          {/* Code panel */}
          <div className="p-5 font-mono text-[13px] leading-[1.8] overflow-x-auto md:border-r border-b md:border-b-0 border-border">
            <div className="flex gap-1.5 mb-3.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
              <span className="ml-3 text-[11px] text-muted-foreground">
                index.html
              </span>
            </div>
            {codeLines.map((line, i) => (
              <div key={i} className="flex gap-4" style={{ minHeight: 22 }}>
                <span className="text-muted-foreground/40 min-w-5 text-right select-none">
                  {i + 1}
                </span>
                <span>
                  {line.parts.map((p, j) => (
                    <span key={j} style={{ color: p.c }}>
                      {p.t}
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>

          {/* Chat output panel */}
          <div className="p-5">
            <div className="flex gap-1.5 mb-3.5 items-center">
              <span className="bg-primary/15 text-primary px-2.5 py-0.5 rounded text-[11px] font-mono">
                preview
              </span>
              <span className="ml-auto text-muted-foreground/40 text-[11px] font-mono">
                live
              </span>
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex gap-2.5">
                <span className="text-primary text-xs font-mono mt-0.5 shrink-0">
                  AI
                </span>
                <span className="text-muted-foreground">
                  Hi! How can I help you today?
                </span>
              </div>
              <div className="flex justify-end">
                <span className="bg-primary/10 text-foreground px-3 py-1.5 rounded-lg text-sm">
                  How do I reset my password?
                </span>
              </div>
              <div className="flex gap-2.5">
                <span className="text-primary text-xs font-mono mt-0.5 shrink-0">
                  AI
                </span>
                <span className="text-muted-foreground">
                  You can reset your password by going to Settings &rarr; Security
                  &rarr; Change Password. Would you like me to guide you through
                  it?
                </span>
              </div>
              <div className="flex gap-2.5">
                <span className="text-primary text-xs font-mono mt-0.5 shrink-0">
                  AI
                </span>
                <span className="flex items-center gap-1">
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40"
                    style={{ animation: "typing-dot 1.4s infinite 0s" }}
                  />
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40"
                    style={{ animation: "typing-dot 1.4s infinite 0.2s" }}
                  />
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40"
                    style={{ animation: "typing-dot 1.4s infinite 0.4s" }}
                  />
                </span>
              </div>
            </div>
          </div>
        </div>
      </AnimateOnScroll>
    </FrameBox>
  </section>
);
