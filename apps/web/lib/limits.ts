import { prisma } from "@dochat/db";
import { getPlanLimits } from "./plans";

export class LimitError extends Error {
  status = 403;
  constructor(message: string) {
    super(message);
  }
}

async function getOrgPlan(orgId: string) {
  const sub = await prisma.subscription.findUnique({ where: { orgId } });
  return sub?.plan ?? "free";
}

export async function checkAgentLimit(orgId: string) {
  const plan = await getOrgPlan(orgId);
  const limits = getPlanLimits(plan);
  if (limits.maxAgents === Infinity) return;

  const count = await prisma.agent.count({ where: { orgId } });
  if (count >= limits.maxAgents) {
    throw new LimitError(
      `Agent limit reached (${count}/${limits.maxAgents}). Upgrade your plan to create more agents.`,
    );
  }
}

export async function checkKbLimit(orgId: string) {
  const plan = await getOrgPlan(orgId);
  const limits = getPlanLimits(plan);
  if (limits.maxKnowledgeBases === Infinity) return;

  const count = await prisma.knowledgeBase.count({ where: { orgId } });
  if (count >= limits.maxKnowledgeBases) {
    throw new LimitError(
      `Knowledge base limit reached (${count}/${limits.maxKnowledgeBases}). Upgrade your plan to create more knowledge bases.`,
    );
  }
}

export async function checkSourceLimit(orgId: string, kbId: string) {
  const plan = await getOrgPlan(orgId);
  const limits = getPlanLimits(plan);
  if (limits.maxSourcesPerKb === Infinity) return;

  const count = await prisma.knowledgeSource.count({
    where: { knowledgeBaseId: kbId },
  });
  if (count >= limits.maxSourcesPerKb) {
    throw new LimitError(
      `Source limit reached (${count}/${limits.maxSourcesPerKb}). Upgrade your plan to add more sources per knowledge base.`,
    );
  }
}

export async function checkMessageCreditLimit(orgId: string) {
  const plan = await getOrgPlan(orgId);
  const limits = getPlanLimits(plan);
  if (limits.maxMessageCreditsPerMonth === Infinity) return;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const count = await prisma.message.count({
    where: {
      role: "assistant",
      createdAt: { gte: startOfMonth },
      conversation: {
        orgId,
        contactSession: {
          NOT: { metadata: { path: ["isPlayground"], equals: true } },
        },
      },
    },
  });
  if (count >= limits.maxMessageCreditsPerMonth) {
    throw new LimitError(
      `Monthly message credit limit reached (${count}/${limits.maxMessageCreditsPerMonth}). Upgrade your plan for more message credits.`,
    );
  }
}

export async function getOrgUsage(orgId: string) {
  const plan = await getOrgPlan(orgId);
  const limits = getPlanLimits(plan);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [agents, knowledgeBases, messageCreditsThisMonth] = await Promise.all([
    prisma.agent.count({ where: { orgId } }),
    prisma.knowledgeBase.count({ where: { orgId } }),
    prisma.message.count({
      where: {
        role: "assistant",
        createdAt: { gte: startOfMonth },
        conversation: {
          orgId,
          contactSession: {
            NOT: { metadata: { path: ["isPlayground"], equals: true } },
          },
        },
      },
    }),
  ]);

  return {
    plan,
    usage: { agents, knowledgeBases, messageCreditsThisMonth },
    limits: {
      maxAgents: limits.maxAgents,
      maxKnowledgeBases: limits.maxKnowledgeBases,
      maxMessageCreditsPerMonth: limits.maxMessageCreditsPerMonth,
      maxSourcesPerKb: limits.maxSourcesPerKb,
    },
  };
}
