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
  /** Credits charged per generated image (only used when Stripe is enabled). */
  creditsPerImage: number;
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
    creditsPerImage: 2,
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
    creditsPerImage: 1,
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
    creditsPerImage: 1,
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

export function buildHeadshotPrompt(style: HeadshotStyle): string {
  return [
    "Professional headshot photograph of the exact same person shown in the reference images.",
    "Preserve their identity precisely: same face shape, facial features, skin tone, eye colour, hairline and hairstyle, age and any distinctive marks.",
    `The person is ${style.prompt}.`,
    "Head-and-shoulders framing, facing the camera, sharp focus on the eyes, natural realistic skin texture, photorealistic, shot on an 85mm lens.",
    "Only one person in the image. No text, no watermark.",
  ].join(" ");
}

export function creditsForShoot(model: AiModel, styleCount: number): number {
  return model.creditsPerImage * IMAGES_PER_STYLE * styleCount;
}
