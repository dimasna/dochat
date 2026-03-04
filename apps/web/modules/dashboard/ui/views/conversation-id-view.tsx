"use client";

import { Button } from "@workspace/ui/components/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontalIcon, Wand2Icon } from "lucide-react";
import {
  AIConversation,
  AIConversationContent,
  AIConversationScrollButton,
} from "@workspace/ui/components/ai/conversation";
import {
  AIInput,
  AIInputButton,
  AIInputSubmit,
  AIInputTextarea,
  AIInputToolbar,
  AIInputTools,
} from "@workspace/ui/components/ai/input";
import {
  AIMessage,
  AIMessageContent,
} from "@workspace/ui/components/ai/message";
import { AIResponse } from "@workspace/ui/components/ai/response";
import { Form, FormField } from "@workspace/ui/components/form";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DicebearAvatar } from "@workspace/ui/components/dicebear-avatar";
import { ConversationStatusButton } from "../components/conversation-status-button";
import { useState, useEffect, useCallback } from "react";
import { cn } from "@workspace/ui/lib/utils";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { toast } from "sonner";

interface Message {
  id: string;
  role: string;
  content: string;
  metadata?: unknown;
  createdAt: string;
}

interface Conversation {
  id: string;
  status: string;
  contactSessionId: string;
  contactSession: { id: string; name: string; email: string };
  messages: Message[];
}

const formSchema = z.object({
  message: z.string().min(1, "Message is required"),
});

export const ConversationIdView = ({
  conversationId,
}: {
  conversationId: string;
}) => {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<Message[]>([]);

  const { data: conversation, isLoading: isLoadingConversation } =
    useQuery<Conversation>({
      queryKey: ["conversation", conversationId],
      queryFn: async () => {
        const res = await fetch(`/api/conversations/${conversationId}`);
        if (!res.ok) throw new Error("Failed to fetch conversation");
        return res.json();
      },
    });

  // SSE for real-time messages
  useEffect(() => {
    const eventSource = new EventSource(
      `/api/conversations/${conversationId}/messages/stream`,
    );

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "init") {
        setMessages(data.messages);
      } else if (data.type === "message") {
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === data.message.id);
          if (exists) return prev;
          return [...prev, data.message];
        });
      } else if (data.type === "status") {
        queryClient.invalidateQueries({
          queryKey: ["conversation", conversationId],
        });
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => eventSource.close();
  }, [conversationId, queryClient]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { message: "" },
  });

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(
        `/api/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        },
      );
      if (!res.ok) throw new Error("Failed to send message");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["conversation", conversationId],
      });
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      await sendMessage.mutateAsync(values.message);
      form.reset();
    } catch (error) {
      console.error(error);
      toast.error("Failed to send message");
    }
  };

  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const handleToggleStatus = async () => {
    if (!conversation) return;

    setIsUpdatingStatus(true);

    let newStatus: "unresolved" | "resolved" | "escalated";
    if (conversation.status === "unresolved") {
      newStatus = "escalated";
    } else if (conversation.status === "escalated") {
      newStatus = "resolved";
    } else {
      newStatus = "unresolved";
    }

    try {
      await fetch(`/api/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      queryClient.invalidateQueries({
        queryKey: ["conversation", conversationId],
      });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    } catch (error) {
      console.error(error);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  if (isLoadingConversation) {
    return <ConversationIdViewLoading />;
  }

  return (
    <div className="flex h-full flex-col bg-muted">
      <header className="flex items-center justify-between border-b bg-background p-2.5">
        <Button size="sm" variant="ghost">
          <MoreHorizontalIcon />
        </Button>
        {!!conversation && (
          <ConversationStatusButton
            onClick={handleToggleStatus}
            status={conversation.status}
            disabled={isUpdatingStatus}
          />
        )}
      </header>
      <AIConversation className="max-h-[calc(100vh-180px)]">
        <AIConversationContent>
          {messages.map((message) => (
            <AIMessage
              from={message.role === "user" ? "assistant" : "user"}
              key={message.id}
            >
              <AIMessageContent>
                <AIResponse>{message.content}</AIResponse>
              </AIMessageContent>
              {message.role === "user" && (
                <DicebearAvatar
                  seed={conversation?.contactSession?.id ?? "user"}
                  size={32}
                />
              )}
            </AIMessage>
          ))}
        </AIConversationContent>
        <AIConversationScrollButton />
      </AIConversation>

      <div className="p-2">
        <Form {...form}>
          <AIInput onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              disabled={conversation?.status === "resolved"}
              name="message"
              render={({ field }) => (
                <AIInputTextarea
                  disabled={
                    conversation?.status === "resolved" ||
                    form.formState.isSubmitting
                  }
                  onChange={field.onChange}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      form.handleSubmit(onSubmit)();
                    }
                  }}
                  placeholder={
                    conversation?.status === "resolved"
                      ? "This conversation has been resolved"
                      : "Type your response as an operator..."
                  }
                  value={field.value}
                />
              )}
            />
            <AIInputToolbar>
              <AIInputTools />
              <AIInputSubmit
                disabled={
                  conversation?.status === "resolved" ||
                  !form.formState.isValid ||
                  form.formState.isSubmitting
                }
                status="ready"
                type="submit"
              />
            </AIInputToolbar>
          </AIInput>
        </Form>
      </div>
    </div>
  );
};

export const ConversationIdViewLoading = () => {
  return (
    <div className="flex h-full flex-col bg-muted">
      <header className="flex items-center justify-between border-b bg-background p-2.5">
        <Button disabled size="sm" variant="ghost">
          <MoreHorizontalIcon />
        </Button>
      </header>
      <AIConversation className="max-h-[calc(100vh-180px)]">
        <AIConversationContent>
          {Array.from({ length: 8 }, (_, index) => {
            const isUser = index % 2 === 0;
            const widths = ["w-48", "w-60", "w-72"];
            const width = widths[index % widths.length];

            return (
              <div
                className={cn(
                  "group flex w-full items-end justify-end gap-2 py-2 [&>div]:max-w-[80%]",
                  isUser ? "is-user" : "is-assistant flex-row-reverse",
                )}
                key={index}
              >
                <Skeleton
                  className={`h-9 ${width} rounded-lg bg-neutral-200`}
                />
                <Skeleton className="size-8 rounded-full bg-neutral-200" />
              </div>
            );
          })}
        </AIConversationContent>
      </AIConversation>

      <div className="p-2">
        <AIInput>
          <AIInputTextarea
            disabled
            placeholder="Type your response as an operator..."
          />
          <AIInputToolbar>
            <AIInputTools />
            <AIInputSubmit disabled status="ready" />
          </AIInputToolbar>
        </AIInput>
      </div>
    </div>
  );
};
