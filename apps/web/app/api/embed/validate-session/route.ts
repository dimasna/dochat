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
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json(
      { valid: false },
      { headers: corsHeaders },
    );
  }

  const session = await prisma.contactSession.findUnique({
    where: { id: sessionId },
    select: { id: true, expiresAt: true, sessionToken: true },
  });

  if (!session || session.expiresAt < new Date()) {
    return NextResponse.json(
      { valid: false },
      { headers: corsHeaders },
    );
  }

  return NextResponse.json(
    { valid: true, sessionToken: session.sessionToken },
    { headers: corsHeaders },
  );
}
