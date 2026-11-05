import "server-only";

import { getCreditPack } from "@/lib/credit-packs";
import { AdminClient } from "@/lib/server/clients";
import { createHmac, timingSafeEqual } from "crypto";

const PAYSTACK_API = "https://api.paystack.co";

function secretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("Missing PAYSTACK_SECRET_KEY");
  return key;
}

async function paystack<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${PAYSTACK_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.status) {
    throw new Error(`Paystack ${path} failed (${res.status}): ${body?.message ?? "unknown error"}`);
  }
  return body.data as T;
}

export type PaystackTransaction = {
  id: number;
  status: string; // "success" | "failed" | "abandoned" | ...
  reference: string;
  amount: number; // kobo
  currency: string;
  customer?: { email?: string };
  metadata?: { user_id?: string; pack_id?: string; credits?: number } | string | null;
};

export async function initializeTransaction(args: {
  email: string;
  amountKobo: number;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}) {
  return paystack<{ authorization_url: string; access_code: string; reference: string }>(
    "/transaction/initialize",
    {
      method: "POST",
      body: JSON.stringify({
        email: args.email,
        amount: args.amountKobo,
        currency: "NGN",
        callback_url: args.callbackUrl,
        metadata: args.metadata,
      }),
    }
  );
}

export async function verifyTransaction(reference: string) {
  return paystack<PaystackTransaction>(`/transaction/verify/${encodeURIComponent(reference)}`);
}

/** Validates the x-paystack-signature header (HMAC-SHA512 of the raw body). */
export function isValidWebhookSignature(rawBody: string, signature: string | null) {
  if (!signature) return false;
  const expected = createHmac("sha512", secretKey()).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Grants credits for a successful Paystack transaction, exactly once.
 * The pack and price are re-checked against our own config so a tampered
 * metadata or amount can't grant extra credits.
 */
export async function fulfillTransaction(admin: AdminClient, tx: PaystackTransaction) {
  if (tx.status !== "success") return { granted: false, reason: `status ${tx.status}` };

  const meta = typeof tx.metadata === "string" ? safeParse(tx.metadata) : tx.metadata;
  const pack = getCreditPack(meta?.pack_id);
  const userId = meta?.user_id;
  if (!pack || !userId) return { granted: false, reason: "missing pack or user in metadata" };

  if (tx.currency !== "NGN" || tx.amount < pack.priceNgn * 100) {
    console.error("[paystack] amount mismatch", { reference: tx.reference, amount: tx.amount, pack });
    return { granted: false, reason: "amount mismatch" };
  }

  const { data: granted, error } = await admin.rpc("grant_payment_credits", {
    p_user_id: userId,
    p_provider: "paystack",
    p_reference: tx.reference,
    p_amount: tx.amount,
    p_currency: tx.currency,
    p_credits: pack.credits,
    p_pack_id: pack.id,
  });
  if (error) throw error;
  return { granted: Boolean(granted), reason: granted ? "granted" : "already processed", pack };
}

function safeParse(value: string) {
  try {
    return JSON.parse(value) as { user_id?: string; pack_id?: string };
  } catch {
    return null;
  }
}
