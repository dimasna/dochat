"use client";

import { use } from "react";

import { WidgetView } from "@/modules/widget/ui/views/widget-view";

interface Props {
  searchParams: Promise<{
    organizationId: string;
    agentId?: string;
  }>
};

const Page = ({ searchParams }: Props) => {
  const { organizationId, agentId } = use(searchParams);

  return (
    <WidgetView organizationId={organizationId} agentId={agentId ?? null} />
  );
};

export default Page;
