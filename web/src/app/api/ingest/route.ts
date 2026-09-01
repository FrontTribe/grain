import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Public ingest endpoint. The CLI / GitHub Action POSTs a grain.json body with
//   Authorization: Bearer grain_xxxxx
// The token is validated inside Postgres (ingest_grain is SECURITY DEFINER and
// self-guards on the token hash), so this route only needs the anon key.
export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!token) {
    return NextResponse.json({ error: "missing bearer token" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!payload || typeof payload !== "object" || !("summary" in (payload as object))) {
    return NextResponse.json({ error: "not a grain report (missing summary)" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "server not configured" }, { status: 500 });
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("ingest_grain", {
    p_token: token,
    p_payload: payload,
  });

  if (error) {
    const invalid = error.message?.includes("invalid token");
    return NextResponse.json(
      { error: invalid ? "invalid token" : error.message },
      { status: invalid ? 401 : 400 },
    );
  }
  return NextResponse.json(data);
}

// Friendly response for humans hitting the URL in a browser.
export function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "grain ingest",
    usage: "POST grain.json with header 'Authorization: Bearer grain_...'",
  });
}
