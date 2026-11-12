import {
  HEADSHOT_STYLES,
  IMAGES_PER_STYLE,
  MAX_STYLES,
  MIN_REFERENCE_IMAGES,
  buildHeadshotPrompt,
  creditsForShoot,
  sanitizeOutfit,
  getAiModel,
  getHeadshotStyle,
} from "@/lib/ai-models";
import { createAdminClient, getFal } from "@/lib/server/clients";
import { Database } from "@/types/supabase";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { creditsEnabled } from "@/lib/config";

// Only accept selfies uploaded to our own Vercel Blob store.
const isBlobUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
};

const bodySchema = z.object({
  name: z.string().trim().min(1).max(50),
  aiModel: z.string(),
  styles: z
    .array(z.string())
    .min(1)
    .max(MAX_STYLES)
    .refine((ids) => ids.every((id) => HEADSHOT_STYLES.some((s) => s.id === id)), "Unknown style")
    .refine((ids) => new Set(ids).size === ids.length, "Duplicate style"),
  outfit: z.unknown().optional(),
  imageUrls: z
    .array(z.string().refine(isBlobUrl, "Invalid image URL"))
    .min(MIN_REFERENCE_IMAGES),
});

const json = (message: string, status: number) => NextResponse.json({ message }, { status });

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json("Unauthorized", 401);

  if (!process.env.FAL_KEY) {
    return json("Missing FAL_KEY: add your fal.ai API key to generate headshots", 500);
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return json(parsed.error.issues[0]?.message ?? "Invalid request", 400);
  }
  const { name, styles, imageUrls } = parsed.data;
  const outfit = sanitizeOutfit(parsed.data.outfit);

  const aiModel = getAiModel(parsed.data.aiModel);
  if (!aiModel) return json("Unknown AI model", 400);
  if (imageUrls.length > aiModel.maxReferenceImages) {
    return json(`${aiModel.name} accepts at most ${aiModel.maxReferenceImages} photos`, 400);
  }

  const admin = createAdminClient();
  const cost = creditsEnabled ? creditsForShoot(aiModel, styles.length) : 0;

  // 1. Charge credits up front (atomic; refunded below or on failure).
  if (cost > 0) {
    const { data: balance, error } = await admin.rpc("deduct_credits", {
      p_user_id: user.id,
      p_amount: cost,
    });
    if (error) {
      console.error("deduct_credits error", error);
      return json("Something went wrong!", 500);
    }
    if (balance === null) {
      return json(
        `Not enough credits. This shoot needs ${cost} credits — please purchase some credits and try again.`,
        402
      );
    }
  }

  const refund = async () => {
    if (cost > 0) await admin.rpc("add_credits", { p_user_id: user.id, p_amount: cost });
  };

  // 2. Create the shoot and store the selfies.
  const { data: shoot, error: shootError } = await admin
    .from("models")
    .insert({
      user_id: user.id,
      name,
      ai_model: aiModel.id,
      styles,
      credits_used: cost,
      ...(outfit ? { outfit } : {}),
      status: "processing",
    })
    .select("id")
    .single();

  if (shootError || !shoot) {
    console.error("shoot insert error", shootError);
    await refund();
    return json("Something went wrong!", 500);
  }

  await admin.from("samples").insert(imageUrls.map((uri) => ({ modelId: shoot.id, uri })));

  // 3. Queue one fal.ai request per style.
  const fal = getFal();
  const submissions = await Promise.allSettled(
    styles.map(async (styleId) => {
      const style = getHeadshotStyle(styleId)!;
      const { request_id } = await fal.queue.submit(aiModel.endpoint, {
        input: aiModel.buildInput({
          prompt: buildHeadshotPrompt(style, outfit),
          imageUrls,
          numImages: IMAGES_PER_STYLE,
        }) as never,
      });
      return { request_id, style: styleId };
    })
  );

  const queued = submissions.flatMap((s) => (s.status === "fulfilled" ? [s.value] : []));
  submissions.forEach((s) => {
    if (s.status === "rejected") console.error("fal submit error", s.reason);
  });

  if (queued.length === 0) {
    await admin
      .from("models")
      .update({ status: "failed", error: "Could not reach the AI model", credits_used: 0 })
      .eq("id", shoot.id);
    await refund();
    return json("The AI model is unavailable right now, please try again.", 502);
  }

  const { error: requestsError } = await admin.from("generation_requests").insert(
    queued.map((q) => ({
      model_id: shoot.id,
      request_id: q.request_id,
      endpoint: aiModel.endpoint,
      style: q.style,
      num_images: IMAGES_PER_STYLE,
    }))
  );
  if (requestsError) {
    console.error("generation_requests insert error", requestsError);
    await Promise.allSettled(
      queued.map((q) => fal.queue.cancel(aiModel.endpoint, { requestId: q.request_id }))
    );
    await admin
      .from("models")
      .update({ status: "failed", error: "Could not save the generation job", credits_used: 0 })
      .eq("id", shoot.id);
    await refund();
    return json("Something went wrong!", 500);
  }

  // Refund styles that could not be queued.
  const failedStyles = styles.length - queued.length;
  if (cost > 0 && failedStyles > 0) {
    const partial = aiModel.creditsPerImage * IMAGES_PER_STYLE * failedStyles;
    await admin.rpc("add_credits", { p_user_id: user.id, p_amount: partial });
    await admin.from("models").update({ credits_used: cost - partial }).eq("id", shoot.id);
  }

  return NextResponse.json({ id: shoot.id }, { status: 201 });
}
