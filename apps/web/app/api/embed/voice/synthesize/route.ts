import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@dochat/db";
import { synthesizeSpeech } from "@/lib/voice";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const { text, agentId, sessionToken } = await req.json();

    if (!text || !agentId || !sessionToken) {
      return NextResponse.json(
        { error: "text, agentId, and sessionToken required" },
        { status: 400, headers: corsHeaders },
      );
    }

    // Validate session
    const session = await prisma.contactSession.findUnique({
      where: { sessionToken },
    });

    if (!session || session.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Invalid or expired session" },
        { status: 401, headers: corsHeaders },
      );
    }

    // Look up agent's voice reference
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { voiceId: true },
    });

    const audioBuffer = await synthesizeSpeech(text, agent?.voiceId);

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/wav",
        "Content-Length": audioBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("[voice/synthesize] error:", error);
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: corsHeaders },
    );
  }
}
