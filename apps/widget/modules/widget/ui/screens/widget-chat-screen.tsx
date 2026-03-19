"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { WidgetHeader } from "@/modules/widget/ui/components/widget-header";
import { Button } from "@workspace/ui/components/button";
import { useAtomValue, useSetAtom } from "jotai";
import { ClockIcon, MessageSquareTextIcon, MoreHorizontalIcon, SquarePenIcon, UserIcon, XIcon } from "lucide-react";
import { agentIdAtom, contactSessionAtomFamily, conversationIdAtom, organizationIdAtom, widgetSettingsAtom } from "../../atoms/widget-atoms";
import { Form, FormField } from "@workspace/ui/components/form";
import {
  AIConversation,
  AIConversationContent,
} from "@workspace/ui/components/ai/conversation";
import {
  AIInputSubmit,
  AIInputTextarea,
} from "@workspace/ui/components/ai/input";
import {
  AIMessage,
  AIMessageContent,
} from "@workspace/ui/components/ai/message";
import { AIResponse } from "@workspace/ui/components/ai/response";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { ConversationStatusIcon } from "@workspace/ui/components/conversation-status-icon";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { api } from "@/lib/api";

interface MessageData {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

interface ConversationItem {
  id: string;
  status: string;
  createdAt: string;
  lastMessage: { text: string; role: string } | null;
}

const formSchema = z.object({
  message: z.string().min(1, "Message is required"),
});

export const WidgetChatScreen = () => {
  const setConversationId = useSetAtom(conversationIdAtom);

  const widgetSettings = useAtomValue(widgetSettingsAtom);
  const conversationId = useAtomValue(conversationIdAtom);
  const organizationId = useAtomValue(organizationIdAtom);
  const agentId = useAtomValue(agentIdAtom);
  const contactSession = useAtomValue(
    contactSessionAtomFamily(organizationId || "")
  );

  // Local greeting message shown before any conversation is created
  const greetingMessage = useMemo<MessageData | null>(() => {
    if (!widgetSettings?.greetMessage) return null;
    return {
      id: "greeting",
      role: "assistant",
      content: widgetSettings.greetMessage,
      createdAt: new Date().toISOString(),
    };
  }, [widgetSettings?.greetMessage]);

  const [messages, setMessages] = useState<MessageData[]>([]);
  const [conversationStatus, setConversationStatus] = useState<string>("unresolved");
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [isMultiline, setIsMultiline] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  // Combined messages: local greeting (when no conversation yet) + real messages
  const displayMessages = useMemo(() => {
    if (messages.length > 0) return messages;
    return greetingMessage ? [greetingMessage] : [];
  }, [messages, greetingMessage]);

  // Restore last active conversation on mount (e.g. after page reload)
  useEffect(() => {
    if (conversationId || !contactSession?.sessionToken) return;
    api.getConversations(contactSession.sessionToken).then((convs) => {
      const active = convs.find((c) => c.status !== "resolved");
      if (active) {
        setConversationId(active.id);
        setConversationStatus(active.status);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Execute menu actions after dropdown closes to avoid fetch abort
  useEffect(() => {
    if (menuOpen || !pendingAction) return;

    const action = pendingAction;
    setPendingAction(null);

    if (action === "new-chat") {
      // Just reset state — conversation will be created on first message
      setMessages([]);
      setConversationStatus("unresolved");
      setShowHistory(false);
      setConversationId(null);
    } else if (action === "end-chat") {
      if (!conversationId || !contactSession?.sessionToken) return;
      api.endConversation(conversationId, contactSession.sessionToken).then(() => {
        setConversationStatus("resolved");
      });
    } else if (action === "view-history") {
      if (!contactSession?.sessionToken) return;
      api.getConversations(contactSession.sessionToken).then((convs) => {
        setConversations(convs);
        setShowHistory(true);
      });
    }
  }, [menuOpen, pendingAction, organizationId, agentId, conversationId, contactSession, setConversationId]);

  const onSelectConversation = (id: string) => {
    setShowHistory(false);
    setMessages([]);
    setConversationStatus("unresolved");
    setConversationId(id);
  };

  const suggestions = useMemo(() => {
    if (!widgetSettings) return [];
    return [widgetSettings.suggestion1, widgetSettings.suggestion2, widgetSettings.suggestion3].filter(Boolean) as string[];
  }, [widgetSettings]);

  // SSE for real-time messages
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!conversationId || !contactSession?.sessionToken) return;

    let retryCount = 0;
    let retryTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      const url = api.getMessagesStreamUrl(conversationId, contactSession.sessionToken);
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          retryCount = 0; // reset on successful message
          const data = JSON.parse(event.data);
          if (data.type === "init") {
            setMessages(data.messages);
          } else if (data.type === "message") {
            if (data.message.role === "assistant" || data.message.role === "support") {
              setIsTyping(false);
            }
            setMessages((prev) => {
              // Deduplicate and replace optimistic temp messages
              const filtered = prev.filter(
                (m) => m.id !== data.message.id && !m.id.startsWith("temp-"),
              );
              return [...filtered, data.message];
            });
          } else if (data.type === "status") {
            setConversationStatus(data.status);
          }
        } catch {
          // Ignore malformed events
        }
      };

      es.onerror = () => {
        es.close();
        retryCount++;
        if (retryCount <= 10) {
          const delay = Math.min(1000 * 2 ** retryCount, 30000);
          retryTimer = setTimeout(connect, delay);
        }
      };
    };

    connect();

    return () => {
      clearTimeout(retryTimer);
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, [conversationId, contactSession?.sessionToken]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: {
      message: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!contactSession?.sessionToken) return;

    form.reset();
    setIsMultiline(false);

    // Optimistically add user message (SSE will replace with real message)
    const tempMsg: MessageData = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: values.message,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);
    setIsTyping(true);

    // Create conversation on first message if none exists
    let activeConversationId = conversationId;
    if (!activeConversationId) {
      if (!organizationId) return;
      const result = await api.createConversation(
        contactSession.sessionToken,
        organizationId,
        agentId ?? undefined,
      );
      activeConversationId = result.conversationId;
      setConversationId(activeConversationId);
    }

    const response = await api.sendMessage({
      conversationId: activeConversationId,
      sessionToken: contactSession.sessionToken,
      content: values.message,
    });

    // Use API response directly so messages render even if SSE is delayed
    const { userMessage, assistantMessage } = response;
    if (userMessage) {
      setMessages((prev) => {
        const filtered = prev.filter(
          (m) => !m.id.startsWith("temp-") && m.id !== userMessage.id,
        );
        return [...filtered, userMessage];
      });
    }
    if (assistantMessage) {
      setIsTyping(false);
      setMessages((prev) => {
        if (prev.some((m) => m.id === assistantMessage.id)) return prev;
        return [...prev, assistantMessage];
      });
    } else {
      setIsTyping(false);
    }
  };

  return (
    <>
      <WidgetHeader className="flex items-center justify-between">
        <div className="flex items-center gap-x-2.5">
          {widgetSettings?.widgetLogo ? (
            <img src={widgetSettings.widgetLogo} alt="" className="size-7 rounded-full object-cover" />
          ) : (
            <div className="flex size-7 items-center justify-center rounded-full bg-white/20">
              <MessageSquareTextIcon className="size-4" />
            </div>
          )}
          <p className="text-sm font-semibold">{widgetSettings?.agentName || "AI Agent"}</p>
        </div>
        <div className="flex items-center">
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="transparent">
                <MoreHorizontalIcon className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onSelect={() => setPendingAction("new-chat")}>
                <SquarePenIcon className="size-4" />
                Start a new chat
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => setPendingAction("end-chat")}
                disabled={conversationStatus === "resolved"}
              >
                <XIcon className="size-4" />
                End chat
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setPendingAction("view-history")}>
                <ClockIcon className="size-4" />
                View recent chats
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </WidgetHeader>
      {conversationStatus === "escalated" && (
        <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 text-xs text-blue-700">
          <UserIcon className="size-3.5" />
          <span>You&apos;re now connected with a support agent</span>
        </div>
      )}
      {showHistory ? (
        <div className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="text-sm font-medium">Recent chats</p>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowHistory(false)}
            >
              Back
            </Button>
          </div>
          <div className="flex flex-1 flex-col gap-y-1 p-2">
            {conversations.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No recent chats
              </p>
            ) : (
              conversations.map((conversation) => (
                <button
                  className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left hover:bg-accent transition-colors"
                  key={conversation.id}
                  onClick={() => onSelectConversation(conversation.id)}
                >
                  <div className="flex flex-col gap-1 overflow-hidden">
                    <p className="truncate text-sm">
                      {conversation.lastMessage?.text || "New conversation"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(conversation.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  <ConversationStatusIcon
                    status={conversation.status as "unresolved" | "escalated" | "resolved"}
                    className="shrink-0 ml-2"
                  />
                </button>
              ))
            )}
          </div>
        </div>
      ) : (
        <>
          <AIConversation>
            <AIConversationContent>
              {displayMessages.map((message) => {
                const isCustomer = message.role === "user";
                return (
                  <AIMessage
                    from={isCustomer ? "user" : "assistant"}
                    key={message.id}
                  >
                    <AIMessageContent>
                      {message.role === "support" && (
                        <span className="text-[10px] text-muted-foreground mb-0.5 block">
                          Support Agent
                        </span>
                      )}
                      <AIResponse>{message.content}</AIResponse>
                    </AIMessageContent>
                  </AIMessage>
                );
              })}
              {isTyping && (
                <AIMessage from="assistant">
                  <AIMessageContent>
                    <div className="flex items-center gap-1 py-1">
                      <span className="size-1.5 rounded-full bg-muted-foreground animate-[typing-dot_1.4s_ease-in-out_infinite]" />
                      <span className="size-1.5 rounded-full bg-muted-foreground animate-[typing-dot_1.4s_ease-in-out_0.2s_infinite]" />
                      <span className="size-1.5 rounded-full bg-muted-foreground animate-[typing-dot_1.4s_ease-in-out_0.4s_infinite]" />
                    </div>
                  </AIMessageContent>
                </AIMessage>
              )}
            </AIConversationContent>
          </AIConversation>
          {displayMessages.length > 0 && !displayMessages.some((m) => m.role === "user") && suggestions.length > 0 && (
            <div className="flex flex-wrap justify-end gap-2 px-3 pb-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="cursor-pointer rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                  onClick={() => {
                    form.setValue("message", suggestion, {
                      shouldValidate: true,
                      shouldDirty: true,
                      shouldTouch: true,
                    });
                    form.handleSubmit(onSubmit)();
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      <div className="shrink-0 px-3 pb-1">
        <Form {...form}>
          <form
            className={`flex items-end gap-2 border bg-background pl-3 px-2 py-2 rounded-xl`}
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <FormField
              control={form.control}
              disabled={conversationStatus === "resolved"}
              name="message"
              render={({ field }) => (
                <AIInputTextarea
                  minHeight={24}
                  maxHeight={84}
                  className="!min-h-0 !p-0 text-sm"
                  disabled={conversationStatus === "resolved"}
                  onChange={(e) => {
                    field.onChange(e);
                    const target = e.target as HTMLTextAreaElement;
                    setIsMultiline(target.value.includes("\n") || target.scrollHeight > 32);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      form.handleSubmit(onSubmit)();
                    }
                  }}
                  placeholder={
                    conversationStatus === "resolved"
                      ? "This conversation has been resolved."
                      : "Message..."
                  }
                  value={field.value}
                />
              )}
            />
            <AIInputSubmit
              className="size-8 rounded-xl"
              disabled={conversationStatus === "resolved" || !form.formState.isValid}
              status="ready"
              type="submit"
            />
          </form>
        </Form>
        <div className="flex items-center justify-center gap-0.5 py-1.5 text-[10px] text-muted-foreground">
          <span>Powered by</span>
          <svg width="12" height="12" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="ml-0.5">
            <rect x="2" y="2" width="36" height="30" rx="8" fill="currentColor" className="text-primary" />
            <polygon points="8,32 14,26 20,32" fill="currentColor" className="text-primary" />
            <rect x="10" y="11" width="14" height="2.5" rx="1.25" fill="white" />
            <rect x="10" y="16" width="20" height="2.5" rx="1.25" fill="white" />
            <rect x="10" y="21" width="10" height="2.5" rx="1.25" fill="white" />
          </svg>
          <span className="font-semibold">Dochat</span>
        </div>
      </div>
    </>
  );
};
