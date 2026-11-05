"use client";

import { Button } from "@/components/ui/button";
import { Database } from "@/types/supabase";
import { modelRow, modelRowWithSamples } from "@/types/utils";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Link from "next/link";
import { useEffect, useState } from "react";
import { FaImages } from "react-icons/fa";
import ModelsTable from "../ModelsTable";

type ClientSideModelsListProps = {
  serverModels: modelRowWithSamples[];
  userId: string;
};

export default function ClientSideModelsList({ serverModels, userId }: ClientSideModelsListProps) {
  const [models, setModels] = useState<modelRowWithSamples[]>(serverModels);

  // Keep statuses live (only this user's shoots).
  useEffect(() => {
    const supabase = createClientComponentClient<Database>();
    const channel = supabase
      .channel(`models-${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "models", filter: `user_id=eq.${userId}` },
        (payload: { new: modelRow }) => {
          setModels((current) =>
            current.map((m) => (m.id === payload.new.id ? { ...m, ...payload.new } : m))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  if (models.length === 0) {
    return (
      <div className="flex flex-col gap-4 items-center py-12">
        <FaImages size={64} className="text-gray-500" />
        <h1 className="text-2xl">Create your first AI headshots</h1>
        <p className="text-muted-foreground text-sm">Upload a few selfies, pick a model and style, and get results in about a minute.</p>
        <Link href="/overview/generate">
          <Button size="lg">Generate headshots</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="flex flex-row gap-4 w-full justify-between items-center">
        <h1 className="text-xl">Your shoots</h1>
        <Link href="/overview/generate" className="w-fit">
          <Button size="sm">New shoot</Button>
        </Link>
      </div>
      <ModelsTable models={models} />
    </div>
  );
}
