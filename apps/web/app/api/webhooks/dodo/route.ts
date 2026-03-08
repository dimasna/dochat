import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@dochat/db";
import { dodoClient } from "@/lib/dodo";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const webhookHeaders: Record<string, string> = {
      "webhook-id": req.headers.get("webhook-id") ?? "",
      "webhook-signature": req.headers.get("webhook-signature") ?? "",
      "webhook-timestamp": req.headers.get("webhook-timestamp") ?? "",
    };

    const event = await dodoClient.webhooks.unwrap(rawBody, {
      headers: webhookHeaders,
      key: process.env.DODO_PAYMENTS_WEBHOOK_SECRET,
    });

    const eventType = event.type;

    if (
      eventType === "subscription.active" ||
      eventType === "subscription.renewed" ||
      eventType === "subscription.plan_changed" ||
      eventType === "subscription.cancelled" ||
      eventType === "subscription.expired" ||
      eventType === "subscription.failed" ||
      eventType === "subscription.on_hold"
    ) {
      const sub = event.data;

      switch (eventType) {
        case "subscription.active": {
          const orgId = sub.metadata?.orgId;
          if (!orgId) break;

          const plan = sub.metadata.plan ?? "starter";

          await prisma.subscription.upsert({
            where: { orgId },
            update: {
              plan,
              status: "active",
              dodoCustomerId: sub.customer.customer_id,
              dodoSubscriptionId: sub.subscription_id,
              currentPeriodStart: sub.previous_billing_date
                ? new Date(sub.previous_billing_date)
                : new Date(),
              currentPeriodEnd: sub.next_billing_date
                ? new Date(sub.next_billing_date)
                : null,
            },
            create: {
              orgId,
              plan,
              status: "active",
              dodoCustomerId: sub.customer.customer_id,
              dodoSubscriptionId: sub.subscription_id,
              currentPeriodStart: sub.previous_billing_date
                ? new Date(sub.previous_billing_date)
                : new Date(),
              currentPeriodEnd: sub.next_billing_date
                ? new Date(sub.next_billing_date)
                : null,
            },
          });
          break;
        }

        case "subscription.renewed": {
          await prisma.subscription.updateMany({
            where: { dodoSubscriptionId: sub.subscription_id },
            data: {
              currentPeriodStart: sub.previous_billing_date
                ? new Date(sub.previous_billing_date)
                : new Date(),
              currentPeriodEnd: sub.next_billing_date
                ? new Date(sub.next_billing_date)
                : null,
            },
          });
          break;
        }

        case "subscription.plan_changed": {
          await prisma.subscription.updateMany({
            where: { dodoSubscriptionId: sub.subscription_id },
            data: { plan: sub.metadata?.plan ?? "pro" },
          });
          break;
        }

        case "subscription.cancelled":
        case "subscription.expired": {
          await prisma.subscription.updateMany({
            where: { dodoSubscriptionId: sub.subscription_id },
            data: {
              status: "cancelled",
              plan: "free",
              dodoSubscriptionId: null,
              currentPeriodStart: null,
              currentPeriodEnd: null,
            },
          });
          break;
        }

        case "subscription.failed":
        case "subscription.on_hold": {
          await prisma.subscription.updateMany({
            where: { dodoSubscriptionId: sub.subscription_id },
            data: { status: "inactive" },
          });
          break;
        }
      }
    } else {
      console.log(`[dodo-webhook] Unhandled event: ${eventType}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[dodo-webhook] Error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 400 },
    );
  }
}
