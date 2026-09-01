import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// OAuth callback: exchange the code for a session, then land on the dashboard.
// When the elevated "Connect GitHub" flow (?connect=1) brings back a
// provider_token with repo scope, persist it so we can scan private repos.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/app";
  const isConnect = searchParams.get("connect") === "1";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      let dest = next;
      if (isConnect && data.session?.provider_token) {
        const login =
          (data.user?.user_metadata?.user_name as string | undefined) ??
          (data.user?.user_metadata?.preferred_username as string | undefined) ??
          null;
        await supabase.rpc("store_github_token", {
          p_login: login,
          p_token: data.session.provider_token,
          p_scope: "repo",
        });
      } else if (!isConnect) {
        // Fresh sign-in with an empty workspace → run the onboarding wizard.
        const { count } = await supabase.from("repos").select("id", { count: "exact", head: true });
        if (!count) dest = "/connect";
      }
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocal = process.env.NODE_ENV === "development";
      if (isLocal) return NextResponse.redirect(`${origin}${dest}`);
      if (forwardedHost) return NextResponse.redirect(`https://${forwardedHost}${dest}`);
      return NextResponse.redirect(`${origin}${dest}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("Could not sign in with GitHub")}`);
}
