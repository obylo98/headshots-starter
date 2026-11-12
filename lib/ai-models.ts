// Single source of truth for the AI models users can pick and the headshot
// styles they can generate. Safe to import from client and server code
// (contains no secrets). To swap a model, change its `endpoint` + `buildInput`.

export type AiModelId = "flux-3-klein" | "nano-banana-pro" | "seedream-5-pro";

export type AiModel = {
  id: AiModelId;
  name: string;
  provider: string;
  description: string;
  /** fal.ai endpoint id */
  endpoint: string;
  /**
   * Credits charged per generated image (only when payments are enabled).
   * 1 credit is worth roughly $0.04 of fal cost; see lib/credit-packs.ts.
   */
  creditsPerImage: number;
  /** Rough generation time in seconds, used for the progress bar estimate. */
  expectedSeconds: number;
  /** Max reference photos the endpoint accepts. */
  maxReferenceImages: number;
  badge?: string;
  buildInput: (args: {
    prompt: string;
    imageUrls: string[];
    numImages: number;
  }) => Record<string, unknown>;
};

// Headshots are portrait 3:4.
export const AI_MODELS: AiModel[] = [
  {
    id: "nano-banana-pro",
    name: "Nano Banana Pro",
    provider: "Google",
    description: "Best likeness — keeps your face most accurate. Premium quality.",
    endpoint: "fal-ai/nano-banana-pro/edit",
    expectedSeconds: 45,
    creditsPerImage: 4, // fal: $0.15 per image (1K)
    maxReferenceImages: 10,
    badge: "Best likeness",
    buildInput: ({ prompt, imageUrls, numImages }) => ({
      prompt,
      image_urls: imageUrls,
      num_images: numImages,
      aspect_ratio: "3:4",
      resolution: "1K",
      output_format: "jpeg",
    }),
  },
  {
    id: "seedream-5-pro",
    name: "Seedream 5.0 Pro",
    provider: "ByteDance",
    description: "Sharp, high-resolution photos with polished commercial lighting.",
    endpoint: "bytedance/seedream/v5/pro/edit",
    expectedSeconds: 35,
    creditsPerImage: 2, // fal: $0.0675 + $0.0045 per extra reference photo
    maxReferenceImages: 10,
    buildInput: ({ prompt, imageUrls, numImages }) => ({
      prompt,
      image_urls: imageUrls,
      num_images: numImages,
      // 1248x1664 = ~2.08MP: above Seedream's 0.92MP minimum and inside fal's
      // lower price band (<= 1536x1536).
      image_size: { width: 1248, height: 1664 },
      output_format: "jpeg",
    }),
  },
  {
    id: "flux-3-klein",
    name: "FLUX.3",
    provider: "Black Forest Labs",
    description: "Fast and affordable, with natural skin texture.",
    endpoint: "blackforestlabs/flux-3/klein/edit-image",
    expectedSeconds: 15,
    creditsPerImage: 1, // fal: ~$0.011 per image (1.5K tier)
    maxReferenceImages: 10,
    badge: "Fastest",
    buildInput: ({ prompt, imageUrls, numImages }) => ({
      prompt,
      image_urls: imageUrls,
      num_images: numImages,
      image_size: { width: 960, height: 1280 },
      output_format: "jpeg",
    }),
  },
];

export const DEFAULT_AI_MODEL: AiModelId = "nano-banana-pro";

export function getAiModel(id: string | null | undefined): AiModel | undefined {
  return AI_MODELS.find((m) => m.id === id);
}

export type HeadshotStyle = {
  id: string;
  name: string;
  description: string;
  prompt: string;
};

export const HEADSHOT_STYLES: HeadshotStyle[] = [
  {
    id: "corporate",
    name: "Corporate",
    description: "Dark suit, neutral studio backdrop",
    prompt:
      "wearing a tailored dark business suit and crisp shirt, plain light-grey studio backdrop, soft even three-point studio lighting",
  },
  {
    id: "office",
    name: "Modern office",
    description: "Smart business attire, blurred office",
    prompt:
      "wearing smart business attire, standing in a bright modern glass office, softly blurred background with shallow depth of field, natural window light",
  },
  {
    id: "outdoor",
    name: "Outdoor",
    description: "Business casual, natural light",
    prompt:
      "wearing business-casual clothing, outdoors in a city park, golden-hour natural light, creamy bokeh background",
  },
  {
    id: "studio-dark",
    name: "Studio dark",
    description: "Moody, dark backdrop",
    prompt:
      "wearing a dark crew-neck top or blazer, deep charcoal studio backdrop, dramatic soft key light with gentle rim light",
  },
  {
    id: "creative",
    name: "Creative",
    description: "Relaxed, colourful setting",
    prompt:
      "wearing stylish smart-casual clothing, warm creative studio with a subtle colourful background, soft diffused light, approachable smile",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    description: "Friendly, clean white background",
    prompt:
      "wearing a neat collared shirt or blouse, clean white background, bright soft lighting, friendly confident smile",
  },
  {
    // Modelled on a reference corporate portrait (styling only, never the face).
    id: "executive-window",
    name: "Executive window",
    description: "Navy suit, bright office window, plant",
    prompt:
      "wearing a tailored navy-blue suit jacket over a crisp white shirt with a silver-grey textured tie (or, for women, a navy blazer over a white blouse), " +
      "standing in a bright modern office with a large floor-to-ceiling window softly out of focus on the left and a blurred green potted plant on the right, " +
      "light neutral grey-white walls, soft diffused natural daylight from the side window, gentle even skin tones with no harsh shadows, " +
      "shallow depth of field with creamy background blur, warm genuine broad smile showing teeth, relaxed and approachable, " +
      "eye-level camera, centred tight head-and-shoulders crop, polished corporate profile photo",
  },
];

export function getHeadshotStyle(id: string): HeadshotStyle | undefined {
  return HEADSHOT_STYLES.find((s) => s.id === id);
}

/** Images generated for each selected style. */
export const IMAGES_PER_STYLE = 2;
export const MAX_STYLES = 4;
export const MIN_REFERENCE_IMAGES = 1;
export const MAX_REFERENCE_IMAGES = 10;
export const MAX_REFERENCE_FILE_BYTES = 10 * 1024 * 1024;

export function buildHeadshotPrompt(style: HeadshotStyle, outfit?: OutfitOptions | null): string {
  // Phrased as a plain photo-editing instruction: heavy "preserve identity"
  // wording makes some models (notably Nano Banana Pro) refuse more often.
  return [
    "Turn the person in these photos into a professional studio headshot.",
    "Keep their face, hairstyle, skin tone and age the same so they look like themselves.",
    `They are ${style.prompt}.`,
    outfitSentence(outfit),
    "Head-and-shoulders portrait, looking at the camera, sharp focus, natural skin texture, realistic photo taken with an 85mm lens.",
  ]
    .filter(Boolean)
    .join(" ");
}

// ---------------------------------------------------------------------------
// Optional outfit customisation. Every field is optional: anything left unset
// keeps the clothing described by the chosen style.

export type ColorOption = { id: string; name: string; hex: string };

export const SUIT_COLORS: ColorOption[] = [
  { id: "navy", name: "Navy", hex: "#1f2a44" },
  { id: "charcoal", name: "Charcoal", hex: "#36454f" },
  { id: "black", name: "Black", hex: "#111111" },
  { id: "mid-grey", name: "Mid grey", hex: "#7d7d7d" },
  { id: "light-grey", name: "Light grey", hex: "#c4c4c4" },
  { id: "beige", name: "Beige", hex: "#d8c3a5" },
  { id: "brown", name: "Brown", hex: "#6b4f3a" },
  { id: "burgundy", name: "Burgundy", hex: "#6d1a36" },
  { id: "olive", name: "Olive green", hex: "#556b2f" },
  { id: "white", name: "White", hex: "#f5f5f5" },
];

export const SHIRT_COLORS: ColorOption[] = [
  { id: "white", name: "White", hex: "#ffffff" },
  { id: "light-blue", name: "Light blue", hex: "#cfe2f3" },
  { id: "pale-pink", name: "Pale pink", hex: "#f4d4d4" },
  { id: "cream", name: "Cream", hex: "#f7efd9" },
  { id: "lavender", name: "Lavender", hex: "#e3dcf5" },
  { id: "grey", name: "Grey", hex: "#9e9e9e" },
  { id: "black", name: "Black", hex: "#111111" },
];

export const TIE_COLORS: ColorOption[] = [
  { id: "silver-grey", name: "Silver grey", hex: "#a9a9a9" },
  { id: "navy", name: "Navy", hex: "#1f2a44" },
  { id: "black", name: "Black", hex: "#111111" },
  { id: "burgundy", name: "Burgundy", hex: "#6d1a36" },
  { id: "red", name: "Red", hex: "#b22222" },
  { id: "royal-blue", name: "Royal blue", hex: "#2a52be" },
  { id: "green", name: "Green", hex: "#2e6b3f" },
  { id: "gold", name: "Gold", hex: "#c9a43a" },
];

export type TieChoice = "tie" | "no-tie";

export type OutfitOptions = {
  suitColor?: string;
  shirtColor?: string;
  tie?: TieChoice;
  tieColor?: string;
};

const colorName = (list: ColorOption[], id?: string) =>
  list.find((c) => c.id === id)?.name.toLowerCase();

/** Drops unknown/empty values. Returns null when nothing is customised. */
export function sanitizeOutfit(input: unknown): OutfitOptions | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const pick = (list: ColorOption[], v: unknown) =>
    typeof v === "string" && list.some((c) => c.id === v) ? v : undefined;

  const outfit: OutfitOptions = {
    suitColor: pick(SUIT_COLORS, raw.suitColor),
    shirtColor: pick(SHIRT_COLORS, raw.shirtColor),
    tie: raw.tie === "tie" || raw.tie === "no-tie" ? raw.tie : undefined,
  };
  if (outfit.tie === "tie") outfit.tieColor = pick(TIE_COLORS, raw.tieColor);

  const clean = Object.fromEntries(Object.entries(outfit).filter(([, v]) => v)) as OutfitOptions;
  return Object.keys(clean).length ? clean : null;
}

/** Short human summary, e.g. "Charcoal suit · White shirt · Navy tie". */
export function describeOutfit(outfit: OutfitOptions | null | undefined): string[] {
  if (!outfit) return [];
  const parts: string[] = [];
  const suit = SUIT_COLORS.find((c) => c.id === outfit.suitColor)?.name;
  const shirt = SHIRT_COLORS.find((c) => c.id === outfit.shirtColor)?.name;
  const tie = TIE_COLORS.find((c) => c.id === outfit.tieColor)?.name;
  if (suit) parts.push(`${suit} suit`);
  if (shirt) parts.push(`${shirt} shirt`);
  if (outfit.tie === "no-tie") parts.push("No tie");
  if (outfit.tie === "tie") parts.push(tie ? `${tie} tie` : "Tie");
  return parts;
}

function outfitSentence(outfit: OutfitOptions | null | undefined): string | null {
  if (!outfit) return null;
  const clauses: string[] = [];
  const suit = colorName(SUIT_COLORS, outfit.suitColor);
  const shirt = colorName(SHIRT_COLORS, outfit.shirtColor);
  if (suit) clauses.push(`a ${suit} suit jacket (or ${suit} blazer for women)`);
  if (shirt) clauses.push(`a ${shirt} shirt or blouse`);
  if (outfit.tie === "no-tie") clauses.push("no tie, with an open collar");
  if (outfit.tie === "tie") {
    const tie = colorName(TIE_COLORS, outfit.tieColor);
    clauses.push(tie ? `a ${tie} tie` : "a tie");
  }
  if (!clauses.length) return null;
  return `Clothing (this overrides any clothing described above): they are wearing ${clauses.join(", ")}.`;
}

export function creditsForShoot(model: AiModel, styleCount: number): number {
  return model.creditsPerImage * IMAGES_PER_STYLE * styleCount;
}
