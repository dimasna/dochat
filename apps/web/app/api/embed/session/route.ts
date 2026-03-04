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

export async function POST(req: NextRequest) {
  try {
    const { orgId, name, email, metadata } = await req.json();

    if (!orgId || !name || !email) {
      return NextResponse.json(
        { error: "orgId, name, and email required" },
        { status: 400, headers: corsHeaders },
      );
    }

    const session = await prisma.contactSession.create({
      data: {
        orgId,
        name,
        email,
        metadata,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    return NextResponse.json(
      { sessionId: session.id, sessionToken: session.sessionToken },
      { status: 201, headers: corsHeaders },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: corsHeaders },
    );
  }
}
