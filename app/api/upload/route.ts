import { MAX_REFERENCE_FILE_BYTES } from "@/lib/ai-models";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// Issues short-lived tokens so the browser can upload selfies straight to
// Vercel Blob (see README "Configure Vercel Blob").
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        // Only signed-in users may upload. (The completion callback below is
        // called by Vercel without cookies, so auth is checked only here.)
        const supabase = createRouteHandlerClient({ cookies });
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Unauthorized");

        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
          maximumSizeInBytes: MAX_REFERENCE_FILE_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: user.id }),
        };
      },
      onUploadCompleted: async () => {
        // Nothing to do: the generate endpoint records the URLs.
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
