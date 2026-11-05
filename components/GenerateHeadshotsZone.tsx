"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  AI_MODELS,
  AiModelId,
  DEFAULT_AI_MODEL,
  HEADSHOT_STYLES,
  IMAGES_PER_STYLE,
  MAX_REFERENCE_FILE_BYTES,
  MAX_STYLES,
  MIN_REFERENCE_IMAGES,
  creditsForShoot,
  getAiModel,
} from "@/lib/ai-models";
import { cn } from "@/lib/utils";
import { upload } from "@vercel/blob/client";
import { Check, ImagePlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";

const stripeIsConfigured = process.env.NEXT_PUBLIC_STRIPE_IS_ENABLED === "true";

type SelectedFile = { file: File; preview: string };

export default function GenerateHeadshotsZone() {
  const [name, setName] = useState("");
  const [aiModelId, setAiModelId] = useState<AiModelId>(DEFAULT_AI_MODEL);
  const [styles, setStyles] = useState<string[]>(["corporate", "office"]);
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState("");
  const { toast } = useToast();
  const router = useRouter();

  const aiModel = getAiModel(aiModelId)!;
  const maxFiles = aiModel.maxReferenceImages;
  const cost = creditsForShoot(aiModel, styles.length);
  const imageCount = styles.length * IMAGES_PER_STYLE;

  // Release object URLs when previews are removed / on unmount.
  useEffect(() => () => files.forEach((f) => URL.revokeObjectURL(f.preview)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const onDrop = useCallback(
    (accepted: File[]) => {
      setFiles((current) => {
        const fresh = accepted.filter(
          (file) => !current.some((f) => f.file.name === file.name && f.file.size === file.size)
        );
        const tooBig = fresh.filter((f) => f.size > MAX_REFERENCE_FILE_BYTES);
        if (tooBig.length) {
          toast({ title: "Some photos are too large", description: "Each photo must be under 10MB." });
        }
        const ok = fresh.filter((f) => f.size <= MAX_REFERENCE_FILE_BYTES);
        const room = maxFiles - current.length;
        if (ok.length > room) {
          toast({ title: "Too many photos", description: `You can upload up to ${maxFiles} photos.` });
        }
        return [
          ...current,
          ...ok.slice(0, Math.max(room, 0)).map((file) => ({ file, preview: URL.createObjectURL(file) })),
        ];
      });
    },
    [maxFiles, toast]
  );

  const removeFile = (target: SelectedFile) => {
    URL.revokeObjectURL(target.preview);
    setFiles((current) => current.filter((f) => f !== target));
  };

  const toggleStyle = (id: string) => {
    setStyles((current) => {
      if (current.includes(id)) return current.filter((s) => s !== id);
      if (current.length >= MAX_STYLES) {
        toast({ title: `Pick up to ${MAX_STYLES} styles` });
        return current;
      }
      return [...current, id];
    });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/webp": [".webp"],
    },
    disabled: isSubmitting,
  });

  const validationError = useMemo(() => {
    if (!name.trim()) return "Give your shoot a name";
    if (files.length < MIN_REFERENCE_IMAGES) return "Add at least one photo of yourself";
    if (styles.length === 0) return "Pick at least one style";
    return null;
  }, [name, files.length, styles.length]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validationError) {
      toast({ title: validationError });
      return;
    }

    setIsSubmitting(true);
    try {
      setProgress("Uploading photos…");
      const blobs = await Promise.all(
        files.map(({ file }) =>
          upload(`selfies/${file.name}`, file, {
            access: "public",
            handleUploadUrl: "/api/upload",
          })
        )
      );

      setProgress("Starting generation…");
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          aiModel: aiModelId,
          styles,
          imageUrls: blobs.map((b) => b.url),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        const message: string = data.message ?? "Something went wrong";
        toast({
          title: "Couldn't start your shoot",
          description:
            response.status === 402 ? (
              <div className="flex flex-col gap-4">
                {message}
                <a href="/get-credits">
                  <Button size="sm">Get Credits</Button>
                </a>
              </div>
            ) : (
              message
            ),
          duration: 6000,
        });
        return;
      }

      toast({ title: "Generating your headshots", description: "This usually takes under a minute." });
      router.push(`/overview/models/${data.id}`);
      router.refresh();
    } catch (err) {
      console.error(err);
      toast({ title: "Upload failed", description: "Please check your connection and try again." });
    } finally {
      setIsSubmitting(false);
      setProgress("");
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-8">
      {/* Name */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="shoot-name">Name</Label>
        <p className="text-sm text-muted-foreground">So you can find this shoot later.</p>
        <Input
          id="shoot-name"
          placeholder="e.g. LinkedIn refresh"
          value={name}
          maxLength={50}
          autoComplete="off"
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      {/* AI model */}
      <div className="flex flex-col gap-2">
        <Label>AI model</Label>
        <p className="text-sm text-muted-foreground">Each model has its own look. Try more than one.</p>
        <div role="radiogroup" className="grid gap-3 sm:grid-cols-3">
          {AI_MODELS.map((m) => {
            const selected = m.id === aiModelId;
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setAiModelId(m.id)}
                className={cn(
                  "relative flex flex-col gap-1 rounded-lg border-2 p-4 text-left transition-colors hover:bg-accent",
                  selected ? "border-primary" : "border-muted"
                )}
              >
                {m.badge && (
                  <Badge variant="secondary" className="w-fit text-[10px] mb-1">
                    {m.badge}
                  </Badge>
                )}
                <span className="font-semibold">{m.name}</span>
                <span className="text-xs text-muted-foreground">{m.provider}</span>
                <span className="text-xs mt-1">{m.description}</span>
                {stripeIsConfigured && (
                  <span className="text-xs text-muted-foreground mt-2">
                    {m.creditsPerImage} credit{m.creditsPerImage > 1 ? "s" : ""} / image
                  </span>
                )}
                {selected && <Check className="absolute right-3 top-3 h-4 w-4 text-primary" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Styles */}
      <div className="flex flex-col gap-2">
        <Label>Styles</Label>
        <p className="text-sm text-muted-foreground">
          Pick up to {MAX_STYLES}. You get {IMAGES_PER_STYLE} headshots per style.
        </p>
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-3">
          {HEADSHOT_STYLES.map((s) => {
            const selected = styles.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleStyle(s.id)}
                className={cn(
                  "flex flex-col rounded-md border-2 px-3 py-2 text-left transition-colors hover:bg-accent",
                  selected ? "border-primary" : "border-muted"
                )}
              >
                <span className="text-sm font-medium">{s.name}</span>
                <span className="text-xs text-muted-foreground">{s.description}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Photos */}
      <div className="flex flex-col gap-2">
        <Label>Your photos</Label>
        <p className="text-sm text-muted-foreground">
          Upload {MIN_REFERENCE_IMAGES}–{maxFiles} clear photos of your face. Best results come from 3–6 photos:
          different angles, good light, no sunglasses or hats, and only you in the frame.
        </p>
        <div
          {...getRootProps()}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-8 text-center transition-colors",
            isDragActive ? "border-primary bg-accent" : "border-muted hover:border-primary"
          )}
        >
          <input {...getInputProps()} />
          <ImagePlus className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm">{isDragActive ? "Drop your photos here…" : "Drag photos here, or click to choose"}</p>
          <p className="text-xs text-muted-foreground">JPG, PNG or WebP · up to 10MB each</p>
        </div>

        {files.length > 0 && (
          <div className="flex flex-wrap gap-3 pt-2">
            {files.map((f) => (
              <div key={f.preview} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.preview} alt={f.file.name} className="h-24 w-24 rounded-md object-cover" />
                <button
                  type="button"
                  onClick={() => removeFile(f)}
                  disabled={isSubmitting}
                  aria-label={`Remove ${f.file.name}`}
                  className="absolute -right-2 -top-2 rounded-full bg-background border p-1 shadow hover:bg-accent"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Button type="submit" className="w-full" isLoading={isSubmitting} disabled={isSubmitting}>
          {isSubmitting
            ? progress
            : `Generate ${imageCount} headshots${stripeIsConfigured ? ` · ${cost} credits` : ""}`}
        </Button>
        {validationError && !isSubmitting && (
          <p className="text-center text-xs text-muted-foreground">{validationError}</p>
        )}
      </div>
    </form>
  );
}
