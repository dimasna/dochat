"use client";

import { AISuggestion, AISuggestions } from "@workspace/ui/components/ai/suggestion";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { WidgetHeader } from "@/modules/widget/ui/components/widget-header";
import { Button } from "@workspace/ui/components/button";
import { useAtomValue, useSetAtom } from "jotai";
import { ArrowLeftIcon, MenuIcon } from "lucide-react";
import { DicebearAvatar } from "@workspace/ui/components/dicebear-avatar";
import { contactSessionAtomFamily, conversationIdAtom, organizationIdAtom, screenAtom, widgetSettingsAtom } from "../../atoms/widget-atoms";
import { Form, FormField } from "@workspace/ui/components/form";
import {
  AIConversation,
  AIConversationContent,
} from "@workspace/ui/components/ai/conversation";
import {
  AIInput,
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
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

interface MessageData {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

const formSchema = z.object({
  message: z.string().min(1, "Message is required"),
});

export const WidgetChatScreen = () => {
  const setScreen = useSetAtom(screenAtom);
  const setConversationId = useSetAtom(conversationIdAtom);

  const widgetSettings = useAtomValue(widgetSettingsAtom);
  const conversationId = useAtomValue(conversationIdAtom);
  const organizationId = useAtomValue(organizationIdAtom);
  const contactSession = useAtomValue(
    contactSessionAtomFamily(organizationId || "")
  );

  const [messages, setMessages] = useState<MessageData[]>([]);
  const [conversationStatus, setConversationStatus] = useState<string>("unresolved");

  const onBack = () => {
    setConversationId(null);
    setScreen("selection");
  };

  const suggestions = useMemo(() => {
    if (!widgetSettings) return [];
    return [widgetSettings.suggestion1, widgetSettings.suggestion2, widgetSettings.suggestion3].filter(Boolean) as string[];
  }, [widgetSettings]);

  // Load messages and poll for updates
  const loadMessages = useCallback(async () => {
    if (!conversationId || !contactSession?.sessionToken) return;

    try {
      const msgs = await api.getMessages(conversationId, contactSession.sessionToken);
      setMessages(msgs);

      const conv = await api.getConversation(conversationId, contactSession.sessionToken);
      setConversationStatus(conv.status);
    } catch {
      // ignore
    }
  }, [conversationId, contactSession?.sessionToken]);

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 2000);
    return () => clearInterval(interval);
  }, [loadMessages]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: {
      message: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!conversationId || !contactSession?.sessionToken) return;

    form.reset();

    // Optimistically add user message
    const tempMsg: MessageData = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: values.message,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);

    await api.sendMessage({
      conversationId,
      sessionToken: contactSession.sessionToken,
      content: values.message,
    });

    // Refresh messages to get the real ones + AI response
    await loadMessages();
  };

  return (
    <>
      <WidgetHeader className="flex items-center justify-between">
        <div className="flex items-center gap-x-2">
          <Button
            onClick={onBack}
            size="icon"
            variant="transparent"
          >
            <ArrowLeftIcon />
          </Button>
          <p>Chat</p>
        </div>
        <Button
          size="icon"
          variant="transparent"
        >
          <MenuIcon />
        </Button>
      </WidgetHeader>
      <AIConversation>
        <AIConversationContent>
          {messages.map((message) => (
            <AIMessage
              from={message.role === "user" ? "user" : "assistant"}
              key={message.id}
            >
              <AIMessageContent>
                <AIResponse>{message.content}</AIResponse>
              </AIMessageContent>
              {message.role === "assistant" && (
                <DicebearAvatar
                  imageUrl="/logo.svg"
                  seed="assistant"
                  size={32}
                />
              )}
            </AIMessage>
          ))}
        </AIConversationContent>
      </AIConversation>
      {messages.length === 1 && (
        <AISuggestions className="flex w-full flex-col items-end p-2">
          {suggestions.map((suggestion) => (
            <AISuggestion
              key={suggestion}
              onClick={() => {
                form.setValue("message", suggestion, {
                  shouldValidate: true,
                  shouldDirty: true,
                  shouldTouch: true,
                });
                form.handleSubmit(onSubmit)();
              }}
              suggestion={suggestion}
            />
          ))}
        </AISuggestions>
      )}
      <Form {...form}>
          <AIInput
            className="rounded-none border-x-0 border-b-0"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <FormField
              control={form.control}
              disabled={conversationStatus === "resolved"}
              name="message"
              render={({ field }) => (
                <AIInputTextarea
                  disabled={conversationStatus === "resolved"}
                  onChange={field.onChange}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      form.handleSubmit(onSubmit)();
                    }
                  }}
                  placeholder={
                    conversationStatus === "resolved"
                      ? "This conversation has been resolved."
                      : "Type your message..."
                  }
                  value={field.value}
                />
              )}
            />
            <AIInputToolbar>
              <AIInputTools />
              <AIInputSubmit
                disabled={conversationStatus === "resolved" || !form.formState.isValid}
                status="ready"
                type="submit"
              />
            </AIInputToolbar>
          </AIInput>
      </Form>
    </>
  );
};
