"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@workspace/ui/components/button";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import {
  BotIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  PlusIcon,
  TrashIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CreateAgentDialog } from "../components/create-agent-dialog";
import { useOrgEvents } from "@/hooks/use-org-events";
import { useSetAtom } from "jotai/react";
import { activeAgentIdAtom } from "@/modules/dashboard/atoms";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface AgentItem {
  id: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  _count: {
    conversations: number;
    knowledgeBases: number;
  };
}

export const AgentsView = () => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const setActiveAgentId = useSetAtom(activeAgentIdAtom);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: agents = [], isLoading } = useQuery<AgentItem[]>({
    queryKey: ["agents"],
    queryFn: async () => {
      const res = await fetch("/api/agents");
      if (!res.ok) throw new Error("Failed to fetch agents");
      return res.json();
    },
    refetchInterval: (query) =>
      query.state.data?.some((a) => a.status === "provisioning" || a.status === "recovering") ? 5000 : false,
  });

  useOrgEvents((event) => {
    if (event.type === "agent:status") {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    }
  });

  const handleAgentClick = (agent: AgentItem) => {
    setActiveAgentId(agent.id);
    router.push("/conversations");
  };

  const handleDeleteAgent = async (
    e: React.MouseEvent,
    agentId: string,
  ) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete agent");
      toast.success("Agent deleted");
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    } catch {
      toast.error("Failed to delete agent");
    }
  };

  return (
    <>
      <CreateAgentDialog open={createOpen} onOpenChange={setCreateOpen} />
      <div className="flex min-h-screen flex-col bg-background p-8">
        <div className="mx-auto w-full max-w-screen-lg">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Agents</h1>
            <Button onClick={() => setCreateOpen(true)}>
              <PlusIcon className="size-4 mr-2" />
              New AI agent
            </Button>
          </div>

          {/* Agent Cards Grid */}
          <div className="mt-8">
            {isLoading ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-64 w-full rounded-lg" />
                ))}
              </div>
            ) : agents.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border py-20 text-center">
                <BotIcon className="size-12 text-muted-foreground/50 mb-4" />
                <p className="text-lg font-medium">No agents yet</p>
                <p className="text-muted-foreground text-sm mt-1">
                  Create your first AI agent to get started
                </p>
                <Button
                  className="mt-4"
                  onClick={() => setCreateOpen(true)}
                >
                  <PlusIcon className="size-4 mr-2" />
                  New AI agent
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {agents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    onClick={() => handleAgentClick(agent)}
                    onDelete={(e) => handleDeleteAgent(e, agent.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

function AgentCard({
  agent,
  onClick,
  onDelete,
}: {
  agent: AgentItem;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const isUnavailable = agent.status === "provisioning" || agent.status === "recovering";

  return (
    <div
      className="group cursor-pointer overflow-hidden rounded-lg border bg-background transition-shadow hover:shadow-md"
      onClick={onClick}
    >
      {/* Thumbnail preview */}
      <div className="relative h-44 bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 p-5">
        {/* Mini chat widget preview */}
        <div className="absolute right-4 top-4 w-40 rounded-lg bg-white/95 p-3 shadow-lg backdrop-blur-sm">
          <p className="text-[10px] font-medium text-gray-800">
            {agent.name}
          </p>
          <div className="mt-2 space-y-1.5">
            <div className="h-2 w-20 rounded-full bg-gray-200" />
            <div className="h-2 w-14 rounded-full bg-gray-200" />
          </div>
          <div className="mt-2 flex justify-end">
            <div className="h-3 w-16 rounded-full bg-blue-500" />
          </div>
        </div>
        {isUnavailable && (
          <div className="absolute bottom-3 left-4 flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-gray-700 backdrop-blur-sm">
            <Loader2Icon className="size-3 animate-spin" />
            {agent.status === "recovering" ? "Restarting" : "Provisioning"}
          </div>
        )}
      </div>

      {/* Card footer */}
      <div className="flex items-center justify-between px-4 py-3.5">
        <div className="min-w-0">
          <p className="truncate font-semibold text-sm">{agent.name}</p>
          <p className="text-xs text-muted-foreground">
            Last updated{" "}
            {formatDistanceToNow(new Date(agent.updatedAt || agent.createdAt), {
              addSuffix: true,
            })}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <button className="flex size-8 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100">
              <MoreHorizontalIcon className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="text-destructive"
              onClick={onDelete}
            >
              <TrashIcon className="size-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
