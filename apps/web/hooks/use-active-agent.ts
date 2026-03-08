"use client";

import { useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai/react";
import { activeAgentIdAtom } from "@/modules/dashboard/atoms";
import { useQuery } from "@tanstack/react-query";

interface Agent {
  id: string;
  name: string;
  status: string;
  description: string | null;
}

export function useActiveAgent() {
  const activeAgentId = useAtomValue(activeAgentIdAtom);
  const setActiveAgentId = useSetAtom(activeAgentIdAtom);

  const { data: agents = [], isLoading: isLoadingAgents } = useQuery<Agent[]>({
    queryKey: ["agents"],
    queryFn: async () => {
      const res = await fetch("/api/agents");
      if (!res.ok) throw new Error("Failed to fetch agents");
      return res.json();
    },
  });

  // Auto-select first agent if no valid selection
  const validAgent = agents.find((a) => a.id === activeAgentId);
  const activeAgent = validAgent ?? agents[0] ?? null;

  useEffect(() => {
    if (activeAgent && activeAgent.id !== activeAgentId) {
      setActiveAgentId(activeAgent.id);
    }
  }, [activeAgent, activeAgentId, setActiveAgentId]);

  return {
    agents,
    activeAgent,
    activeAgentId: activeAgent?.id ?? null,
    setActiveAgentId,
    isLoadingAgents,
    hasNoAgents: !isLoadingAgents && agents.length === 0,
  };
}
