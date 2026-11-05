"use client";

import { Icons } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IMAGES_PER_STYLE, getAiModel, getHeadshotStyle } from "@/lib/ai-models";
import { imageRow, modelRow, sampleRow } from "@/types/utils";
import { Download } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const POLL_INTERVAL_MS = 4000;

type ClientSideModelProps = {
  serverModel: modelRow;
  serverImages: imageRow[];
  samples: sampleRow[];
};

type RequestState = { style: string | null; status: string; error: string | null };

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant={status === "finished" ? "default" : status === "failed" ? "destructive" : "secondary"}
      className="flex w-fit items-center gap-2 text-xs font-medium"
    >
      {status === "processing" ? "generating" : status}
      {status === "processing" && <Icons.spinner className="h-3 w-3 animate-spin" />}
    </Badge>
  );
}

export default function ClientSideModel({ serverModel, serverImages, samples }: ClientSideModelProps) {
  const [model, setModel] = useState<modelRow>(serverModel);
  const [images, setImages] = useState<imageRow[]>(serverImages);
  const [requests, setRequests] = useState<RequestState[]>([]);

  const isProcessing = model.status === "processing";
  const aiModel = getAiModel(model.ai_model);

  // While generating, poll the server; it pulls finished results from fal.ai.
  useEffect(() => {
    if (!isProcessing) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const res = await fetch(`/api/shoots/${model.id}`, { cache: "no-store" });
        if (res.ok && !cancelled) {
          const data = await res.json();
          if (data.model) setModel(data.model);
          setImages(data.images);
          setRequests(data.requests);
        }
      } catch {
        // network blip — retry on the next tick
      }
      if (!cancelled) timer = setTimeout(poll, POLL_INTERVAL_MS);
    };
    poll();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isProcessing, model.id]);

  const failedStyles = requests.filter((r) => r.status === "failed");

  return (
    <div className="flex flex-col gap-8 mt-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{model.name}</h1>
        <StatusBadge status={model.status} />
        {aiModel && <Badge variant="outline">{aiModel.name}</Badge>}
        {model.styles?.map((id) => (
          <Badge key={id} variant="outline" className="font-normal">
            {getHeadshotStyle(id)?.name ?? id}
          </Badge>
        ))}
      </div>

      {model.status === "failed" && (
        <div className="rounded-md border border-destructive/50 p-4 text-sm">
          <p className="font-medium">We couldn&apos;t generate this shoot.</p>
          {model.error && <p className="text-muted-foreground mt-1">{model.error}</p>}
          <p className="text-muted-foreground mt-1">Any credits for failed images were refunded.</p>
          <Link href="/overview/generate">
            <Button size="sm" className="mt-3">Try again</Button>
          </Link>
        </div>
      )}

      {model.status === "finished" && failedStyles.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {failedStyles.length} style{failedStyles.length > 1 ? "s" : ""} failed and the credits were refunded.
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-xl">Results</h2>
        {isProcessing && (
          <p className="text-sm text-muted-foreground">
            Generating with {aiModel?.name ?? "AI"}. This usually takes under a minute, and you can leave this page.
          </p>
        )}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {images.map((image) => (
            <div key={image.id} className="group relative overflow-hidden rounded-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.uri} alt="Generated headshot" className="aspect-[3/4] w-full object-cover" />
              <a
                href={`${image.uri}${image.uri.includes("?") ? "&" : "?"}download=1`}
                className="absolute bottom-2 right-2 rounded-full bg-background/90 p-2 opacity-0 shadow transition-opacity group-hover:opacity-100 focus:opacity-100"
                aria-label="Download headshot"
              >
                <Download className="h-4 w-4" />
              </a>
            </div>
          ))}
          {isProcessing &&
            Array.from({ length: Math.max(0, (model.styles?.length ?? 1) * IMAGES_PER_STYLE - images.length) }).map((_, i) => (
              <div key={`skeleton-${i}`} className="aspect-[3/4] w-full animate-pulse rounded-md bg-muted" />
            ))}
        </div>
      </section>

      {samples.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl">Your photos</h2>
          <div className="flex flex-wrap gap-3">
            {samples.map((sample) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={sample.id} src={sample.uri} alt="Uploaded photo" className="h-24 w-24 rounded-md object-cover" />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
