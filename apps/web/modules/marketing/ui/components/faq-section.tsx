"use client";

import { useState } from "react";
import { SectionBadge } from "./section-badge";
import { AnimateOnScroll } from "./animate-on-scroll";
import { FrameBox } from "./frame-box";

const faqs = [
  {
    q: "What is Dochat?",
    a: "Dochat is an AI-powered customer support platform that lets you build custom chatbots trained on your own data. Deploy them on your website with a single line of code to provide instant, 24/7 support.",
  },
  {
    q: "How does Dochat learn from my data?",
    a: "Upload your documents, website URLs, or FAQ content to create a knowledge base. Dochat indexes everything and trains your AI agent to answer questions based on your specific data.",
  },
  {
    q: 'What does "message credits" mean?',
    a: "Each AI response to a customer counts as one message credit. Your monthly credit allowance depends on your plan. Credits reset at the beginning of each billing cycle.",
  },
  {
    q: "Can I customize the chat widget?",
    a: "Yes! You can customize colors, position, welcome messages, agent name, avatar, and more. The widget automatically adapts to your website's design.",
  },
  {
    q: "How do I integrate Dochat with my website?",
    a: "Just copy a single script tag from your dashboard and paste it into your website's HTML. It works with any framework — React, Vue, WordPress, Shopify, and more.",
  },
  {
    q: "Is there a free plan?",
    a: "Yes, our free plan includes 100 message credits per month, 1 AI agent, and 2 knowledge bases. No credit card required to get started.",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="border-b border-border py-5 cursor-pointer select-none"
      onClick={() => setOpen(!open)}
    >
      <div className="flex justify-between items-center">
        <span className="text-foreground font-medium text-[15px]">{q}</span>
        <span
          className="text-muted-foreground text-xl transition-transform duration-200"
          style={{ transform: open ? "rotate(45deg)" : "rotate(0)" }}
        >
          +
        </span>
      </div>
      <div
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: open ? 200 : 0, opacity: open ? 1 : 0 }}
      >
        <p className="text-muted-foreground text-sm leading-relaxed mt-3">
          {a}
        </p>
      </div>
    </div>
  );
}

export const FaqSection = () => (
  <section id="faq" className="max-w-[1160px] mx-auto px-6">
    <FrameBox corners="bottom" className="py-24 px-8 text-center">
      <SectionBadge number="05 / 05" label="FAQ" sub="Common questions" center />

      <AnimateOnScroll>
        <h2 className="text-4xl font-bold text-foreground tracking-tight mb-12">
          Frequently asked questions
        </h2>
      </AnimateOnScroll>

      <div className="max-w-[720px] mx-auto text-left">
        {faqs.map((faq) => (
          <FaqItem key={faq.q} {...faq} />
        ))}
      </div>
    </FrameBox>
  </section>
);
