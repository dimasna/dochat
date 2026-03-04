import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@dochat/db";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) {
    return NextResponse.json(
      { valid: false, reason: "Organization ID is required" },
      { headers: corsHeaders },
    );
  }

  // Since Clerk manages orgs, validate by checking if org has widget settings
  // (created when org first configures their widget) or any data in our DB
  const hasData = await prisma.widgetSettings.findUnique({
    where: { orgId },
    select: { id: true },
  });

  // Also accept if there's a subscription record for this org
  const hasSub = !hasData
    ? await prisma.subscription.findUnique({
        where: { orgId },
        select: { id: true },
      })
    : hasData;

  if (!hasData && !hasSub) {
    return NextResponse.json(
      { valid: false, reason: "Organization not found" },
      { headers: corsHeaders },
    );
  }

  return NextResponse.json({ valid: true }, { headers: corsHeaders });
}
