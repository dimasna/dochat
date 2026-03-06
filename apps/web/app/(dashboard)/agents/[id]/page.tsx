"use client";

import { use } from "react";
import { AgentDetailView } from "@/modules/agents/ui/views/agent-detail-view";

export default function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <AgentDetailView agentId={id} />;
}
