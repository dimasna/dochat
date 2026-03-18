"use client";

import { useActiveAgent } from "@/hooks/use-active-agent";
import { useOrganization } from "@clerk/nextjs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2Icon,
  CopyIcon,
  RotateCcwIcon,
  TrashIcon,
  FolderIcon,
  MoreHorizontalIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import Image from "next/image";
import { DicebearAvatar } from "@workspace/ui/components/dicebear-avatar";

import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Badge } from "@workspace/ui/components/badge";
import { Textarea } from "@workspace/ui/components/textarea";
import { Separator } from "@workspace/ui/components/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";
import {
  AIConversation,
  AIConversationContent,
} from "@workspace/ui/components/ai/conversation";
import {
  AIMessage,
  AIMessageContent,
} from "@workspace/ui/components/ai/message";
import { AIResponse } from "@workspace/ui/components/ai/response";
import {
  AIInputTextarea,
  AIInputSubmit,
} from "@workspace/ui/components/ai/input";
import { Form, FormField } from "@workspace/ui/components/form";

import { CustomizationForm } from "@/modules/customization/ui/components/customization-form";
import { createScript } from "@/modules/integrations/utils";
import {
  INTEGRATIONS,
  type IntegrationId,
} from "@/modules/integrations/constants";
import { useOrgEvents } from "@/hooks/use-org-events";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const chatFormSchema = z.object({
  message: z.string().min(1),
});

// Module-level cache: survives component unmount/remount (but not full page refresh)
let cachedAgentId: string | null = null;
let cachedSessionToken: string | null = null;
let cachedConversationId: string | null = null;
let cachedMessages: MessageData[] = [];

/** Darken a hex color by a given amount (0-1) */
function darkenHex(hex: string, amount: number): string {
  const h = hex.replace("#", "");
  const num = parseInt(h.length === 3 ? h.split("").map(c => c + c).join("") : h, 16);
  const r = Math.max(0, Math.round(((num >> 16) & 0xff) * (1 - amount)));
  const g = Math.max(0, Math.round(((num >> 8) & 0xff) * (1 - amount)));
  const b = Math.max(0, Math.round((num & 0xff) * (1 - amount)));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

interface MessageData {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

interface AgentKb {
  id: string;
  knowledgeBase: {
    id: string;
    name: string;
    indexingStatus: string;
    _count: { sources: number };
  };
}

interface AgentDetail {
  id: string;
  name: string;
  description: string | null;
  instruction: string | null;
  status: string;
  knowledgeBases: AgentKb[];
  _count: { conversations: number };
}

export const PlaygroundView = () => {
  const { activeAgent, activeAgentId } = useActiveAgent();
  const { organization } = useOrganization();
  const queryClient = useQueryClient();

  // --- Settings tab data ---
  const { data: widgetSettings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ["widget-settings", activeAgentId],
    queryFn: async () => {
      const res = await fetch(`/api/widget-settings?agentId=${activeAgentId}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!activeAgentId,
  });

  // --- Agent tab data ---
  const { data: agentDetail, isLoading: isLoadingAgent } = useQuery<AgentDetail>({
    queryKey: ["agent", activeAgentId],
    queryFn: async () => {
      const res = await fetch(`/api/agents/${activeAgentId}`);
      if (!res.ok) throw new Error("Failed to fetch agent");
      return res.json();
    },
    enabled: !!activeAgentId,
    refetchInterval: (query) =>
      query.state.data?.status === "provisioning" ? 5000 : false,
  });

  const { data: orgKbs = [] } = useQuery<Array<{
    id: string;
    name: string;
    indexingStatus: string;
    _count: { sources: number };
  }>>({
    queryKey: ["knowledge-bases"],
    queryFn: async () => {
      const res = await fetch("/api/knowledge-bases");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  useOrgEvents((event) => {
    if (event.type === "agent:status" && event.id === activeAgentId) {
      queryClient.invalidateQueries({ queryKey: ["agent", activeAgentId] });
    }
  });

  const [agentName, setAgentName] = useState("");
  const [agentInstruction, setAgentInstruction] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isAttaching, setIsAttaching] = useState(false);

  const isProvisioning = agentDetail?.status === "provisioning";

  // Sync local state when server data loads or changes
  useEffect(() => {
    if (agentDetail) {
      setAgentName(agentDetail.name);
      setAgentInstruction(agentDetail.instruction || "");
    }
  }, [agentDetail]);

  const hasAgentChanges =
    !!agentDetail &&
    (agentName !== agentDetail.name ||
      agentInstruction !== (agentDetail.instruction || ""));

  const handleSaveAgent = async () => {
    if (!agentName.trim() || !activeAgentId) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/agents/${activeAgentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: agentName.trim(),
          instruction: agentInstruction.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to update agent");
      toast.success("Agent updated");
      queryClient.invalidateQueries({ queryKey: ["agent", activeAgentId] });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    } catch {
      toast.error("Failed to update agent");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAttachKb = async (knowledgeBaseId: string) => {
    if (!activeAgentId) return;
    setIsAttaching(true);
    try {
      const res = await fetch(`/api/agents/${activeAgentId}/knowledge-bases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ knowledgeBaseIds: [knowledgeBaseId] }),
      });
      if (!res.ok) throw new Error("Failed to attach knowledge base");
      toast.success("Knowledge base attached. Agent is re-provisioning.");
      queryClient.invalidateQueries({ queryKey: ["agent", activeAgentId] });
    } catch {
      toast.error("Failed to attach knowledge base");
    } finally {
      setIsAttaching(false);
    }
  };

  const handleDetachKb = async (knowledgeBaseId: string) => {
    if (!activeAgentId) return;
    try {
      const res = await fetch(`/api/agents/${activeAgentId}/knowledge-bases`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ knowledgeBaseId }),
      });
      if (!res.ok) throw new Error("Failed to detach knowledge base");
      toast.success("Knowledge base removed from agent");
      queryClient.invalidateQueries({ queryKey: ["agent", activeAgentId] });
    } catch {
      toast.error("Failed to remove knowledge base");
    }
  };

  const attachedKbIds = new Set(agentDetail?.knowledgeBases.map((akb) => akb.knowledgeBase.id) ?? []);
  const unattachedKbs = orgKbs.filter(
    (kb) => !attachedKbIds.has(kb.id) && kb.indexingStatus === "ready",
  );

  // --- Deploy tab ---
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(
    null,
  );

  const embedSnippet =
    selectedIntegration && organization
      ? createScript(
          selectedIntegration as IntegrationId,
          organization.id,
          activeAgentId ?? undefined,
        )
      : "";

  const handleCopySnippet = async () => {
    try {
      await navigator.clipboard.writeText(embedSnippet);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  };

  // --- Chat preview ---
  const [sessionToken, setSessionToken] = useState<string | null>(() => {
    // Restore from module-level cache if same agent
    return cachedAgentId === activeAgentId ? cachedSessionToken : null;
  });
  const [conversationId, setConversationId] = useState<string | null>(() => {
    return cachedAgentId === activeAgentId ? cachedConversationId : null;
  });
  const [messages, setMessages] = useState<MessageData[]>(() => {
    return cachedAgentId === activeAgentId ? cachedMessages : [];
  });
  const [isInitializing, setIsInitializing] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Keep module-level cache in sync
  useEffect(() => {
    if (activeAgentId) cachedAgentId = activeAgentId;
  }, [activeAgentId]);
  useEffect(() => { cachedSessionToken = sessionToken; }, [sessionToken]);
  useEffect(() => { cachedConversationId = conversationId; }, [conversationId]);
  useEffect(() => { cachedMessages = messages; }, [messages]);

  const connectSSE = useCallback((convId: string, token: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    const es = new EventSource(
      `/api/embed/conversations/${convId}/messages/stream?sessionToken=${token}`,
    );
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "init") {
          setMessages(data.messages);
        } else if (data.type === "message") {
          if (data.message.role === "assistant" || data.message.role === "support") {
            setIsTyping(false);
          }
          setMessages((prev) => {
            const filtered = prev.filter(
              (m) => m.id !== data.message.id && !m.id.startsWith("temp-"),
            );
            return [...filtered, data.message];
          });
        }
      } catch {
        // Ignore malformed events
      }
    };

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, []);

  const initChat = useCallback(async () => {
    if (!organization || !activeAgentId) return;

    setIsInitializing(true);
    setMessages([]);
    setIsTyping(false);

    // Close existing SSE connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    try {
      // Create session
      const sessionRes = await fetch("/api/embed/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: organization.id,
          name: "Playground User",
          email: `playground-${Date.now()}@dochat.test`,
          metadata: { isPlayground: true },
        }),
      });
      if (!sessionRes.ok) throw new Error("Failed to create session");
      const { sessionToken: token } = await sessionRes.json();
      setSessionToken(token);

      // Create conversation
      const convRes = await fetch("/api/embed/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionToken: token,
          orgId: organization.id,
          agentId: activeAgentId,
        }),
      });
      if (!convRes.ok) throw new Error("Failed to create conversation");
      const { conversationId: convId } = await convRes.json();
      setConversationId(convId);

      // Connect SSE
      connectSSE(convId, token);
    } catch (err) {
      console.error("Playground init failed:", err);
      toast.error("Failed to initialize chat preview");
    } finally {
      setIsInitializing(false);
    }
  }, [organization, activeAgentId, connectSSE]);

  // Init chat or reconnect SSE on mount
  useEffect(() => {
    const hasCacheForAgent = cachedAgentId === activeAgentId && cachedConversationId && cachedSessionToken;

    if (hasCacheForAgent) {
      // Restore from cache — just reconnect SSE
      connectSSE(cachedConversationId!, cachedSessionToken!);
    } else {
      // Fresh init
      initChat();
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [activeAgentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const chatForm = useForm<z.infer<typeof chatFormSchema>>({
    resolver: zodResolver(chatFormSchema),
    mode: "onChange",
    defaultValues: { message: "" },
  });

  const onSendMessage = async (values: z.infer<typeof chatFormSchema>) => {
    if (!conversationId || !sessionToken) return;

    chatForm.reset();

    // Optimistic message
    const tempMsg: MessageData = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: values.message,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);
    setIsTyping(true);

    try {
      await fetch("/api/embed/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          sessionToken,
          content: values.message,
        }),
      });
    } catch {
      setIsTyping(false);
      toast.error("Failed to send message");
    }
  };

  const suggestions = useMemo(() => {
    if (!widgetSettings) return [];
    return [widgetSettings.suggestion1, widgetSettings.suggestion2, widgetSettings.suggestion3].filter(Boolean) as string[];
  }, [widgetSettings]);

  const hasUserMessage = messages.some((m) => m.role === "user");

  const handleSuggestionClick = (suggestion: string) => {
    chatForm.setValue("message", suggestion, {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true,
    });
    chatForm.handleSubmit(onSendMessage)();
  };

  const themeColor = widgetSettings?.themeColor as string | null | undefined;
  const widgetLogo = widgetSettings?.widgetLogo as string | null | undefined;

  const isSettingsLoading = isLoadingSettings;

  return (
    <div className="flex w-full h-full overflow-hidden">
      {/* Left Panel — Settings & Deploy */}
      <div className="flex w-[55%] flex-col border-r min-h-0">
        <div className="border-b px-6 py-4">
          <h1 className="text-lg font-semibold">Playground</h1>
          <p className="text-sm text-muted-foreground">
            Configure, test, and deploy your chatbot
          </p>
        </div>

        <Tabs defaultValue="agent" className="flex flex-1 flex-col min-h-0">
          <div className="shrink-0 border-b px-6 pt-2">
            <TabsList>
              <TabsTrigger value="agent">Agent</TabsTrigger>
              <TabsTrigger value="sources">Sources</TabsTrigger>
              <TabsTrigger value="widget">Widget</TabsTrigger>
              <TabsTrigger value="deploy">Deploy</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="agent" className="!flex-1 overflow-y-auto px-6 py-6 min-h-0">
            {isLoadingAgent ? (
              <div className="flex items-center justify-center py-20">
                <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : agentDetail ? (
              <div className="space-y-6">
                {/* Provisioning banner */}
                {isProvisioning && (
                  <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Loader2Icon className="size-4 animate-spin text-yellow-600 dark:text-yellow-400" />
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        Agent is being provisioned. KB management will be available once active.
                      </p>
                    </div>
                  </div>
                )}

                {/* Agent Name & Status */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="agent-name">Agent Name</Label>
                    <Badge
                      variant={agentDetail.status === "active" ? "default" : "secondary"}
                      className="capitalize"
                    >
                      {isProvisioning && (
                        <Loader2Icon className="size-3 mr-1 animate-spin" />
                      )}
                      {agentDetail.status}
                    </Badge>
                  </div>
                  <Input
                    id="agent-name"
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    disabled={isProvisioning}
                  />
                </div>

                {/* System Prompt */}
                <div className="space-y-2">
                  <Label htmlFor="agent-instruction">System Prompt</Label>
                  <p className="text-xs text-muted-foreground">
                    Define how your agent behaves, its personality, and what it should know.
                  </p>
                  <Textarea
                    id="agent-instruction"
                    value={agentInstruction}
                    onChange={(e) => setAgentInstruction(e.target.value)}
                    placeholder="You are a helpful customer support agent for..."
                    rows={8}
                    className="!field-sizing-fixed resize-y font-mono text-sm"
                    disabled={isProvisioning}
                  />
                </div>

                {/* Save button */}
                <div className="flex justify-end">
                  <Button
                    onClick={handleSaveAgent}
                    disabled={!hasAgentChanges || isSaving || !agentName.trim()}
                  >
                    {isSaving && <Loader2Icon className="size-4 animate-spin mr-1.5" />}
                    Save Changes
                  </Button>
                </div>

              </div>
            ) : (
              <p className="text-muted-foreground text-center py-20">Agent not found</p>
            )}
          </TabsContent>

          <TabsContent value="sources" className="!flex-1 overflow-y-auto px-6 py-6 min-h-0">
            {isLoadingAgent ? (
              <div className="flex items-center justify-center py-20">
                <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-1">
                  <h2 className="text-sm font-medium">Knowledge Bases</h2>
                  <p className="text-sm text-muted-foreground">
                    Attach knowledge bases to give your agent context from your documents.
                  </p>
                </div>

                {isProvisioning && (
                  <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Loader2Icon className="size-4 animate-spin text-yellow-600 dark:text-yellow-400" />
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        Agent is being provisioned. KB management will be available once active.
                      </p>
                    </div>
                  </div>
                )}

                {/* Attached knowledge bases */}
                <div className="space-y-2">
                  <Label>Attached</Label>
                  {agentDetail && agentDetail.knowledgeBases.length > 0 ? (
                    <div className="divide-y rounded-lg border">
                      {agentDetail.knowledgeBases.map((agentKb) => (
                        <div key={agentKb.id} className="flex items-center gap-3 px-4 py-3">
                          <FolderIcon className="size-4 shrink-0 text-primary" />
                          <span className="flex-1 text-sm truncate">
                            {agentKb.knowledgeBase.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {agentKb.knowledgeBase._count.sources} source{agentKb.knowledgeBase._count.sources !== 1 ? "s" : ""}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => handleDetachKb(agentKb.knowledgeBase.id)}
                            disabled={isProvisioning}
                          >
                            <TrashIcon className="size-3.5 text-muted-foreground" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm rounded-lg border px-4 py-3">
                      No knowledge bases attached yet.
                    </p>
                  )}
                </div>

                {/* Available knowledge bases to attach */}
                {!isProvisioning && unattachedKbs.length > 0 && (
                  <div className="space-y-2">
                    <Label>Available ({unattachedKbs.length})</Label>
                    <div className="divide-y rounded-lg border">
                      {unattachedKbs.map((kb) => (
                        <div key={kb.id} className="flex items-center gap-3 px-4 py-3">
                          <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
                          <span className="flex-1 text-sm truncate">{kb.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {kb._count.sources} source{kb._count.sources !== 1 ? "s" : ""}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAttachKb(kb.id)}
                            disabled={isAttaching}
                          >
                            Attach
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="widget" className="!flex-1 overflow-y-auto px-6 py-6 min-h-0">
            {isSettingsLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <CustomizationForm
                agentId={activeAgentId ?? widgetSettings?.agentId}
                initialData={widgetSettings}
              />
            )}
          </TabsContent>

          <TabsContent value="deploy" className="!flex-1 overflow-y-auto px-6 py-6 min-h-0">
            <div className="space-y-6">
              <div className="space-y-1">
                <h2 className="text-sm font-medium">Embed on your website</h2>
                <p className="text-sm text-muted-foreground">
                  Choose your framework and copy the embed code
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {INTEGRATIONS.map((integration) => (
                  <button
                    key={integration.id}
                    onClick={() => setSelectedIntegration(integration.id)}
                    type="button"
                    className={`flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent ${
                      selectedIntegration === integration.id
                        ? "border-primary bg-primary/5"
                        : "bg-background"
                    }`}
                  >
                    <Image
                      alt={integration.title}
                      height={24}
                      src={integration.icon}
                      width={24}
                    />
                    <span className="text-sm font-medium">
                      {integration.title}
                    </span>
                  </button>
                ))}
              </div>

              {selectedIntegration && embedSnippet && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Embed code</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCopySnippet}
                    >
                      <CopyIcon className="size-3.5 mr-1.5" />
                      Copy
                    </Button>
                  </div>
                  <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-muted p-4 font-mono text-xs">
                    {embedSnippet}
                  </pre>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Right Panel — Chat Preview */}
      <div className="flex w-[45%] flex-col items-center justify-center bg-muted/50 p-8">
        <div
          className="flex w-full max-w-sm flex-col overflow-hidden rounded-xl border bg-muted shadow-lg"
          style={{
            height: "600px",
            ...(themeColor ? {
              "--primary": themeColor,
              "--primary-foreground": "#ffffff",
            } as React.CSSProperties : {}),
          }}
        >
          {/* Widget header — matches actual widget */}
          <header
            className="flex items-center justify-between p-4 text-white"
            style={{
              background: themeColor
                ? `linear-gradient(to bottom, ${themeColor}, ${darkenHex(themeColor, 0.15)})`
                : "linear-gradient(to bottom, var(--primary), #0b63f3)",
            }}
          >
            <div className="flex items-center gap-x-2.5">
              <DicebearAvatar imageUrl={widgetLogo || "/logo.svg"} seed="assistant" size={28} />
              <p className="text-sm font-semibold">{activeAgent?.name ?? "AI Agent"}</p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="text-white hover:bg-white/20 size-8"
              onClick={initChat}
              disabled={isInitializing}
              title="Reset conversation"
            >
              <RotateCcwIcon className="size-4" />
            </Button>
          </header>

          {/* Chat messages */}
          {isInitializing ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <AIConversation>
                <AIConversationContent>
                  {messages.map((message) => (
                    <AIMessage
                      from={message.role === "user" ? "user" : "assistant"}
                      key={message.id}
                    >
                      <AIMessageContent
                        style={
                          message.role === "user" && themeColor
                            ? {
                                background: `linear-gradient(to bottom, ${themeColor}, ${darkenHex(themeColor, 0.15)})`,
                                borderColor: "transparent",
                              }
                            : undefined
                        }
                      >
                        <AIResponse>{message.content}</AIResponse>
                      </AIMessageContent>
                    </AIMessage>
                  ))}
                  {isTyping && (
                    <AIMessage from="assistant">
                      <AIMessageContent>
                        <div className="flex items-center gap-1 py-1 px-1">
                          <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
                          <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
                          <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
                        </div>
                      </AIMessageContent>
                    </AIMessage>
                  )}
                </AIConversationContent>
              </AIConversation>
              {/* Quick reply suggestions */}
              {messages.length > 0 && !hasUserMessage && suggestions.length > 0 && (
                <div className="flex flex-wrap justify-end gap-2 px-3 pb-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                        themeColor ? "" : "border-primary/20 bg-primary/5 text-primary hover:bg-primary/10"
                      }`}
                      style={themeColor ? {
                        borderColor: `${themeColor}33`,
                        backgroundColor: `${themeColor}0d`,
                        color: themeColor,
                      } : undefined}
                      onClick={() => handleSuggestionClick(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Chat input */}
          <div className="shrink-0 px-3 pb-1">
            <Form {...chatForm}>
              <form
                className="flex items-end gap-2 border bg-background pl-3 px-2 py-2 rounded-xl"
                onSubmit={chatForm.handleSubmit(onSendMessage)}
              >
                <FormField
                  control={chatForm.control}
                  name="message"
                  render={({ field }) => (
                    <AIInputTextarea
                      minHeight={24}
                      maxHeight={84}
                      className="!min-h-0 !p-0 text-sm"
                      placeholder="Message..."
                      onChange={field.onChange}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          chatForm.handleSubmit(onSendMessage)();
                        }
                      }}
                      value={field.value}
                    />
                  )}
                />
                <AIInputSubmit
                  className="size-8 rounded-xl"
                  disabled={!chatForm.formState.isValid || isInitializing}
                  status="ready"
                  type="submit"
                />
              </form>
            </Form>
            <div className="flex items-center justify-center gap-[1px] py-1.5 text-[10px] text-muted-foreground">
              <span>Powered by</span>
              <span className="font-semibold">Dochat</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
