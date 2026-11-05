"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { AI_MODELS } from "@/lib/ai-models";
import { CREDIT_PACKS, formatNaira } from "@/lib/credit-packs";
import { cn } from "@/lib/utils";
import { useState } from "react";

export default function PaystackPacks() {
  const [loadingPack, setLoadingPack] = useState<string | null>(null);
  const { toast } = useToast();

  const buy = async (packId: string) => {
    setLoadingPack(packId);
    try {
      const res = await fetch("/api/paystack/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.message ?? "Could not start payment");
      window.location.href = data.url; // Paystack hosted checkout
    } catch (e) {
      toast({ title: "Payment couldn't start", description: (e as Error).message });
      setLoadingPack(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-3">
        {CREDIT_PACKS.map((pack) => (
          <div
            key={pack.id}
            className={cn(
              "relative flex flex-col gap-3 rounded-xl border p-6",
              pack.popular && "border-primary shadow-md"
            )}
          >
            {pack.popular && <Badge className="absolute -top-3 left-6">Most popular</Badge>}
            <h3 className="text-lg font-semibold">{pack.name}</h3>
            <div>
              <span className="text-3xl font-bold">{formatNaira(pack.priceNgn)}</span>
            </div>
            <p className="font-medium">{pack.credits} credits</p>
            <p className="text-sm text-muted-foreground flex-1">{pack.description}</p>
            <Button
              onClick={() => buy(pack.id)}
              isLoading={loadingPack === pack.id}
              disabled={loadingPack !== null}
              variant={pack.popular ? "default" : "outline"}
            >
              Buy with Paystack
            </Button>
          </div>
        ))}
      </div>

      <div className="rounded-lg border p-4 text-sm">
        <p className="font-medium mb-2">What credits buy</p>
        <ul className="grid gap-1 text-muted-foreground sm:grid-cols-3">
          {AI_MODELS.map((m) => (
            <li key={m.id}>
              {m.name}: {m.creditsPerImage} credit{m.creditsPerImage > 1 ? "s" : ""} per headshot
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground mt-2">
          Each style gives 2 headshots. Credits for failed generations are refunded automatically.
        </p>
      </div>
    </div>
  );
}
