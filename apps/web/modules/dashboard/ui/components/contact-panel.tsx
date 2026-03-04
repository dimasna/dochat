"use client";

import Bowser from "bowser";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion";
import { getCountryFlagUrl, getCountryFromTimezone } from "@/lib/country-utils";
import { Button } from "@workspace/ui/components/button";
import { DicebearAvatar } from "@workspace/ui/components/dicebear-avatar";
import { useQuery } from "@tanstack/react-query";
import { ClockIcon, GlobeIcon, MailIcon, MonitorIcon } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";

type InfoItem = {
  label: string;
  value: string | React.ReactNode;
  className?: string;
};

type InfoSection = {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  items: InfoItem[];
};

interface ConversationData {
  id: string;
  contactSession: {
    id: string;
    name: string;
    email: string;
    createdAt: string;
    metadata?: {
      userAgent?: string;
      language?: string;
      timezone?: string;
      timezoneOffset?: number;
      screenResolution?: string;
      viewportSize?: string;
      cookieEnabled?: boolean;
    } | null;
  };
}

export const ContactPanel = () => {
  const params = useParams();
  const conversationId = params.conversationId as string | null;

  const { data: conversation } = useQuery<ConversationData>({
    queryKey: ["conversation", conversationId],
    queryFn: async () => {
      const res = await fetch(`/api/conversations/${conversationId}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!conversationId,
  });

  const contactSession = conversation?.contactSession;

  const parseUserAgent = useMemo(() => {
    return (userAgent?: string) => {
      if (!userAgent) {
        return { browser: "Unknown", os: "Unknown", device: "Unknown" };
      }

      const browser = Bowser.getParser(userAgent);
      const result = browser.getResult();

      return {
        browser: result.browser.name || "Unknown",
        browserVersion: result.browser.version || "",
        os: result.os.name || "Unknown",
        osVersion: result.os.version || "",
        device: result.platform.type || "desktop",
        deviceVendor: result.platform.vendor || "",
        deviceModel: result.platform.model || "",
      };
    };
  }, []);

  const metadata = contactSession?.metadata;
  const userAgentInfo = useMemo(
    () => parseUserAgent(metadata?.userAgent),
    [metadata?.userAgent, parseUserAgent],
  );

  const countryInfo = useMemo(() => {
    return getCountryFromTimezone(metadata?.timezone);
  }, [metadata?.timezone]);

  const accordionSections = useMemo<InfoSection[]>(() => {
    if (!metadata) return [];

    return [
      {
        id: "device-info",
        icon: MonitorIcon,
        title: "Device Information",
        items: [
          {
            label: "Browser",
            value:
              userAgentInfo.browser +
              (userAgentInfo.browserVersion
                ? ` ${userAgentInfo.browserVersion}`
                : ""),
          },
          {
            label: "OS",
            value:
              userAgentInfo.os +
              (userAgentInfo.osVersion ? ` ${userAgentInfo.osVersion}` : ""),
          },
          {
            label: "Device",
            value:
              userAgentInfo.device +
              (userAgentInfo.deviceModel
                ? ` - ${userAgentInfo.deviceModel}`
                : ""),
            className: "capitalize",
          },
          { label: "Screen", value: metadata.screenResolution ?? "Unknown" },
          { label: "Viewport", value: metadata.viewportSize ?? "Unknown" },
          {
            label: "Cookies",
            value: metadata.cookieEnabled ? "Enabled" : "Disabled",
          },
        ],
      },
      {
        id: "location-info",
        icon: GlobeIcon,
        title: "Location & Language",
        items: [
          ...(countryInfo
            ? [{ label: "Country", value: countryInfo.name }]
            : []),
          { label: "Language", value: metadata.language ?? "Unknown" },
          { label: "Timezone", value: metadata.timezone ?? "Unknown" },
          {
            label: "UTC Offset",
            value: metadata.timezoneOffset?.toString() ?? "Unknown",
          },
        ],
      },
      {
        id: "section-details",
        title: "Session details",
        icon: ClockIcon,
        items: [
          {
            label: "Session Started",
            value: contactSession?.createdAt
              ? new Date(contactSession.createdAt).toLocaleString()
              : "Unknown",
          },
        ],
      },
    ];
  }, [contactSession, metadata, userAgentInfo, countryInfo]);

  if (!contactSession) return null;

  return (
    <div className="flex h-full w-full flex-col bg-background text-foreground">
      <div className="flex flex-col gap-y-4 p-4">
        <div className="flex items-center gap-x-2">
          <DicebearAvatar
            badgeImageUrl={
              countryInfo?.code
                ? getCountryFlagUrl(countryInfo.code)
                : undefined
            }
            seed={contactSession.id}
            size={42}
          />
          <div className="flex-1 overflow-hidden">
            <div className="flex items-center gap-x-2">
              <h4 className="line-clamp-1">{contactSession.name}</h4>
            </div>
            <p className="line-clamp-1 text-muted-foreground text-sm">
              {contactSession.email}
            </p>
          </div>
        </div>
        <Button asChild className="w-full" size="lg">
          <Link href={`mailto:${contactSession.email}`}>
            <MailIcon />
            <span>Send Email</span>
          </Link>
        </Button>
      </div>

      <div>
        {metadata && (
          <Accordion
            className="w-full rounded-none border-y"
            collapsible
            type="single"
          >
            {accordionSections.map((section) => (
              <AccordionItem
                className="rounded-none outline-none"
                key={section.id}
                value={section.id}
              >
                <AccordionTrigger className="flex w-full flex-1 items-start justify-between gap-4 rounded-none bg-accent px-5 py-4 text-left font-medium text-sm outline-none transition-all hover:no-underline">
                  <div className="flex items-center gap-4">
                    <section.icon className="size-4 shrink-0" />
                    <span>{section.title}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-5 py-4">
                  <div className="space-y-2 text-sm">
                    {section.items.map((item) => (
                      <div
                        className="flex justify-between"
                        key={`${section.id}-${item.label}`}
                      >
                        <span className="text-muted-foreground">
                          {item.label}:
                        </span>
                        <span className={item.className}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>
    </div>
  );
};
