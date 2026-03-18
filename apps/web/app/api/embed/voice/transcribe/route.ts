import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@dochat/db";
import { transcribeAudio } from "@/lib/voice";

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
    const formData = await req.formData();
    const audio = formData.get("audio") as Blob | null;
    const sessionToken = formData.get("sessionToken") as string | null;

    if (!audio || !sessionToken) {
      return NextResponse.json(
        { error: "audio and sessionToken required" },
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

    const audioBuffer = Buffer.from(await audio.arrayBuffer());
    const text = await transcribeAudio(audioBuffer, audio.type || "audio/webm");

    return NextResponse.json({ text }, { headers: corsHeaders });
  } catch (error) {
    console.error("[voice/transcribe] error:", error);
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: corsHeaders },
    );
  }
}
