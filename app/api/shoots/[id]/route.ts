import { createAdminClient } from "@/lib/server/clients";
import { syncShoot } from "@/lib/server/shoots";
import { Database } from "@/types/supabase";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Returns the shoot's current state, pulling any finished results from fal.ai first. */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ message: "Not found" }, { status: 404 });

  // RLS on the user's client guarantees ownership.
  const { data: owned } = await supabase.from("models").select("id, status").eq("id", id).single();
  if (!owned) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const admin = createAdminClient();
  if (owned.status === "processing") {
    try {
      await syncShoot(admin, id);
    } catch (e) {
      console.error("syncShoot error", e);
    }
  }

  const [{ data: model }, { data: images }, { data: requests }] = await Promise.all([
    supabase.from("models").select("*").eq("id", id).single(),
    supabase.from("images").select("*").eq("modelId", id).order("id"),
    supabase.from("generation_requests").select("style, status, error").eq("model_id", id),
  ]);

  return NextResponse.json({ model, images: images ?? [], requests: requests ?? [] });
}
