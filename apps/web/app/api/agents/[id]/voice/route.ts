import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@dochat/db";
import { getAuthUser, getErrorStatus } from "@/lib/auth";
import { uploadVoiceReference, deleteVoiceReference } from "@/lib/voice";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { orgId } = await getAuthUser();
    if (!orgId) {
      return NextResponse.json({ error: "No organization" }, { status: 400 });
    }

    const { id } = await params;

    const agent = await prisma.agent.findUnique({ where: { id } });
    if (!agent || agent.orgId !== orgId) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const formData = await req.formData();
    const audio = formData.get("audio") as File | null;

    if (!audio) {
      return NextResponse.json(
        { error: "audio file required" },
        { status: 400 },
      );
    }

    const audioBuffer = Buffer.from(await audio.arrayBuffer());
    const voiceName = `agent-${id}`;

    // Delete old voice if exists
    if (agent.voiceId) {
      try {
        await deleteVoiceReference(agent.voiceId);
      } catch {
        // Ignore deletion errors for old voice
      }
    }

    const voiceId = await uploadVoiceReference(
      audioBuffer,
      voiceName,
      audio.type || "audio/wav",
    );

    await prisma.agent.update({
      where: { id },
      data: { voiceId },
    });

    return NextResponse.json({ voiceId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json(
      { error: message },
      { status: getErrorStatus(error) },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { orgId } = await getAuthUser();
    if (!orgId) {
      return NextResponse.json({ error: "No organization" }, { status: 400 });
    }

    const { id } = await params;

    const agent = await prisma.agent.findUnique({ where: { id } });
    if (!agent || agent.orgId !== orgId) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    if (agent.voiceId) {
      try {
        await deleteVoiceReference(agent.voiceId);
      } catch {
        // Ignore deletion errors
      }
    }

    await prisma.agent.update({
      where: { id },
      data: { voiceId: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json(
      { error: message },
      { status: getErrorStatus(error) },
    );
  }
}
