"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeftIcon } from "lucide-react";
import { contactSessionAtomFamily, conversationIdAtom, organizationIdAtom, screenAtom } from "@/modules/widget/atoms/widget-atoms";
import { ConversationStatusIcon } from "@workspace/ui/components/conversation-status-icon";
import { WidgetHeader } from "@/modules/widget/ui/components/widget-header";
import { WidgetFooter } from "../components/widget-footer";
import { Button } from "@workspace/ui/components/button";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface ConversationItem {
  id: string;
  status: string;
  createdAt: string;
  lastMessage: { text: string; role: string } | null;
}

export const WidgetInboxScreen = () => {
  const setScreen = useSetAtom(screenAtom);
  const setConversationId = useSetAtom(conversationIdAtom);

  const organizationId = useAtomValue(organizationIdAtom);
  const contactSession = useAtomValue(
    contactSessionAtomFamily(organizationId || "")
  );

  const [conversations, setConversations] = useState<ConversationItem[]>([]);

  useEffect(() => {
    if (!contactSession?.sessionToken) return;

    api.getConversations(contactSession.sessionToken)
      .then(setConversations)
      .catch(() => {});
  }, [contactSession?.sessionToken]);

  return (
    <>
      <WidgetHeader>
        <div className="flex items-center gap-x-2">
          <Button
            variant="transparent"
            size="icon"
            onClick={() => setScreen("selection")}
          >
            <ArrowLeftIcon />
          </Button>
          <p>Inbox</p>
        </div>
      </WidgetHeader>
      <div className="flex flex-1 flex-col gap-y-2 p-4 overflow-y-auto">
        {conversations.length > 0 &&
          conversations.map((conversation) => (
            <Button
              className="h-20 w-full justify-between"
              key={conversation.id}
              onClick={() => {
                setConversationId(conversation.id);
                setScreen("chat");
              }}
              variant="outline"
            >
              <div className="flex w-full flex-col gap-4 overflow-hidden text-start">
                <div className="flex w-full items-center justify-between gap-x-2">
                  <p className="text-muted-foreground text-xs">Chat</p>
                  <p className="text-muted-foreground text-xs">
                    {formatDistanceToNow(new Date(conversation.createdAt))}
                  </p>
                </div>
                <div className="flex w-full items-center justify-between gap-x-2">
                  <p className="truncate text-sm">
                    {conversation.lastMessage?.text}
                  </p>
                  <ConversationStatusIcon status={conversation.status as "unresolved" | "escalated" | "resolved"} className="shrink-0" />
                </div>
              </div>
            </Button>
          ))
        }
      </div>
      <WidgetFooter />
    </>
  );
};
