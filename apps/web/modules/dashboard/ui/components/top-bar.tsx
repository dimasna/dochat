"use client";

import { UserButton } from "@clerk/nextjs";
import { useActiveAgent } from "@/hooks/use-active-agent";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { Switch } from "@workspace/ui/components/switch";
import { BotIcon, CheckIcon, ChevronsUpDownIcon, Loader2Icon } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const WORKSPACE_ROUTES = ["/workspace", "/files", "/billing"];

export const TopBar = () => {
  const pathname = usePathname();
  const { activeAgent, agents, setActiveAgentId } = useActiveAgent();
  const queryClient = useQueryClient();
  const [isToggling, setIsToggling] = useState(false);

  const handleToggleVisibility = async () => {
    if (!activeAgent || isToggling) return;
    setIsToggling(true);
    try {
      const res = await fetch(`/api/agents/${activeAgent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: !activeAgent.isPublic }),
      });
      if (!res.ok) throw new Error("Failed to update visibility");
      toast.success(activeAgent.isPublic ? "Agent set to private" : "Agent published");
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    } catch {
      toast.error("Failed to update visibility");
    } finally {
      setIsToggling(false);
    }
  };

  const isWorkspaceLevel =
    WORKSPACE_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"));
  const isInsideAgent = !isWorkspaceLevel && !!activeAgent;

  return (
    <header className="flex h-14 shrink-0 items-center border-b bg-background px-4">
      {/* Left: Logo + Breadcrumb */}
      <div className="flex items-center">
        {/* Logo */}
        <Link href="/workspace" className="flex items-center">
          <Image src="/logo.svg" alt="Dochat" width={28} height={28} />
        </Link>

        {/* Separator */}
        <span className="mx-3 text-lg text-muted-foreground/40 font-light">/</span>

        {/* Workspace */}
        <Link
          href="/workspace"
          className="flex items-center gap-2 rounded-md px-2 py-1 text-sm font-medium hover:bg-accent transition-colors"
        >
          My Workspace
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
            Free
          </span>
          <ChevronsUpDownIcon className="size-3.5 text-muted-foreground" />
        </Link>

        {/* Agent breadcrumb */}
        {isInsideAgent && activeAgent && (
          <>
            <span className="mx-3 text-lg text-muted-foreground/40 font-light">/</span>
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1 text-sm font-medium hover:bg-accent transition-colors outline-none">
                {activeAgent.name}
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                  Agent
                </span>
                <ChevronsUpDownIcon className="size-3.5 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-48">
                {agents.map((agent) => (
                  <DropdownMenuItem
                    key={agent.id}
                    onClick={() => setActiveAgentId(agent.id)}
                    className="flex items-center gap-2"
                  >
                    <BotIcon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">{agent.name}</span>
                    {agent.id === activeAgent.id && (
                      <CheckIcon className="size-4 shrink-0 text-primary" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Visibility toggle */}
            <div className="flex items-center gap-2 ml-4 pl-4 border-l">
              {isToggling ? (
                <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" />
              ) : (
                <Switch
                  checked={activeAgent.isPublic}
                  onCheckedChange={handleToggleVisibility}
                  disabled={activeAgent.status !== "active"}
                  className="scale-90"
                />
              )}
              <span className="text-xs text-muted-foreground">
                {activeAgent.isPublic ? "Published" : "Private"}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Right: User */}
      <div className="ml-auto flex items-center">
        <UserButton />
      </div>
    </header>
  );
};
