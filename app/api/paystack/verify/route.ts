import { createAdminClient } from "@/lib/server/clients";
import { fulfillTransaction, verifyTransaction } from "@/lib/server/paystack";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Paystack redirects the customer here after checkout:
//   /api/paystack/verify?trxref=...&reference=...
// We verify with Paystack's API (never trust the redirect alone) and grant
// credits. The webhook does the same, so whichever arrives first wins.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const reference = url.searchParams.get("reference") ?? url.searchParams.get("trxref");
  const back = (status: string) => NextResponse.redirect(new URL(`/get-credits?payment=${status}`, url.origin));

  if (!reference) return back("failed");

  try {
    const tx = await verifyTransaction(reference);
    if (tx.status !== "success") return back(tx.status === "abandoned" ? "cancelled" : "failed");

    const result = await fulfillTransaction(createAdminClient(), tx);
    if (!result.granted && result.reason !== "already processed") {
      console.error("[paystack] verify not fulfilled", reference, result.reason);
      return back("failed");
    }
    return back("success");
  } catch (e) {
    console.error("[paystack] verify error", reference, e);
    return back("pending");
  }
}
