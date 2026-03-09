"use client";

import { formatDistanceToNow } from "date-fns";
import { getCountryFlagUrl, getCountryFromTimezone } from "@/lib/country-utils";
import { DicebearAvatar } from "@workspace/ui/components/dicebear-avatar";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { cn } from "@workspace/ui/lib/utils";
import { ListIcon, ArrowRightIcon, ArrowUpIcon, CheckIcon, ChevronRightIcon, CornerUpLeftIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConversationStatusIcon } from "@workspace/ui/components/conversation-status-icon";
import { useAtomValue, useSetAtom } from "jotai/react";
import { statusFilterAtom } from "../../atoms";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useActiveAgent } from "@/hooks/use-active-agent";
import { useCallback, useState } from "react";

interface ConversationItem {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  agent?: {
    id: string;
    name: string;
  };
  messages: Array<{
    id: string;
    role: string;
    content: string;
  }>;
}

interface ContactGroup {
  contactSession: {
    id: string;
    name: string;
    email: string;
    metadata?: { timezone?: string } | null;
  };
  conversations: ConversationItem[];
  conversationCount: number;
  lastUpdatedAt: string;
}

export const ConversationsPanel = () => {
  const pathname = usePathname();

  const statusFilter = useAtomValue(statusFilterAtom);
  const setStatusFilter = useSetAtom(statusFilterAtom);
  const { activeAgentId } = useActiveAgent();

  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback((sessionId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  }, []);

  const { data: groups = [], isLoading } = useQuery<ContactGroup[]>({
    queryKey: ["conversations", statusFilter, activeAgentId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (activeAgentId) params.set("agentId", activeAgentId);
      const res = await fetch(`/api/conversations?${params}`);
      if (!res.ok) throw new Error("Failed to fetch conversations");
      return res.json();
    },
    enabled: !!activeAgentId,
    refetchInterval: 5000,
  });

  return (
    <div className="flex h-full w-full flex-col bg-background text-sidebar-foreground">
      <div className="flex flex-col gap-3.5 border-b p-2">
        <Select
          defaultValue="all"
          onValueChange={(value) =>
            setStatusFilter(
              value as "unresolved" | "escalated" | "resolved" | "all",
            )
          }
          value={statusFilter}
        >
          <SelectTrigger className="h-8 border-none px-1.5 shadow-none ring-0 hover:bg-accent hover:text-accent-foreground focus-visible:ring-0">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <div className="flex items-center gap-2">
                <ListIcon className="size-4" />
                <span>All</span>
              </div>
            </SelectItem>
            <SelectItem value="unresolved">
              <div className="flex items-center gap-2">
                <ArrowRightIcon className="size-4" />
                <span>Unresolved</span>
              </div>
            </SelectItem>
            <SelectItem value="escalated">
              <div className="flex items-center gap-2">
                <ArrowUpIcon className="size-4" />
                <span>Escalated</span>
              </div>
            </SelectItem>
            <SelectItem value="resolved">
              <div className="flex items-center gap-2">
                <CheckIcon className="size-4" />
                <span>Resolved</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      {isLoading ? (
        <SkeletonConversations />
      ) : (
        <ScrollArea className="max-h-[calc(100vh-53px)]">
          <div className="flex w-full flex-1 flex-col text-sm">
            {groups.map((group) => {
              const { contactSession } = group;
              const metadata = contactSession.metadata as
                | { timezone?: string }
                | null
                | undefined;
              const country = getCountryFromTimezone(metadata?.timezone);
              const countryFlagUrl = country?.code
                ? getCountryFlagUrl(country.code)
                : undefined;

              const isActive = group.conversations.some(
                (c) => pathname === `/conversations/${c.id}`,
              );
              const isExpanded = expanded.has(contactSession.id) || isActive;
              const lastMessage = group.conversations[0]?.messages[0];
              const lastMsgFromOperator = lastMessage?.role !== "user";

              return (
                <div key={contactSession.id}>
                  {/* Contact session header */}
                  <button
                    type="button"
                    onClick={() => toggleExpand(contactSession.id)}
                    className="flex w-full items-center gap-3 border-b bg-muted/40 px-4 py-3 text-left hover:bg-muted/70 transition-colors"
                  >
                    <ChevronRightIcon
                      className={cn(
                        "size-3.5 shrink-0 text-muted-foreground transition-transform",
                        isExpanded && "rotate-90",
                      )}
                    />
                    <DicebearAvatar
                      seed={contactSession.id}
                      badgeImageUrl={countryFlagUrl}
                      size={32}
                      className="shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-bold">
                          {contactSession.name}
                        </span>
                        {group.conversationCount > 1 && (
                          <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {group.conversationCount}
                          </span>
                        )}
                      </div>
                      {!isExpanded && lastMessage && (
                        <span className={cn(
                          "line-clamp-1 text-xs text-muted-foreground block",
                          !lastMsgFromOperator && "font-bold text-black",
                        )}>
                          {lastMessage.content}
                        </span>
                      )}
                      {isExpanded && (
                        <span className="text-xs text-muted-foreground truncate block">
                          {contactSession.email}
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(group.lastUpdatedAt))}
                    </span>
                  </button>

                  {/* Conversations under this contact */}
                  {isExpanded && group.conversations.map((conversation) => {
                    const lastMessage = conversation.messages[0];
                    const isLastMessageFromOperator = lastMessage?.role !== "user";

                    return (
                      <Link
                        key={conversation.id}
                        className={cn(
                          "relative flex cursor-pointer items-start gap-3 border-b px-4 py-4 pl-14 text-sm leading-tight hover:bg-accent hover:text-accent-foreground",
                          pathname === `/conversations/${conversation.id}` &&
                            "bg-accent text-accent-foreground",
                        )}
                        href={`/conversations/${conversation.id}`}
                      >
                        <div
                          className={cn(
                            "-translate-y-1/2 absolute top-1/2 left-0 h-[64%] w-1 rounded-r-full bg-neutral-300 opacity-0 transition-opacity",
                            pathname === `/conversations/${conversation.id}` &&
                              "opacity-100",
                          )}
                        />
                        <div className="flex-1">
                          <div className="flex w-full items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(conversation.createdAt))}
                            </span>
                            <ConversationStatusIcon
                              status={conversation.status as "unresolved" | "escalated" | "resolved"}
                              className="ml-auto shrink-0"
                            />
                          </div>
                          {lastMessage && (
                            <div className="mt-1 flex items-center gap-1">
                              {isLastMessageFromOperator && (
                                <CornerUpLeftIcon className="size-3 shrink-0 text-muted-foreground" />
                              )}
                              <span
                                className={cn(
                                  "line-clamp-1 text-muted-foreground text-xs",
                                  !isLastMessageFromOperator &&
                                    "font-bold text-black",
                                )}
                              >
                                {lastMessage.content}
                              </span>
                            </div>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

export const SkeletonConversations = () => {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto">
      <div className="relative flex w-full min-w-0 flex-col p-2">
        <div className="w-full space-y-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              className="flex items-start gap-3 rounded-lg p-4"
              key={index}
            >
              <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <div className="flex w-full items-center gap-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="ml-auto h-3 w-12 shrink-0" />
                </div>
                <div className="mt-2">
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
