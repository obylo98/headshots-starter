"use client";

import { Progress } from "@/components/ui/progress";
import { AiModel, getHeadshotStyle } from "@/lib/ai-models";
import { Check, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";

export type RequestState = { style: string | null; status: string; error: string | null };

type StyleState = "waiting" | "done" | "failed";

type GenerationProgressProps = {
  aiModel?: AiModel;
  styles: string[];
  requests: RequestState[];
  startedAt: string;
};

/** Latest outcome per style (a style may have a "retried" row plus a newer one). */
function styleStates(styles: string[], requests: RequestState[]): Record<string, StyleState> {
  const states: Record<string, StyleState> = {};
  for (const style of styles) {
    const rows = requests.filter((r) => r.style === style);
    if (rows.some((r) => r.status === "done")) states[style] = "done";
    else if (rows.some((r) => r.status === "pending" || r.status === "saving")) states[style] = "waiting";
    else if (rows.some((r) => r.status === "failed")) states[style] = "failed";
    else states[style] = "waiting";
  }
  return states;
}

export default function GenerationProgress({ aiModel, styles, requests, startedAt }: GenerationProgressProps) {
  const [now, setNow] = useState(() => Date.now());

  // Tick every half second so the bar moves smoothly between server polls.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const states = styleStates(styles, requests);
  const total = Math.max(styles.length, 1);
  const settled = Object.values(states).filter((s) => s !== "waiting").length;
  const elapsedSec = Math.max(0, (now - new Date(startedAt).getTime()) / 1000);
  const expected = aiModel?.expectedSeconds ?? 40;

  // Styles run in parallel: estimate from elapsed time (eases toward 90%,
  // never claims done), then snap forward as styles actually finish.
  const timeFraction = 0.9 * (1 - Math.exp(-elapsedSec / expected));
  const settledFraction = settled / total;
  const percent = Math.round(
    Math.min(99, 100 * (settledFraction + (1 - settledFraction) * timeFraction))
  );

  const remaining = Math.max(0, Math.round(expected - elapsedSec));
  const etaLabel =
    remaining > 0 ? `about ${remaining}s left` : "taking a little longer than usual…";

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="font-medium">
          Generating with {aiModel?.name ?? "AI"} · {settled} of {total} style{total > 1 ? "s" : ""} done
        </span>
        <span className="tabular-nums text-muted-foreground">{percent}%</span>
      </div>

      <Progress
        value={percent}
        className="h-2"
        aria-label="Headshot generation progress"
        aria-valuetext={`${percent}% — ${settled} of ${total} styles done`}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex flex-wrap gap-3">
          {styles.map((id) => {
            const state = states[id];
            return (
              <span key={id} className="flex items-center gap-1">
                {state === "done" && <Check className="h-3 w-3 text-primary" />}
                {state === "failed" && <X className="h-3 w-3 text-destructive" />}
                {state === "waiting" && <Loader2 className="h-3 w-3 animate-spin" />}
                {getHeadshotStyle(id)?.name ?? id}
              </span>
            );
          })}
        </div>
        <span>{etaLabel} · you can leave this page</span>
      </div>
    </div>
  );
}
