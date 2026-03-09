"use client";

import Link from "next/link";
import { Button } from "@workspace/ui/components/button";
import { ArrowRightIcon } from "lucide-react";
import { AnimateOnScroll } from "./animate-on-scroll";
import { FrameBox } from "./frame-box";

export const CtaSection = () => (
  <section className="max-w-[1160px] mx-auto px-6">
    <FrameBox corners="bottom" className="py-24 px-8 text-center">
      <AnimateOnScroll>
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
          Ready to transform your support?
        </h2>
        <p className="text-muted-foreground text-base mb-8 max-w-md mx-auto">
          Join thousands of teams delivering instant, AI-powered customer
          support.
        </p>
        <div className="flex justify-center gap-3.5">
          <Button
            size="lg"
            asChild
            className="h-11 px-7 shadow-lg shadow-primary/20"
          >
            <Link href="/sign-up">
              Get started for free
              <ArrowRightIcon className="ml-2 size-3.5" />
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            asChild
            className="h-11 px-7"
          >
            <a href="mailto:support@dochat.site">Talk to us</a>
          </Button>
        </div>
      </AnimateOnScroll>
    </FrameBox>
  </section>
);
