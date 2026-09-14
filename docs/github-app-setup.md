# GitHub App + webhook — auto-scan on push

The webhook route (`/api/github/webhook`) re-scans a connected repo whenever
GitHub sends a `push` to its default branch. It's inert until you register a
GitHub App and add the env vars below, so it's safe to deploy first.

The route is done and verified (signature check + event routing). Three things
are yours: register the App, set the env vars, and add one Supabase function.

---

## 1 — Register the GitHub App

github.com → Settings → Developer settings → **GitHub Apps** → **New GitHub App**

- **Webhook URL**: `https://getgrain.dev/api/github/webhook`
- **Webhook secret**: generate a random string, keep it (→ `GITHUB_WEBHOOK_SECRET`)
- **Repository permissions**: **Contents: Read-only**, **Metadata: Read-only**
  (Contents read is what lets the scan fetch commits, diffs, and git notes)
- **Subscribe to events**: **Push**
- After creating: note the **App ID**, and **Generate a private key** (.pem download)

Then **Install** the App on the repos/orgs you want auto-scanned.

---

## 2 — Vercel env vars (Production)

```
GITHUB_APP_ID           = <the App ID, e.g. 123456>
GITHUB_WEBHOOK_SECRET   = <the webhook secret from step 1>
GITHUB_APP_PRIVATE_KEY  = <contents of the .pem — paste with real newlines, or with \n escapes>
```

`SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SUPABASE_URL` are already set.

I can add the two non-secret-sensitive ones via CLI; paste the **private key**
yourself in the Vercel dashboard (it's as sensitive as a password).

---

## 3 — Supabase: a session-less ingest function

The webhook has no logged-in user, so it can't call `ingest_grain_member`
(which resolves the org from `auth.uid()`). Add a sibling that takes an explicit
org and reuses the exact same ingest body. In the Supabase SQL editor:

```sql
create or replace function ingest_grain_service(p_org uuid, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Paste the BODY of ingest_grain_member here, but wherever it derives the
  -- org from the caller (e.g. `v_org := (select org_id from org_members
  -- where user_id = auth.uid() ...)`), use p_org instead. Everything else —
  -- upserting the repo, inserting the scan snapshot, repo_dirs, events — is
  -- identical, so the webhook path and the connect path store data the same way.
  perform 1;
end;
$$;

revoke all on function ingest_grain_service(uuid, jsonb) from public, anon, authenticated;
-- service_role (the webhook) bypasses RLS and may execute it.
```

> Why this can't be automated from here: this repo's Supabase project isn't the
> one the tooling is connected to, so the function has to be added from your
> dashboard. The webhook already calls it by name; once it exists, pushes flow
> straight through.

---

## How it works once live

1. Push to a connected repo's default branch → GitHub POSTs the `push` event.
2. The route verifies the `X-Hub-Signature-256` HMAC against `GITHUB_WEBHOOK_SECRET`.
3. It mints an installation token from the App key, finds the workspaces that
   track the repo, re-scans (attested + declared + inferred), and ingests.
4. Non-default-branch pushes, unknown repos, and unsigned requests are ignored.

Failures never return non-2xx (GitHub would retry and storm); they're logged.
