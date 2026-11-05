// Credit packs sold through Paystack (Naira). Safe to import anywhere.
//
// How the prices were set (Nov 2026):
//   - 1 credit ≈ $0.0405 of fal.ai cost in the worst case (Seedream: $0.081
//     per image with 4 selfies = 2 credits). Nano Banana Pro: $0.15 = 4
//     credits ($0.0375/credit). FLUX.3: ~$0.011 = 1 credit.
//   - Exchange rate buffer: ₦1,400 / $ → ~₦57 cost per credit.
//   - Paystack local card fee: 1.5% + ₦100 (₦100 waived under ₦2,500,
//     fee capped at ₦2,000).
//   - Prices below target ~70% profit margin. For ~50% margin use:
//     20 → ₦2,600, 50 → ₦6,000, 120 → ₦14,000.
// Change prices here; the checkout and webhook both read from this list.

export type CreditPack = {
  id: string;
  name: string;
  credits: number;
  /** Price in Naira (whole naira). */
  priceNgn: number;
  description: string;
  popular?: boolean;
};

export const CREDIT_PACKS: CreditPack[] = [
  {
    id: "starter",
    name: "Starter",
    credits: 20,
    priceNgn: 4500,
    description: "Try it out: e.g. 20 FLUX.3 headshots or 5 Nano Banana Pro headshots.",
  },
  {
    id: "standard",
    name: "Standard",
    credits: 50,
    priceNgn: 10000,
    description: "A full Nano Banana Pro shoot (4 styles, 8 headshots) with credits to spare.",
    popular: true,
  },
  {
    id: "pro",
    name: "Pro",
    credits: 120,
    priceNgn: 22000,
    description: "Best value for trying every model and style.",
  },
];

export function getCreditPack(id: string | null | undefined): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.id === id);
}

export function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString("en-NG")}`;
}
