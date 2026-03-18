import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@dochat/db", () => ({
  prisma: {
    subscription: { findUnique: vi.fn() },
    agent: { count: vi.fn() },
    knowledgeBase: { count: vi.fn() },
    knowledgeSource: { count: vi.fn() },
    message: { count: vi.fn() },
    conversation: { findMany: vi.fn() },
  },
}));

import { prisma } from "@dochat/db";
import {
  checkAgentLimit,
  checkKbLimit,
  checkSourceLimit,
  checkMessageCreditLimit,
  getOrgUsage,
  LimitError,
} from "../limits";

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no playground conversations
  vi.mocked(prisma.conversation.findMany).mockResolvedValue([]);
});

function mockPlan(plan: string) {
  vi.mocked(prisma.subscription.findUnique).mockResolvedValue(
    plan ? ({ plan } as never) : null,
  );
}

describe("checkAgentLimit", () => {
  it("passes when under the limit", async () => {
    mockPlan("free"); // maxAgents = 1
    vi.mocked(prisma.agent.count).mockResolvedValue(0);

    await expect(checkAgentLimit("org-1")).resolves.toBeUndefined();
  });

  it("throws LimitError when at the limit", async () => {
    mockPlan("free"); // maxAgents = 1
    vi.mocked(prisma.agent.count).mockResolvedValue(1);

    await expect(checkAgentLimit("org-1")).rejects.toThrow(LimitError);
    await expect(checkAgentLimit("org-1")).rejects.toThrow("Agent limit reached");
  });

  it("never throws for enterprise plan (Infinity)", async () => {
    mockPlan("enterprise");
    // count doesn't matter — should short-circuit
    await expect(checkAgentLimit("org-1")).resolves.toBeUndefined();
    expect(prisma.agent.count).not.toHaveBeenCalled();
  });

  it("falls back to free plan when no subscription exists", async () => {
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.agent.count).mockResolvedValue(1);

    await expect(checkAgentLimit("org-1")).rejects.toThrow(LimitError);
  });
});

describe("checkKbLimit", () => {
  it("passes when under the limit", async () => {
    mockPlan("free"); // maxKnowledgeBases = 2
    vi.mocked(prisma.knowledgeBase.count).mockResolvedValue(1);

    await expect(checkKbLimit("org-1")).resolves.toBeUndefined();
  });

  it("throws LimitError when at the limit", async () => {
    mockPlan("free"); // maxKnowledgeBases = 2
    vi.mocked(prisma.knowledgeBase.count).mockResolvedValue(2);

    await expect(checkKbLimit("org-1")).rejects.toThrow(LimitError);
    await expect(checkKbLimit("org-1")).rejects.toThrow("Knowledge base limit reached");
  });

  it("allows more KBs on higher plans", async () => {
    mockPlan("growth"); // maxKnowledgeBases = 10
    vi.mocked(prisma.knowledgeBase.count).mockResolvedValue(5);

    await expect(checkKbLimit("org-1")).resolves.toBeUndefined();
  });
});

describe("checkSourceLimit", () => {
  it("passes when under the limit", async () => {
    mockPlan("free"); // maxSourcesPerKb = 5
    vi.mocked(prisma.knowledgeSource.count).mockResolvedValue(3);

    await expect(checkSourceLimit("org-1", "kb-1")).resolves.toBeUndefined();
  });

  it("throws LimitError when at the limit", async () => {
    mockPlan("free"); // maxSourcesPerKb = 5
    vi.mocked(prisma.knowledgeSource.count).mockResolvedValue(5);

    await expect(checkSourceLimit("org-1", "kb-1")).rejects.toThrow(LimitError);
    await expect(checkSourceLimit("org-1", "kb-1")).rejects.toThrow("Source limit reached");
  });
});

describe("checkMessageCreditLimit", () => {
  it("passes when under the limit", async () => {
    mockPlan("free"); // maxMessageCreditsPerMonth = 100
    vi.mocked(prisma.message.count).mockResolvedValue(50);

    await expect(checkMessageCreditLimit("org-1")).resolves.toBeUndefined();
  });

  it("throws LimitError when at the monthly limit", async () => {
    mockPlan("free"); // maxMessageCreditsPerMonth = 100
    vi.mocked(prisma.message.count).mockResolvedValue(100);

    await expect(checkMessageCreditLimit("org-1")).rejects.toThrow(LimitError);
    await expect(checkMessageCreditLimit("org-1")).rejects.toThrow("Monthly message credit limit reached");
  });

  it("never throws for enterprise plan", async () => {
    mockPlan("enterprise");
    await expect(checkMessageCreditLimit("org-1")).resolves.toBeUndefined();
    expect(prisma.message.count).not.toHaveBeenCalled();
  });
});

describe("getOrgUsage", () => {
  it("returns usage and limits for an org", async () => {
    mockPlan("starter");
    vi.mocked(prisma.agent.count).mockResolvedValue(1);
    vi.mocked(prisma.knowledgeBase.count).mockResolvedValue(3);
    vi.mocked(prisma.message.count).mockResolvedValue(500);

    const result = await getOrgUsage("org-1");

    expect(result.plan).toBe("starter");
    expect(result.usage).toEqual({
      agents: 1,
      knowledgeBases: 3,
      messageCreditsThisMonth: 500,
    });
    expect(result.limits).toEqual({
      maxAgents: 2,
      maxKnowledgeBases: 5,
      maxMessageCreditsPerMonth: 2_000,
      maxSourcesPerKb: 20,
    });
  });

  it("uses free plan limits when no subscription", async () => {
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.agent.count).mockResolvedValue(0);
    vi.mocked(prisma.knowledgeBase.count).mockResolvedValue(0);
    vi.mocked(prisma.message.count).mockResolvedValue(0);

    const result = await getOrgUsage("org-1");

    expect(result.plan).toBe("free");
    expect(result.limits.maxAgents).toBe(1);
  });
});
