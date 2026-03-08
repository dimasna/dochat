import { NextResponse } from "next/server";
import { prisma } from "@dochat/db";
import { getAuthUser, getErrorStatus } from "@/lib/auth";
import { dodoClient } from "@/lib/dodo";

export async function POST() {
  try {
    const { orgId } = await getAuthUser();
    if (!orgId) {
      return NextResponse.json({ error: "No organization" }, { status: 400 });
    }

    const sub = await prisma.subscription.findUnique({ where: { orgId } });
    if (!sub?.dodoCustomerId) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 404 },
      );
    }

    const portalSession = await dodoClient.customers.customerPortal.create(
      sub.dodoCustomerId,
      { send_email: false },
    );

    return NextResponse.json({ portalUrl: portalSession.link });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: getErrorStatus(error) });
  }
}
