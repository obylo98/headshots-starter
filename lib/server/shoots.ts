import "server-only";

import { buildHeadshotPrompt, getAiModel, getHeadshotStyle } from "@/lib/ai-models";
import { AdminClient, getFal } from "@/lib/server/clients";
import { generationRequestRow as GenerationRequest } from "@/types/utils";
import { put } from "@vercel/blob";

// A request stuck in "saving" this long (e.g. the function was killed
// mid-upload) may be claimed again by the next sync.
const STALE_SAVING_MS = 5 * 60 * 1000;
// Give up on a request that has not completed after this long.
const REQUEST_TIMEOUT_MS = 30 * 60 * 1000;
// Total tries per style (first attempt + retries).
const MAX_ATTEMPTS_PER_STYLE = 2;

type FalImage = { url: string; content_type?: string };

function errorMessage(e: unknown): string {
  if (e && typeof e === "object") {
    const body = (e as { body?: { detail?: unknown } }).body;
    if (body?.detail) {
      if (typeof body.detail === "string") return body.detail;
      // fal validation errors: [{ loc, msg, type, input, ... }]
      if (Array.isArray(body.detail)) {
        const msgs = body.detail
          .map((d) => (d && typeof d === "object" && "msg" in d ? String((d as { msg: unknown }).msg) : null))
          .filter(Boolean);
        if (msgs.length) return msgs.join("; ");
      }
      return JSON.stringify(body.detail).slice(0, 500);
    }
    if ("message" in e && typeof (e as Error).message === "string") {
      return (e as Error).message;
    }
  }
  return String(e);
}

async function markFailed(admin: AdminClient, id: number, error: string) {
  await admin
    .from("generation_requests")
    .update({ status: "failed", error: error.slice(0, 1000), updated_at: new Date().toISOString() })
    .eq("id", id);
}

/**
 * Models sometimes refuse or return nothing for a request that works on a
 * second try. Re-submit the same style once before giving up. The old row is
 * kept with status "retried" (not refunded, not counted as failed).
 */
async function retryOrFail(admin: AdminClient, req: GenerationRequest, error: string) {
  const { count } = await admin
    .from("generation_requests")
    .select("id", { count: "exact", head: true })
    .eq("model_id", req.model_id)
    .eq("style", req.style ?? "");

  const style = req.style ? getHeadshotStyle(req.style) : undefined;
  if ((count ?? 0) >= MAX_ATTEMPTS_PER_STYLE || !style) {
    await markFailed(admin, req.id, error);
    return;
  }

  try {
    const [{ data: shoot }, { data: samples }] = await Promise.all([
      admin.from("models").select("ai_model").eq("id", req.model_id).single(),
      admin.from("samples").select("uri").eq("modelId", req.model_id),
    ]);
    const aiModel = getAiModel(shoot?.ai_model);
    if (!aiModel || !samples?.length) throw new Error("Shoot data missing for retry");

    const { request_id } = await getFal().queue.submit(aiModel.endpoint, {
      input: aiModel.buildInput({
        prompt: buildHeadshotPrompt(style),
        imageUrls: samples.map((s) => s.uri),
        numImages: req.num_images,
      }) as never,
    });

    const { error: insertError } = await admin.from("generation_requests").insert({
      model_id: req.model_id,
      request_id,
      endpoint: aiModel.endpoint,
      style: req.style,
      num_images: req.num_images,
    });
    if (insertError) throw insertError;

    await admin
      .from("generation_requests")
      .update({ status: "retried", error: error.slice(0, 1000), updated_at: new Date().toISOString() })
      .eq("id", req.id);
    console.log(`[shoots] retrying style "${req.style}" for shoot ${req.model_id}: ${error}`);
  } catch (e) {
    console.error("[shoots] retry submit failed", e);
    await markFailed(admin, req.id, error);
  }
}

/** Copy a fal output image into Vercel Blob so it never expires. */
async function persistImage(modelId: number, requestId: string, index: number, image: FalImage) {
  const res = await fetch(image.url);
  if (!res.ok) throw new Error(`Failed to download generated image (${res.status})`);
  const contentType = image.content_type || res.headers.get("content-type") || "image/jpeg";
  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const blob = await put(`headshots/${modelId}/${requestId}-${index}.${ext}`, await res.arrayBuffer(), {
    access: "public",
    contentType,
    addRandomSuffix: true,
  });
  return blob.url;
}

/**
 * Bring a shoot up to date with fal.ai: collect finished results, record
 * failures, and finalize the shoot (with credit refunds) once every request
 * has settled. Safe to call concurrently and repeatedly.
 */
export async function syncShoot(admin: AdminClient, modelId: number) {
  const { data: requests, error } = await admin
    .from("generation_requests")
    .select("*")
    .eq("model_id", modelId);
  if (error) throw error;

  const fal = getFal();
  const now = Date.now();

  await Promise.all(
    (requests ?? []).map(async (req) => {
      const updatedAt = new Date(req.updated_at).getTime();
      const isStaleSaving = req.status === "saving" && now - updatedAt > STALE_SAVING_MS;
      if (req.status !== "pending" && !isStaleSaving) return;

      try {
        const status = await fal.queue.status(req.endpoint, { requestId: req.request_id });
        if (status.status !== "COMPLETED") {
          if (now - new Date(req.created_at).getTime() > REQUEST_TIMEOUT_MS) {
            await markFailed(admin, req.id, "Timed out waiting for the AI model");
          }
          return;
        }
      } catch (e) {
        console.error("fal status error", req.request_id, e);
        return; // transient — try again on the next sync
      }

      // Claim the request so concurrent syncs don't save the images twice.
      const { data: claimed } = await admin
        .from("generation_requests")
        .update({ status: "saving", updated_at: new Date().toISOString() })
        .eq("id", req.id)
        .eq("status", req.status)
        .eq("updated_at", req.updated_at)
        .select("id");
      if (!claimed?.length) return;

      try {
        const result = await fal.queue.result(req.endpoint, { requestId: req.request_id });
        const images = ((result.data as { images?: FalImage[] })?.images ?? []).filter((i) => i?.url);
        if (images.length === 0) {
          await retryOrFail(admin, req, "The AI model returned no images (it may have been blocked by the safety filter)");
          return;
        }

        const urls = await Promise.all(
          images.map((img, i) => persistImage(modelId, req.request_id, i, img))
        );
        const { error: insertError } = await admin
          .from("images")
          .insert(urls.map((uri) => ({ modelId, uri })));
        if (insertError) throw insertError;

        await admin
          .from("generation_requests")
          .update({ status: "done", updated_at: new Date().toISOString() })
          .eq("id", req.id);
      } catch (e) {
        console.error("fal result error", req.request_id, e);
        await retryOrFail(admin, req, errorMessage(e));
      }
    })
  );

  await finalizeShootIfSettled(admin, modelId);
}

async function finalizeShootIfSettled(admin: AdminClient, modelId: number) {
  const { data: requests } = await admin
    .from("generation_requests")
    .select("status, num_images, error")
    .eq("model_id", modelId);
  if (!requests || requests.some((r) => r.status === "pending" || r.status === "saving")) {
    return;
  }

  const failed = requests.filter((r) => r.status === "failed");
  const anyDone = requests.some((r) => r.status === "done");

  // Conditional update: only the first caller to settle the shoot proceeds,
  // so refunds are issued exactly once.
  const { data: settled } = await admin
    .from("models")
    .update({
      status: anyDone ? "finished" : "failed",
      error: failed.length ? failed[0].error : null,
    })
    .eq("id", modelId)
    .eq("status", "processing")
    .select("user_id, ai_model, credits_used");
  const shoot = settled?.[0];
  if (!shoot || failed.length === 0) return;

  const aiModel = getAiModel(shoot.ai_model);
  const refund = Math.min(
    shoot.credits_used,
    (aiModel?.creditsPerImage ?? 0) * failed.reduce((sum, r) => sum + r.num_images, 0)
  );
  if (refund > 0 && shoot.user_id) {
    const { error } = await admin.rpc("add_credits", { p_user_id: shoot.user_id, p_amount: refund });
    if (error) console.error("Credit refund failed", { modelId, refund, error });
  }
}
