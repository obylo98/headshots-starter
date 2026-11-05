import { createAdminClient } from "@/lib/server/clients";
import {
  PaystackTransaction,
  fulfillTransaction,
  isValidWebhookSignature,
  verifyTransaction,
} from "@/lib/server/paystack";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Set this URL in Paystack Dashboard > Settings > API Keys & Webhooks:
//   https://YOUR-DOMAIN/api/paystack/webhook
// It grants credits even if the customer closes the tab before the redirect.
export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!isValidWebhookSignature(rawBody, request.headers.get("x-paystack-signature"))) {
    return NextResponse.json({ message: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody) as { event: string; data: PaystackTransaction };
  if (event.event !== "charge.success") {
    return NextResponse.json({ received: true });
  }

  try {
    // Re-verify with the API so we act on Paystack's own record.
    const tx = await verifyTransaction(event.data.reference);
    const result = await fulfillTransaction(createAdminClient(), tx);
    console.log("[paystack] webhook", tx.reference, result.reason);
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("[paystack] webhook error", e);
    // Non-2xx makes Paystack retry later.
    return NextResponse.json({ message: "Processing failed" }, { status: 500 });
  }
}
