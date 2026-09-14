-- ingest_grain_service — session-less ingest for the GitHub App webhook.
--
-- The webhook has no logged-in user, so it can't call ingest_grain_member
-- (which resolves the org from auth.uid()). This variant takes an explicit
-- org and stores a scan report exactly the same way the connect path does.
--
-- Scale note: the report carries fractions in [0,1]; grain stores percentages
-- 0-100 (the UI renders round(value)%), so every share is ×100 here.
--
-- ⚠ Two things to confirm against your actual schema before relying on this:
--   1. The upsert key below is (org_id, full_name). If repos has its unique
--      index on something else, change the ON CONFLICT target to match.
--   2. If ingest_grain_member ALSO writes an org-level snapshot (repo_id NULL)
--      that powers the Overview trend, uncomment the matching INSERT near the
--      end so webhook scans keep that chart populated for real workspaces.
-- The safest route is still to mirror ingest_grain_member exactly — see the
-- "guaranteed-exact" note in docs/github-app-setup.md.

create or replace function ingest_grain_service(p_org uuid, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full     text := p_payload->>'repo';
  v_name     text;
  v_sum      jsonb := p_payload->'summary';
  v_basis    jsonb := coalesce(v_sum->'ai_by_basis', '{}'::jsonb);
  v_human    int := round(coalesce((v_sum->>'human')::numeric, 0) * 100);
  v_ai       int := round(coalesce((v_sum->>'ai_assisted')::numeric, 0) * 100);
  v_unc      int := round(coalesce((v_sum->>'unclassified')::numeric, 0) * 100);
  v_att      int := round(coalesce((v_basis->>'attested')::numeric, 0) * 100);
  v_dec      int := round(coalesce((v_basis->>'declared')::numeric, 0) * 100);
  v_inf      int := round(coalesce((v_basis->>'inferred')::numeric, 0) * 100);
  v_commits  int := coalesce((p_payload->'range'->>'commits')::int, 0);
  v_threshold numeric;
  v_status   text;
  v_repo_id  uuid;
  d          jsonb;
  v_pos      int := 0;
begin
  -- short name = the part after "owner/"
  v_name := nullif(split_part(v_full, '/', 2), '');
  if v_name is null then
    v_name := v_full;
  end if;

  -- attention when AI share is over the org policy threshold (fallback 40%)
  select coalesce(threshold, 0.40) into v_threshold from org_policy where org_id = p_org;
  v_status := case when v_ai > coalesce(v_threshold, 0.40) * 100 then 'attention' else 'healthy' end;

  -- upsert the repo row
  insert into repos (org_id, name, full_name, human, ai, unc, status,
                     ai_attested, ai_declared, ai_inferred, last_scan_at)
  values (p_org, v_name, v_full, v_human, v_ai, v_unc, v_status,
          v_att, v_dec, v_inf, now())
  on conflict (org_id, full_name) do update
    set human = excluded.human,
        ai = excluded.ai,
        unc = excluded.unc,
        status = excluded.status,
        ai_attested = excluded.ai_attested,
        ai_declared = excluded.ai_declared,
        ai_inferred = excluded.ai_inferred,
        last_scan_at = now()
  returning id into v_repo_id;

  -- per-repo scan snapshot (drives per-repo trend/sparklines)
  insert into scans (org_id, repo_id, human, ai, unc, commits, created_at)
  values (p_org, v_repo_id, v_human, v_ai, v_unc, v_commits, now());

  -- rebuild the directory breakdown
  delete from repo_dirs where repo_id = v_repo_id;
  for d in select * from jsonb_array_elements(coalesce(p_payload->'by_path', '[]'::jsonb))
  loop
    insert into repo_dirs (repo_id, path, human, ai, owned, lines, position)
    values (v_repo_id,
            d->>'path',
            round(coalesce((d->>'human')::numeric, 0) * 100),
            round(coalesce((d->>'ai')::numeric, 0) * 100),
            coalesce((d->>'human_owned')::boolean, false),
            coalesce((d->>'lines')::int, 0),
            v_pos);
    v_pos := v_pos + 1;
  end loop;

  -- OPTIONAL — org-level snapshot for the Overview trend. Uncomment only if
  -- ingest_grain_member writes one too (check its body). It stores the org's
  -- average across repos as a repo_id-NULL scan row.
  -- insert into scans (org_id, repo_id, human, ai, unc, commits, created_at)
  -- select p_org, null,
  --        round(avg(ai))::int * 0 + round(avg(human))::int,  -- avg human
  --        round(avg(ai))::int, round(avg(unc))::int, 0, now()
  -- from repos where org_id = p_org;
end;
$$;

-- Only the service role (the webhook) may call it.
revoke all on function ingest_grain_service(uuid, jsonb) from public, anon, authenticated;
