import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@dochat/db";
import { getAuthUser, getErrorStatus } from "@/lib/auth";
import { indexDocsIntoAgent } from "@/lib/agent";
import { removeDataSourceFromKb } from "@/lib/knowledge-base";

export async function GET(
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

    const agentDocs = await prisma.agentDocument.findMany({
      where: { agentId: id },
      include: { document: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(agentDocs);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: getErrorStatus(error) });
  }
}

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

    if (agent.status === "provisioning") {
      return NextResponse.json({ error: "Agent is still provisioning" }, { status: 400 });
    }

    const body = await req.json();
    const { documentIds } = body;

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json({ error: "documentIds required" }, { status: 400 });
    }

    // Verify all docs belong to this org
    const docs = await prisma.knowledgeDocument.findMany({
      where: { id: { in: documentIds }, orgId },
    });

    if (docs.length !== documentIds.length) {
      return NextResponse.json({ error: "Some documents not found" }, { status: 400 });
    }

    // Index docs into agent's KB (fire-and-forget, creates KB on-demand)
    indexDocsIntoAgent(agent.id, documentIds).catch((err) =>
      console.error("[agent-docs] Failed to index:", err),
    );

    return NextResponse.json({ success: true, count: documentIds.length }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: getErrorStatus(error) });
  }
}

export async function DELETE(
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

    const body = await req.json();
    const { documentId } = body;

    if (!documentId) {
      return NextResponse.json({ error: "documentId required" }, { status: 400 });
    }

    const agentDoc = await prisma.agentDocument.findUnique({
      where: {
        agentId_knowledgeDocumentId: {
          agentId: id,
          knowledgeDocumentId: documentId,
        },
      },
    });

    if (!agentDoc) {
      return NextResponse.json({ error: "Document not attached to agent" }, { status: 404 });
    }

    // Remove from DO KB
    if (agentDoc.gradientSourceId && agent.gradientKbUuid) {
      await removeDataSourceFromKb(agent.gradientKbUuid, agentDoc.gradientSourceId);
    }

    // Remove from DB
    await prisma.agentDocument.delete({ where: { id: agentDoc.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: getErrorStatus(error) });
  }
}
