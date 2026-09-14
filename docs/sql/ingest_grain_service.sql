-- ingest_grain_service — session-less ingest for the GitHub App webhook.
--
-- Applied to the Grain project on 2026-09-14. ingest_grain_member turned out to
-- be a thin wrapper that resolves the org from auth.uid() and delegates to the
-- shared public._grain_apply(org, payload); the webhook variant delegates to the
-- exact same function with an explicit org, so it is guaranteed identical to the
-- connect path with zero reconstruction.

create or replace function public.ingest_grain_service(p_org uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
begin
  return public._grain_apply(p_org, p_payload);
end $function$;

-- Webhook-only: it runs as service_role, which keeps its EXECUTE grant.
revoke all on function public.ingest_grain_service(uuid, jsonb) from public, anon, authenticated;
