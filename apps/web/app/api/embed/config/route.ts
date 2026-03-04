import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@dochat/db";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) {
    return NextResponse.json(
      { error: "orgId required" },
      { status: 400, headers: corsHeaders },
    );
  }

  const settings = await prisma.widgetSettings.findUnique({
    where: { orgId },
  });

  if (!settings) {
    return NextResponse.json(
      { error: "Widget not configured" },
      { status: 404, headers: corsHeaders },
    );
  }

  return NextResponse.json(
    {
      greetMessage: settings.greetMessage,
      suggestion1: settings.suggestion1,
      suggestion2: settings.suggestion2,
      suggestion3: settings.suggestion3,
      vapiAssistantId: settings.vapiAssistantId,
      vapiPhoneNumber: settings.vapiPhoneNumber,
    },
    { headers: corsHeaders },
  );
}
