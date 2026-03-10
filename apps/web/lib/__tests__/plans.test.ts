import { describe, it, expect } from "vitest";
import { getPlanLimits, PLAN_LIMITS } from "../plans";

describe("getPlanLimits", () => {
  it("returns correct limits for free plan", () => {
    const limits = getPlanLimits("free");
    expect(limits).toEqual({
      maxAgents: 1,
      maxKnowledgeBases: 2,
      maxSourcesPerKb: 5,
      maxMessageCreditsPerMonth: 100,
    });
  });

  it("returns correct limits for starter plan", () => {
    const limits = getPlanLimits("starter");
    expect(limits.maxAgents).toBe(2);
    expect(limits.maxKnowledgeBases).toBe(5);
    expect(limits.maxSourcesPerKb).toBe(20);
    expect(limits.maxMessageCreditsPerMonth).toBe(2_000);
  });

  it("returns correct limits for growth plan", () => {
    const limits = getPlanLimits("growth");
    expect(limits.maxAgents).toBe(5);
    expect(limits.maxMessageCreditsPerMonth).toBe(10_000);
  });

  it("returns correct limits for scale plan", () => {
    const limits = getPlanLimits("scale");
    expect(limits.maxAgents).toBe(15);
    expect(limits.maxMessageCreditsPerMonth).toBe(40_000);
  });

  it("returns Infinity limits for enterprise plan", () => {
    const limits = getPlanLimits("enterprise");
    expect(limits.maxAgents).toBe(Infinity);
    expect(limits.maxKnowledgeBases).toBe(Infinity);
    expect(limits.maxSourcesPerKb).toBe(Infinity);
    expect(limits.maxMessageCreditsPerMonth).toBe(Infinity);
  });

  it("falls back to free plan for unknown plan names", () => {
    const limits = getPlanLimits("nonexistent");
    expect(limits).toEqual(PLAN_LIMITS.free);
  });
});
