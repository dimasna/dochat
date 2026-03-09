"use client";

import Link from "next/link";
import { Button } from "@workspace/ui/components/button";
import { ArrowRightIcon } from "lucide-react";
import { AnimateOnScroll } from "./animate-on-scroll";

const chatMessages = [
  { role: "ai" as const, text: "Hi! How can I help you today?" },
  { role: "user" as const, text: "How do I reset my password?" },
  {
    role: "ai" as const,
    text: "Go to Settings \u2192 Security \u2192 Change Password. Want me to walk you through it?",
  },
  { role: "user" as const, text: "Yes please!" },
];

export const HeroSection = () => (
  <section className="relative overflow-hidden">
    {/* Full-width grid background */}
    <div
      className="pointer-events-none absolute inset-0 opacity-[0.45]"
      style={{
        backgroundImage: `
          linear-gradient(to right, var(--color-border) 1px, transparent 1px),
          linear-gradient(to bottom, var(--color-border) 1px, transparent 1px)
        `,
        backgroundSize: "60px 60px",
      }}
    />
    {/* Radial fade */}
    <div
      className="pointer-events-none absolute inset-0"
      style={{
        background:
          "radial-gradient(ellipse 50% 55% at 50% 50%, var(--color-background) 30%, transparent 100%)",
      }}
    />

    <div className="relative max-w-[1160px] mx-auto px-6 pt-20 pb-16 md:pt-28 md:pb-20">
      <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
        {/* Left — text */}
        <div>
          <AnimateOnScroll>
            <div className="flex gap-2.5 mb-6 flex-wrap">
              {["OPEN SOURCE", "AI AGENT", "KNOWLEDGE BASE", "24/7"].map((tag) => (
                <span
                  key={tag}
                  className="bg-muted border border-border px-3 py-0.5 rounded-md text-[11px] font-mono text-muted-foreground tracking-widest"
                >
                  {tag}
                </span>
              ))}
            </div>
          </AnimateOnScroll>

          <AnimateOnScroll delay={100}>
            <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-bold leading-[1.1] tracking-tight text-foreground mb-5">
              AI support that{" "}
              <span className="text-primary">gets</span> your business
            </h1>
          </AnimateOnScroll>

          <AnimateOnScroll delay={200}>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed max-w-[440px]">
              Open-source AI chatbots trained on your data. Deploy with one line of code.
            </p>
          </AnimateOnScroll>

          <AnimateOnScroll delay={300}>
            <div className="flex gap-3.5 flex-wrap">
              <Button
                size="lg"
                asChild
                className="h-11 px-7 text-sm shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/25 transition-all hover:-translate-y-px"
              >
                <Link href="/sign-up">
                  Get started free
                  <ArrowRightIcon className="ml-2 size-3.5" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="h-11 px-7 text-sm"
              >
                <a href="mailto:support@dochat.site">Talk to us</a>
              </Button>
            </div>
          </AnimateOnScroll>
        </div>

        {/* Right — chat widget mockup */}
        <AnimateOnScroll delay={200}>
          <div className="border border-border bg-background rounded-2xl shadow-xl shadow-black/5 overflow-hidden max-w-[380px] md:ml-auto">
            {/* Widget header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
              <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold">
                D
              </div>
              <div>
                <div className="text-foreground font-semibold text-sm">
                  Dochat AI
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  <span className="text-muted-foreground text-[11px]">
                    Online
                  </span>
                </div>
              </div>
            </div>

            {/* Chat messages */}
            <div className="px-5 py-4 space-y-3 min-h-[260px]">
              {chatMessages.map((msg, i) =>
                msg.role === "ai" ? (
                  <div key={i} className="flex gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-primary text-[10px] font-bold">
                        AI
                      </span>
                    </div>
                    <div className="bg-muted text-foreground text-sm px-3.5 py-2 rounded-2xl rounded-tl-sm max-w-[85%] leading-relaxed">
                      {msg.text}
                    </div>
                  </div>
                ) : (
                  <div key={i} className="flex justify-end">
                    <div className="bg-primary text-primary-foreground text-sm px-3.5 py-2 rounded-2xl rounded-tr-sm max-w-[85%]">
                      {msg.text}
                    </div>
                  </div>
                ),
              )}
              {/* Typing indicator */}
              <div className="flex gap-2.5">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-primary text-[10px] font-bold">AI</span>
                </div>
                <div className="bg-muted px-3.5 py-2.5 rounded-2xl rounded-tl-sm flex items-center gap-1">
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
                </div>
              </div>
            </div>

            {/* Input bar */}
            <div className="px-4 py-3 border-t border-border">
              <div className="flex items-center gap-2 bg-muted rounded-xl px-4 py-2.5">
                <span className="text-muted-foreground/50 text-sm flex-1">
                  Type a message...
                </span>
                <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                  <ArrowRightIcon className="size-3.5 text-primary-foreground -rotate-90" />
                </div>
              </div>
            </div>
          </div>
        </AnimateOnScroll>
      </div>
    </div>
  </section>
);
