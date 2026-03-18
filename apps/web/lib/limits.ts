import { prisma } from "@dochat/db";
import { getPlanLimits, normalizePlanName } from "./plans";

export class LimitError extends Error {
  status = 403;
  constructor(message: string) {
    super(message);
  }
}

/**
 * Returns conversation IDs for playground sessions in an org.
 * Prisma's NOT + JSON path doesn't work through relation filters,
 * so we query playground sessions directly and exclude by ID.
 */
async function getPlaygroundConversationIds(orgId: string) {
  const playgroundConversations = await prisma.conversation.findMany({
    where: {
      orgId,
      contactSession: { metadata: { path: ["isPlayground"], equals: true } },
    },
    select: { id: true },
  });
  return playgroundConversations.map((c) => c.id);
}

async function getOrgSubscription(orgId: string) {
  return prisma.subscription.findUnique({ where: { orgId } });
}

function getCreditPeriodStart(sub: { currentPeriodStart: Date | null } | null) {
  if (sub?.currentPeriodStart) return sub.currentPeriodStart;
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export async function checkAgentLimit(orgId: string) {
  const sub = await getOrgSubscription(orgId);
  const limits = getPlanLimits(sub?.plan ?? "free");
  if (limits.maxAgents === Infinity) return;

  const count = await prisma.agent.count({ where: { orgId } });
  if (count >= limits.maxAgents) {
    throw new LimitError(
      `Agent limit reached (${count}/${limits.maxAgents}). Upgrade your plan to create more agents.`,
    );
  }
}

export async function checkKbLimit(orgId: string) {
  const sub = await getOrgSubscription(orgId);
  const limits = getPlanLimits(sub?.plan ?? "free");
  if (limits.maxKnowledgeBases === Infinity) return;

  const count = await prisma.knowledgeBase.count({ where: { orgId } });
  if (count >= limits.maxKnowledgeBases) {
    throw new LimitError(
      `Knowledge base limit reached (${count}/${limits.maxKnowledgeBases}). Upgrade your plan to create more knowledge bases.`,
    );
  }
}

export async function checkSourceLimit(orgId: string, kbId: string) {
  const sub = await getOrgSubscription(orgId);
  const limits = getPlanLimits(sub?.plan ?? "free");
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
  const sub = await getOrgSubscription(orgId);
  const limits = getPlanLimits(sub?.plan ?? "free");
  if (limits.maxMessageCreditsPerMonth === Infinity) return;

  const periodStart = getCreditPeriodStart(sub);
  const playgroundConvIds = await getPlaygroundConversationIds(orgId);

  const count = await prisma.message.count({
    where: {
      role: "assistant",
      createdAt: { gte: periodStart },
      conversation: {
        orgId,
        ...(playgroundConvIds.length > 0
          ? { id: { notIn: playgroundConvIds } }
          : {}),
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
  const sub = await getOrgSubscription(orgId);
  const plan = normalizePlanName(sub?.plan ?? "free");
  const limits = getPlanLimits(plan);

  const periodStart = getCreditPeriodStart(sub);
  const playgroundConvIds = await getPlaygroundConversationIds(orgId);

  const [agents, knowledgeBases, messageCreditsThisMonth] = await Promise.all([
    prisma.agent.count({ where: { orgId } }),
    prisma.knowledgeBase.count({ where: { orgId } }),
    prisma.message.count({
      where: {
        role: "assistant",
        createdAt: { gte: periodStart },
        conversation: {
          orgId,
          ...(playgroundConvIds.length > 0
            ? { id: { notIn: playgroundConvIds } }
            : {}),
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
