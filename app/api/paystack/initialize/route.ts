import { config } from "@/lib/config";
import { getCreditPack } from "@/lib/credit-packs";
import { initializeTransaction } from "@/lib/server/paystack";
import { Database } from "@/types/supabase";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Starts a Paystack checkout for a credit pack; returns the payment page URL. */
export async function POST(request: Request) {
  if (!config.paystackEnabled) {
    return NextResponse.json({ message: "Paystack is not enabled" }, { status: 400 });
  }

  const supabase = createRouteHandlerClient<Database>({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { packId } = await request.json().catch(() => ({ packId: null }));
  const pack = getCreditPack(packId);
  if (!pack) return NextResponse.json({ message: "Unknown credit pack" }, { status: 400 });

  const origin = new URL(request.url).origin;

  try {
    const tx = await initializeTransaction({
      email: user.email,
      amountKobo: pack.priceNgn * 100,
      callbackUrl: `${origin}/api/paystack/verify`,
      metadata: {
        user_id: user.id,
        pack_id: pack.id,
        credits: pack.credits,
        cancel_action: `${origin}/get-credits`,
      },
    });
    return NextResponse.json({ url: tx.authorization_url });
  } catch (e) {
    console.error("[paystack] initialize failed", e);
    return NextResponse.json({ message: "Could not start payment, please try again." }, { status: 502 });
  }
}
