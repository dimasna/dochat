import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3005";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("orgId");
  const agentId = req.nextUrl.searchParams.get("agentId");

  if (!orgId) {
    return NextResponse.json(
      { error: "orgId required" },
      { status: 400, headers: corsHeaders },
    );
  }

  try {
    const params = new URLSearchParams({ orgId });
    if (agentId) params.set("agentId", agentId);

    const res = await fetch(`${API_BASE}/api/embed/config?${params}`);
    const data = await res.json();

    return NextResponse.json(data, {
      status: res.status,
      headers: corsHeaders,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch config" },
      { status: 502, headers: corsHeaders },
    );
  }
}
