import ClientSideModel from "@/components/realtime/ClientSideModel";
import { Button } from "@/components/ui/button";
import { Database } from "@/types/supabase";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FaArrowLeft } from "react-icons/fa";

export const dynamic = "force-dynamic";

export default async function ShootPage({ params }: { params: { id: string } }) {
  const supabase = createServerComponentClient<Database>({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: model } = await supabase
    .from("models")
    .select("*")
    .eq("id", Number(params.id))
    .eq("user_id", user.id)
    .single();

  if (!model) redirect("/overview");

  const [{ data: images }, { data: samples }] = await Promise.all([
    supabase.from("images").select("*").eq("modelId", model.id).order("id"),
    supabase.from("samples").select("*").eq("modelId", model.id),
  ]);

  return (
    <div className="w-full h-full">
      <Link href="/overview" className="text-xs w-fit">
        <Button variant="outline" className="text-xs" size="sm">
          <FaArrowLeft className="mr-2" />
          Go Back
        </Button>
      </Link>
      <ClientSideModel serverModel={model} serverImages={images ?? []} samples={samples ?? []} />
    </div>
  );
}
