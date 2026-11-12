"use client";

import { Label } from "@/components/ui/label";
import {
  ColorOption,
  OutfitOptions,
  SHIRT_COLORS,
  SUIT_COLORS,
  TIE_COLORS,
  TieChoice,
  describeOutfit,
} from "@/lib/ai-models";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, Shirt } from "lucide-react";
import { useState } from "react";

type OutfitPickerProps = {
  value: OutfitOptions;
  onChange: (value: OutfitOptions) => void;
  disabled?: boolean;
};

function Chip({
  selected,
  onClick,
  disabled,
  children,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-full border-2 px-3 py-1.5 text-xs transition-colors hover:bg-accent disabled:opacity-50",
        selected ? "border-primary" : "border-muted"
      )}
    >
      {children}
    </button>
  );
}

function ColorRow({
  title,
  options,
  value,
  onChange,
  disabled,
}: {
  title: string;
  options: ColorOption[];
  value?: string;
  onChange: (id?: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{title}</span>
      <div className="flex flex-wrap gap-2">
        <Chip selected={!value} onClick={() => onChange(undefined)} disabled={disabled} label="Style default">
          Style default
        </Chip>
        {options.map((c) => (
          <Chip
            key={c.id}
            selected={value === c.id}
            onClick={() => onChange(c.id)}
            disabled={disabled}
            label={c.name}
          >
            <span
              className="relative h-4 w-4 rounded-full border border-black/20 dark:border-white/30"
              style={{ backgroundColor: c.hex }}
            >
              {value === c.id && (
                <Check
                  className="absolute inset-0 m-auto h-3 w-3"
                  style={{ color: isDark(c.hex) ? "#fff" : "#000" }}
                />
              )}
            </span>
            {c.name}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function isDark(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b < 140;
}

export default function OutfitPicker({ value, onChange, disabled }: OutfitPickerProps) {
  const summary = describeOutfit(value);
  const [open, setOpen] = useState(false);

  const set = (patch: Partial<OutfitOptions>) => onChange({ ...value, ...patch });
  const setTie = (tie?: TieChoice) =>
    onChange({ ...value, tie, tieColor: tie === "tie" ? value.tieColor : undefined });

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center justify-between gap-3 rounded-md border p-3 text-left hover:bg-accent"
      >
        <span className="flex items-center gap-3">
          <Shirt className="h-4 w-4 text-muted-foreground" />
          <span className="flex flex-col">
            <Label className="cursor-pointer">Customize outfit (optional)</Label>
            <span className="text-xs text-muted-foreground">
              {summary.length ? summary.join(" · ") : "Using each style's default clothing"}
            </span>
          </span>
        </span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="flex flex-col gap-5 rounded-md border p-4">
          <p className="text-xs text-muted-foreground">
            Applies to every style you picked. Leave anything on &quot;Style default&quot; to keep the style&apos;s own outfit.
          </p>

          <ColorRow
            title="Suit / blazer colour"
            options={SUIT_COLORS}
            value={value.suitColor}
            onChange={(suitColor) => set({ suitColor })}
            disabled={disabled}
          />

          <ColorRow
            title="Shirt / blouse colour"
            options={SHIRT_COLORS}
            value={value.shirtColor}
            onChange={(shirtColor) => set({ shirtColor })}
            disabled={disabled}
          />

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Tie</span>
            <div className="flex flex-wrap gap-2">
              <Chip selected={!value.tie} onClick={() => setTie(undefined)} disabled={disabled} label="Style default">
                Style default
              </Chip>
              <Chip selected={value.tie === "tie"} onClick={() => setTie("tie")} disabled={disabled} label="With tie">
                With tie
              </Chip>
              <Chip selected={value.tie === "no-tie"} onClick={() => setTie("no-tie")} disabled={disabled} label="No tie">
                No tie
              </Chip>
            </div>
          </div>

          {value.tie === "tie" && (
            <ColorRow
              title="Tie colour"
              options={TIE_COLORS}
              value={value.tieColor}
              onChange={(tieColor) => set({ tieColor })}
              disabled={disabled}
            />
          )}

          {summary.length > 0 && (
            <button
              type="button"
              onClick={() => onChange({})}
              disabled={disabled}
              className="self-start text-xs text-muted-foreground underline hover:text-foreground"
            >
              Reset to style defaults
            </button>
          )}
        </div>
      )}
    </div>
  );
}
