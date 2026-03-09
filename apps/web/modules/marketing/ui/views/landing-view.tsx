import { HeroSection } from "../components/hero-section";
import { LogoCloud } from "../components/logo-cloud";
import { FeaturesSection } from "../components/features-section";
import { StatsSection } from "../components/stats-section";
import { PricingSection } from "../components/pricing-section";
import { TestimonialsSection } from "../components/testimonials-section";
import { FaqSection } from "../components/faq-section";
import { CtaSection } from "../components/cta-section";

export const LandingView = () => (
  <>
    <HeroSection />
    <LogoCloud />
    <FeaturesSection />
    <StatsSection />
    <PricingSection />
    <TestimonialsSection />
    <FaqSection />
    <CtaSection />
  </>
);
