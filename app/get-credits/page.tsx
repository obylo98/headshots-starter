import PaystackPacks from "@/components/paystack/PaystackPacks";
import StripePricingTable from "@/components/stripe/StripeTable";
import { config } from "@/lib/config";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const messages: Record<string, { text: string; tone: "ok" | "warn" | "error" }> = {
  success: { text: "Payment successful. Your credits have been added.", tone: "ok" },
  pending: {
    text: "We're confirming your payment. Credits will appear in a minute. Refresh if they don't.",
    tone: "warn",
  },
  cancelled: { text: "Payment was cancelled. You haven't been charged.", tone: "warn" },
  failed: { text: "Payment didn't go through. You haven't been charged. Please try again.", tone: "error" },
};

export default async function GetCreditsPage({
  searchParams,
}: {
  searchParams?: { payment?: string };
}) {
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return redirect("/login");

  const notice = searchParams?.payment ? messages[searchParams.payment] : undefined;

  return (
    <div className="container max-w-5xl py-10 flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Get credits</h1>
        <p className="text-muted-foreground">Buy credits to generate headshots with any AI model.</p>
      </div>

      {notice && (
        <div
          role="status"
          className={
            "rounded-md border p-4 text-sm " +
            (notice.tone === "ok"
              ? "border-green-500/50"
              : notice.tone === "warn"
                ? "border-yellow-500/50"
                : "border-destructive/50")
          }
        >
          {notice.text}
        </div>
      )}

      {config.paystackEnabled && <PaystackPacks />}

      {config.stripeEnabled && (
        <div className="flex flex-col gap-4">
          {config.paystackEnabled && <h2 className="text-lg font-medium">Pay with card (Stripe, USD)</h2>}
          <StripePricingTable user={user} />
        </div>
      )}

      {!config.paystackEnabled && !config.stripeEnabled && (
        <p className="text-muted-foreground">Payments are not enabled on this site.</p>
      )}
    </div>
  );
}
