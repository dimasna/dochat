import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, getErrorStatus } from "@/lib/auth";
import { dodoClient } from "@/lib/dodo";

const PRODUCT_IDS: Record<string, string | undefined> = {
  starter: process.env.DODO_STARTER_PRODUCT_ID,
  growth: process.env.DODO_GROWTH_PRODUCT_ID,
  scale: process.env.DODO_SCALE_PRODUCT_ID,
};

export async function POST(req: NextRequest) {
  try {
    const { orgId, userId } = await getAuthUser();
    if (!orgId) {
      return NextResponse.json({ error: "No organization" }, { status: 400 });
    }

    const { plan } = await req.json();
    const productId = PRODUCT_IDS[plan];
    if (!productId) {
      return NextResponse.json(
        { error: "Invalid plan" },
        { status: 400 },
      );
    }

    const session = await dodoClient.checkoutSessions.create({
      product_cart: [{ product_id: productId, quantity: 1 }],
      metadata: { orgId, userId, plan },
      return_url: `${req.nextUrl.origin}/billing?success=true`,
    });

    return NextResponse.json({ checkoutUrl: session.checkout_url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: getErrorStatus(error) });
  }
}
