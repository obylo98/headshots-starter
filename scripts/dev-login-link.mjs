// DEV ONLY: create a one-time login link without sending an email.
// Uses the service-role key from .env.local, so never expose this in the app.
//
//   node --env-file=.env.local scripts/dev-login-link.mjs                 # list users
//   node --env-file=.env.local scripts/dev-login-link.mjs you@example.com # print a link
//
// Optional: APP_URL=https://your-app.vercel.app (defaults to http://localhost:3000)

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (run with --env-file=.env.local)");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const email = process.argv[2];

if (!email) {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 50 });
  if (error) throw error;
  console.log("Users in this project:");
  for (const u of data.users) {
    console.log(`  ${u.email}  (confirmed: ${u.email_confirmed_at ? "yes" : "no"})`);
  }
  console.log("\nRun again with an email to get a login link.");
  process.exit(0);
}

const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
if (error) {
  console.error("Could not generate link:", error.message);
  process.exit(1);
}

const link = `${appUrl}/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink&next=/overview`;
console.log("\nOne-time login link (valid ~1 hour, single use):\n");
console.log(link + "\n");
