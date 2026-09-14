import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { installationToken } from "@/lib/githubApp";
import { scanGithubRepo, parseRepoInput } from "@/lib/github";
import { notifyAttentionForOrg, notifyRiskForOrg, notifySecurityForOrg } from "@/lib/notify";

export const runtime = "nodejs";

// Service-role client: the webhook has no user session. It writes only after the
// GitHub signature has been verified.
function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false },
  });
}

// Constant-time check of the X-Hub-Signature-256 HMAC over the raw body.
function verifySignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  // Not configured yet → acknowledge so GitHub's ping succeeds, but do nothing.
  if (!secret) return NextResponse.json({ ok: false, reason: "webhook not configured" });

  const body = await req.text();
  const event = req.headers.get("x-github-event");
  const signature = req.headers.get("x-hub-signature-256");

  if (!verifySignature(body, signature, secret)) {
    return NextResponse.json({ error: "signature verification failed" }, { status: 401 });
  }

  if (event === "ping") return NextResponse.json({ ok: true, pong: true });
  if (event !== "push") return NextResponse.json({ ok: true, ignored: event });

  let payload: PushPayload;
  try {
    payload = JSON.parse(body) as PushPayload;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const fullName = payload.repository?.full_name;
  const defaultBranch = payload.repository?.default_branch;
  const installationId = payload.installation?.id;
  const ref = payload.ref;

  // Only re-scan default-branch pushes for repos we can act on.
  if (!fullName || !installationId) return NextResponse.json({ ok: true, skipped: "missing repo or installation" });
  if (ref && defaultBranch && ref !== `refs/heads/${defaultBranch}`) {
    return NextResponse.json({ ok: true, skipped: "non-default branch" });
  }

  // Do the work, but never fail the webhook — GitHub retries non-2xx and we
  // don't want a scan hiccup to cause redelivery storms.
  const pushed = (payload.commits ?? []).map((c) => c.id ?? "").filter(Boolean);
  try {
    await rescanFromWebhook(fullName, installationId, pushed);
  } catch (err) {
    console.error("[gh-webhook] rescan failed:", (err as Error).message);
  }
  return NextResponse.json({ ok: true });
}

async function rescanFromWebhook(fullName: string, installationId: number, pushedShas: string[]): Promise<void> {
  const parsed = parseRepoInput(fullName);
  if (!parsed) return;

  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
  if (!appId || !privateKey) return; // App credentials not set — nothing to scan with

  const db = admin();
  // Which workspaces track this repo? (No work if none do.)
  const { data: rows } = await db.from("repos").select("org_id").eq("full_name", fullName);
  const orgIds = [...new Set(((rows ?? []) as { org_id: string }[]).map((r) => r.org_id))];
  if (orgIds.length === 0) return;

  const token = await installationToken(appId, privateKey, installationId);
  if (!token) return;

  const scan = await scanGithubRepo(parsed.owner, parsed.repo, { token, max: 100 });
  for (const orgId of orgIds) {
    // Service-role ingest: a thin, session-less wrapper around the member ingest
    // that takes an explicit org (see docs/github-app-setup.md).
    await db.rpc("ingest_grain_service", { p_org: orgId, p_payload: scan.report });
    // Alert the workspace's admins if this push pushed the repo over threshold…
    try {
      await notifyAttentionForOrg(db, orgId, parsed.repo, scan.ai);
    } catch (err) {
      console.error("[gh-webhook] notify failed:", (err as Error).message);
    }
    // …or put unreviewed AI-written lines into a critical path.
    if (scan.report.risk) {
      try {
        await notifyRiskForOrg(db, orgId, parsed.repo, scan.report.risk, pushedShas);
      } catch (err) {
        console.error("[gh-webhook] risk notify failed:", (err as Error).message);
      }
    }
    // …or landed AI-written security findings or packages the registry does not know.
    try {
      await notifySecurityForOrg(db, orgId, parsed.repo, scan.report.security, scan.report.dependencies, pushedShas);
    } catch (err) {
      console.error("[gh-webhook] security notify failed:", (err as Error).message);
    }
  }
}

type PushPayload = {
  ref?: string;
  repository?: { full_name?: string; default_branch?: string };
  installation?: { id?: number };
  commits?: { id?: string }[];
};
