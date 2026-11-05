"use client";

import { Database } from "@/types/supabase";
import { creditsRow } from "@/types/utils";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useEffect, useState } from "react";

type ClientSideCreditsProps = {
  creditsRow: creditsRow | null;
  userId: string;
};

export default function ClientSideCredits({ creditsRow, userId }: ClientSideCreditsProps) {
  const [credits, setCredits] = useState<number>(creditsRow?.credits ?? 0);

  useEffect(() => {
    const supabase = createClientComponentClient<Database>();
    const channel = supabase
      .channel(`credits-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "credits", filter: `user_id=eq.${userId}` },
        (payload: { new: Partial<creditsRow> }) => {
          if (typeof payload.new?.credits === "number") setCredits(payload.new.credits);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return <p className="text-sm">Credits: {credits}</p>;
}
