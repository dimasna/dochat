import { auth } from "@clerk/nextjs/server";
import { prisma } from "@dochat/db";
import { LimitError } from "./limits";

export class AuthError extends Error {
  status: number;
  constructor(message = "Unauthorized", status = 401) {
    super(message);
    this.status = status;
  }
}

/**
 * Get the authenticated user's ID and active organization ID from Clerk.
 * Throws AuthError if not authenticated.
 */
export async function getAuthUser(orgId?: string) {
  const { userId, orgId: clerkOrgId } = await auth();

  if (!userId) {
    throw new AuthError("Unauthorized", 401);
  }

  const activeOrgId = orgId || clerkOrgId;

  return {
    userId,
    orgId: activeOrgId,
  };
}

/**
 * Ensure a subscription record exists for an org.
 * Creates a default free/active subscription if missing.
 */
export async function ensureOrgSubscription(orgId: string) {
  await prisma.subscription.upsert({
    where: { orgId },
    update: {},
    create: { orgId, status: "active", plan: "free" },
  });
}

/**
 * Helper to get the appropriate HTTP status from an error.
 */
export function getErrorStatus(error: unknown): number {
  if (error instanceof AuthError) return error.status;
  if (error instanceof LimitError) return error.status;
  return 500;
}
