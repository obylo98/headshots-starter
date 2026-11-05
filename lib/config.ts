// NEXT_PUBLIC_* values are inlined at build time, so these work on both the
// server and in the browser.
export const config = {
  stripeEnabled: process.env.NEXT_PUBLIC_STRIPE_IS_ENABLED === "true",
  paystackEnabled: process.env.NEXT_PUBLIC_PAYSTACK_IS_ENABLED === "true",
} as const;

/** Credits are charged for generations when any payment provider is on. */
export const creditsEnabled = config.stripeEnabled || config.paystackEnabled;

export function validateConfig() {
  // Only the server can see secret keys; skip the checks in the browser bundle.
  if (typeof window !== "undefined") return;

  if (!process.env.FAL_KEY) {
    console.warn(
      "FAL_KEY is not set. Headshot generation will fail until you add your fal.ai API key (https://fal.ai/dashboard/keys)."
    );
  }
  if (config.paystackEnabled && !process.env.PAYSTACK_SECRET_KEY) {
    console.warn("NEXT_PUBLIC_PAYSTACK_IS_ENABLED is true but PAYSTACK_SECRET_KEY is missing.");
  }
}
