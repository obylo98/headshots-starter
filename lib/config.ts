export const config = {
  stripeEnabled: process.env.NEXT_PUBLIC_STRIPE_IS_ENABLED === "true",
} as const;

export function validateConfig() {
  // Only the server can see FAL_KEY; skip the check in the browser bundle.
  if (typeof window === "undefined" && !process.env.FAL_KEY) {
    console.warn(
      "FAL_KEY is not set. Headshot generation will fail until you add your fal.ai API key (https://fal.ai/dashboard/keys)."
    );
  }
}
