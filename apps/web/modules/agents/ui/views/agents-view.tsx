"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { BotIcon, FileTextIcon, MessageSquareIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CreateAgentDialog } from "../components/create-agent-dialog";

interface AgentItem {
  id: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  _count: {
    conversations: number;
    documents: number;
  };
}

export const AgentsView = () => {
  const [createOpen, setCreateOpen] = useState(false);

  const { data: agents = [], isLoading } = useQuery<AgentItem[]>({
    queryKey: ["agents"],
    queryFn: async () => {
      const res = await fetch("/api/agents");
      if (!res.ok) throw new Error("Failed to fetch agents");
      return res.json();
    },
  });

  return (
    <>
      <CreateAgentDialog open={createOpen} onOpenChange={setCreateOpen} />
      <div className="flex min-h-screen flex-col bg-muted p-8">
        <div className="mx-auto w-full max-w-screen-md">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <h1 className="text-2xl md:text-4xl font-bold">Agents</h1>
              <p className="text-muted-foreground">
                Manage your AI support agents
              </p>
            </div>
            <Button onClick={() => setCreateOpen(true)}>
              <PlusIcon className="size-4 mr-2" />
              Create Agent
            </Button>
          </div>

          <div className="mt-8 space-y-4">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))
            ) : agents.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border bg-background py-16 text-center">
                <BotIcon className="size-12 text-muted-foreground/50 mb-4" />
                <p className="text-lg font-medium">No agents yet</p>
                <p className="text-muted-foreground text-sm mt-1">
                  Create your first agent to get started
                </p>
                <Button className="mt-4" onClick={() => setCreateOpen(true)}>
                  <PlusIcon className="size-4 mr-2" />
                  Create Agent
                </Button>
              </div>
            ) : (
              agents.map((agent) => (
                <Link
                  key={agent.id}
                  href={`/agents/${agent.id}`}
                  className="flex items-center justify-between rounded-lg border bg-background p-5 hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                      <BotIcon className="size-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{agent.name}</p>
                        <Badge
                          variant={agent.status === "active" ? "default" : "secondary"}
                          className="text-xs capitalize"
                        >
                          {agent.status}
                        </Badge>
                      </div>
                      {agent.description && (
                        <p className="text-muted-foreground text-sm mt-0.5">
                          {agent.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-muted-foreground text-sm">
                    <div className="flex items-center gap-1.5">
                      <MessageSquareIcon className="size-4" />
                      <span>{agent._count.conversations}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <FileTextIcon className="size-4" />
                      <span>{agent._count.documents}</span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
};
