import { Database } from "@/types/supabase";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { type EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Handles magic-link / sign-up emails that use the token-hash template:
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
// (The default Supabase template instead goes through /auth/callback.)
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = url.searchParams.get("next");
  // Only allow relative redirects to avoid open-redirects.
  const redirectTo = next && next.startsWith("/") && !next.startsWith("//") ? next : "/overview";

  if (tokenHash && type) {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) {
      return NextResponse.redirect(new URL(redirectTo, url.origin));
    }
    console.error("[auth/confirm] verifyOtp failed", error);
  }

  return NextResponse.redirect(new URL("/login/failed?err=AuthApiError", url.origin));
}
