import { NextResponse } from "next/server";
import { prisma } from "@dochat/db";
import { getAuthUser, getErrorStatus } from "@/lib/auth";
import { getOrgUsage } from "@/lib/limits";

export async function GET() {
  try {
    const { orgId } = await getAuthUser();
    if (!orgId) {
      return NextResponse.json({ error: "No organization" }, { status: 400 });
    }

    const sub = await prisma.subscription.findUnique({ where: { orgId } });
    const usageData = await getOrgUsage(orgId);

    return NextResponse.json({
      ...usageData,
      status: sub?.status ?? "active",
      hasSubscription: !!sub?.dodoCustomerId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: getErrorStatus(error) });
  }
}
