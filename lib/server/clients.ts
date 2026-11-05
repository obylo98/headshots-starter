import "server-only";

import { Database } from "@/types/supabase";
import { createFalClient } from "@fal-ai/client";
import { createClient } from "@supabase/supabase-js";

/** Supabase client with the service role key. Bypasses RLS — server only. */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export type AdminClient = ReturnType<typeof createAdminClient>;

let falClient: ReturnType<typeof createFalClient> | null = null;

/** fal.ai client using FAL_KEY. Server only — never expose the key to the browser. */
export function getFal() {
  if (!process.env.FAL_KEY) {
    throw new Error("Missing FAL_KEY: add your fal.ai API key to the environment");
  }
  if (!falClient) {
    falClient = createFalClient({ credentials: process.env.FAL_KEY });
  }
  return falClient;
}
