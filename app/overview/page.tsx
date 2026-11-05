import ClientSideModelsList from "@/components/realtime/ClientSideModelsList";
import { createAdminClient } from "@/lib/server/clients";
import { syncShoot } from "@/lib/server/shoots";
import { Database } from "@/types/supabase";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const selectShoots = `*, samples (*)`;

export default async function Index() {
  const supabase = createServerComponentClient<Database>({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  let { data: models } = await supabase
    .from("models")
    .select(selectShoots)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Collect results for shoots that finished while the user was away.
  const processing = (models ?? []).filter((m) => m.status === "processing" && m.ai_model);
  if (processing.length > 0) {
    const admin = createAdminClient();
    await Promise.allSettled(processing.map((m) => syncShoot(admin, m.id)));
    ({ data: models } = await supabase
      .from("models")
      .select(selectShoots)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }));
  }

  return <ClientSideModelsList serverModels={models ?? []} userId={user.id} />;
}
