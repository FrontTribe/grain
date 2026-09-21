import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { TopBar, Card, MiniBar } from "@/components/dashboard/ui";
import { Fingerprint } from "@/components/Fingerprint";
import { RepoPolicyForm } from "@/components/dashboard/RepoPolicyForm";
import { BadgeCard } from "@/components/dashboard/BadgeCard";
import { getRepoDetail, ago, num } from "@/lib/data";
import { rescanRepo } from "@/app/app/integrations/actions";
import { connectGithub } from "@/app/auth/actions";
import { suspicious, triageReason } from "@/lib/triage";

const btn = "inline-flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13.5px] font-semibold";

const BANNERS: Record<string, string> = {
  rescanned: "Re-scanned from GitHub. Provenance updated.",
  "policy=saved": "Repo policy override saved.",
  "policy=cleared": "Reverted to the organization default policy.",
};

export default async function RepoDetail({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ error?: string; rescanned?: string; policy?: string; reconnect?: string }>;
}) {
  const { name } = await params;
  const { error, rescanned, policy: policyMsg, reconnect } = await searchParams;
  const data = await getRepoDetail(name);
  if (!data) notFound();
  const { repo, dirs, prs, policy, orgPolicy } = data;
  const okMsg = rescanned ? BANNERS.rescanned : policyMsg ? BANNERS[`policy=${policyMsg}`] : "";
  const origin = (await headers()).get("origin") ?? "";
  const badgeUrl = repo.badge_token ? `${origin}/api/badge/${repo.badge_token}.svg` : null;

  return (
    <>
      <TopBar
        title=""
        right={
          <>
            <form action={rescanRepo}>
              <input type="hidden" name="full_name" value={repo.full_name ?? ""} />
              <input type="hidden" name="name" value={repo.name} />
              <button type="submit" className={`${btn} bg-ink text-ground`}>Re-scan</button>
            </form>
          </>
        }
      />
      {(error || okMsg) && (
        <div className={`mx-7 mt-4 rounded-[10px] border px-3.5 py-2.5 text-[13px] ${error ? "border-ai/40 bg-ai-soft text-ai" : "border-human/40 bg-human-soft text-human"}`}>
          {error ? error : okMsg}
        </div>
      )}
      {reconnect && (
        <div className="mx-7 mt-4 flex flex-wrap items-center gap-3 rounded-[10px] border border-ai/40 bg-ai-soft px-3.5 py-2.5 text-[13px] text-ai">
          <span className="min-w-0 flex-1">
            {reconnect === "rescanned"
              ? "GitHub no longer accepts your connected token. This public repo was re-scanned without it; private repos and push scans need a fresh connection."
              : "GitHub no longer accepts your connected token, so this repo could not be re-scanned. Reconnect GitHub and try again."}
          </span>
          <form action={connectGithub}>
            <input type="hidden" name="next" value={`/app/repos/${encodeURIComponent(repo.name)}`} />
            <button type="submit" className={`${btn} bg-ink text-ground`}>Reconnect GitHub</button>
          </form>
        </div>
      )}
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-7">
        <div className="-mt-2 font-mono text-sm text-muted">
          Repositories / <span className="font-display text-lg font-bold text-ink">{repo.name}</span>
        </div>

        <Card className="grid grid-cols-1 items-center gap-6 p-6 md:grid-cols-[210px_1fr_auto]">
          <div>
            <div className="font-display text-6xl font-extrabold leading-none tracking-tighter text-human">{num(repo.human)}%</div>
            <div className="mt-2 font-mono text-[11px] uppercase tracking-wider text-muted">human-authored</div>
          </div>
          <div>
            <div className="flex h-3.5 gap-0.5 overflow-hidden rounded-lg border border-line-strong">
              <span className="bg-human" style={{ width: `${num(repo.human)}%` }} />
              <span className="bg-ai" style={{ width: `${num(repo.ai)}%` }} />
              <span className="bg-line-strong" style={{ width: `${num(repo.unc)}%` }} />
            </div>
            <div className="mt-2.5 flex gap-4 font-mono text-[12.5px] text-muted">
              <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-human" />{num(repo.human)}% human</span>
              <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-ai" />{num(repo.ai)}% AI</span>
              <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-line-strong" />{num(repo.unc)}% uncl.</span>
            </div>
            <div className="mt-3 text-[12.5px] text-muted">
              {repo.human_owned.length > 0 ? (
                <>Human-owned: {repo.human_owned.map((p) => (
                  <code key={p} className="mr-1 rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11.5px]">{p}</code>
                ))}· </>
              ) : null}
              last scan {repo.last_scan_at ? ago(repo.last_scan_at) + " ago" : "no scan yet"}
            </div>
          </div>
          <div className="text-right">
            <span className="inline-flex overflow-hidden rounded border border-line font-mono text-xs">
              <span className="bg-ink px-2 py-1 text-ground">grain</span>
              <span className="bg-surface-2 px-2 py-1 font-semibold">{num(repo.ai)}% AI-assisted</span>
            </span>
          </div>
        </Card>

        {num(repo.ai) > 0 && (
          <Card className="p-5">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="font-display text-[15px] font-bold">Provenance basis</h3>
              <span className="font-mono text-[11px] text-faint">how the {num(repo.ai)}% AI-assisted was determined</span>
            </div>
            <p className="mb-3 text-[12.5px] text-muted">
              High-confidence (attested + declared) vs an inferred guess. Signals, not verdicts: inferred is capped, never certain.
            </p>
            {(() => {
              const att = num(repo.ai_attested), dec = num(repo.ai_declared), inf = num(repo.ai_inferred);
              const w = (v: number) => (num(repo.ai) > 0 ? (v / num(repo.ai)) * 100 : 0);
              return (
                <>
                  <div className="flex h-3.5 gap-0.5 overflow-hidden rounded-lg border border-line-strong">
                    <span className="bg-ai" style={{ width: `${w(att)}%` }} title="attested" />
                    <span className="bg-ai/70" style={{ width: `${w(dec)}%` }} title="declared" />
                    <span className="border border-dashed border-ai/50 bg-ai-soft" style={{ width: `${w(inf)}%` }} title="inferred (guess)" />
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-4 font-mono text-[12px] text-muted">
                    <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-ai" />{att}% attested</span>
                    <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-ai/70" />{dec}% declared</span>
                    <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm border border-dashed border-ai/50 bg-ai-soft" />{inf}% inferred <span className="text-faint">(guess)</span></span>
                  </div>
                </>
              );
            })()}
          </Card>
        )}

        {(() => {
          const o = repo.outcomes;
          if (!o) return null;
          const MIN = 30;
          const valid = (c: typeof o.strict) => c.ai_lines >= MIN && c.human_lines >= MIN;
          const which = valid(o.strict) ? "strict" : "broad";
          const c = o[which];
          if (c.ai_lines === 0 && c.human_lines === 0) return null;
          const rate = (n: number, d: number) => (d ? n / d : 0);
          const aiR = rate(c.ai_reworked, c.ai_lines);
          const huR = rate(c.human_reworked, c.human_lines);
          const ratio = huR > 0 ? aiR / huR : 0;
          // literal class names so Tailwind can see them
          const TONE = { ai: { text: "text-ai", bar: "bg-ai" }, human: { text: "text-human", bar: "bg-human" } } as const;
          const row = (label: string, lines: number, reworked: number, fix: number, r: number, tone: "ai" | "human") => (
            <div className="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-[12.5px]">
              <span className={`font-medium ${TONE[tone].text}`}>{label}</span>
              <div className="h-2 overflow-hidden rounded-full bg-line-strong/40">
                <div className={`h-full rounded-full ${TONE[tone].bar}`} style={{ width: `${Math.round(r * 100)}%` }} />
              </div>
              <span className="font-mono tabular-nums text-muted">
                <b className="text-ink">{Math.round(r * 100)}%</b> reworked · {reworked}/{lines} lines · {fix} in fixes
              </span>
            </div>
          );
          return (
            <Card className="p-5">
              <div className="mb-1 flex items-center justify-between">
                <h3 className="font-display text-[15px] font-bold">Outcomes</h3>
                <span className="font-mono text-[11px] text-faint">{which} cohort · what happened after the code landed</span>
              </div>
              <p className="mb-3.5 text-[12.5px] text-muted">
                {which === "strict"
                  ? "AI-written and human-written lines from the same attested commits, so author, style and era are held constant."
                  : "Across all commits; undeclared AI counts as human, so the AI figures are a floor."}
              </p>
              <div className="flex flex-col gap-2.5">
                {row("AI-written", c.ai_lines, c.ai_reworked, c.ai_reworked_in_fix, aiR, "ai")}
                {row("Human-written", c.human_lines, c.human_reworked, c.human_reworked_in_fix, huR, "human")}
              </div>
              <div className="mt-3.5 text-[12.5px]">
                {!valid(c) ? (
                  <span className="text-faint">Not enough lines on both sides for a verdict yet (need {MIN} each).</span>
                ) : ratio > 0 ? (
                  <span>AI-written lines were reworked <b className={ratio > 1 ? "text-ai" : "text-human"}>{ratio.toFixed(1)}×</b> as often as human-written ones
                    <span className="text-faint"> · median {c.ai_median_commits_to_rework} vs {c.human_median_commits_to_rework} commits until rework</span></span>
                ) : aiR > 0 ? (
                  <span className="text-faint">No human-written rework to compare against yet.</span>
                ) : (
                  <span className="text-faint">No rework recorded yet on either side.</span>
                )}
              </div>
            </Card>
          );
        })()}

        {(() => {
          const rk = repo.risk;
          if (!rk || rk.ai_lines === 0) return null;
          const share = rk.critical_ai_lines ? rk.critical_ai_unreviewed / rk.critical_ai_lines : 0;
          return (
            <Card className="p-5">
              <div className="mb-1 flex items-center justify-between">
                <h3 className="font-display text-[15px] font-bold">Risk</h3>
                <span className="font-mono text-[11px] text-faint">
                  {rk.source === "cloud" ? `last ${rk.commits ?? "?"} commits · GitHub scan` : rk.source === "cli" ? "full history · CLI scan" : "AI-written code in critical paths"}
                </span>
              </div>
              {rk.critical_ai_lines === 0 ? (
                <p className="text-[12.5px] text-muted">No AI-written lines landed in critical paths ({rk.patterns.slice(0, 6).join(", ")}…).</p>
              ) : (
                <>
                  <p className="mb-3.5 text-[12.5px] text-muted">
                    <b className={share > 0.5 ? "text-ai" : "text-ink"}>{rk.critical_ai_unreviewed}</b> of {rk.critical_ai_lines} AI-written lines in critical paths
                    (<b className="text-ink">{Math.round(share * 100)}%</b>) landed with no review evidence, no pull request, no reviewer trailer, applied by the author.
                    {typeof rk.approved_ai_lines === "number" && rk.approved_ai_lines > 0 && (
                      <> Of the reviewed ones, <b className="text-human">{rk.approved_ai_lines}</b> went through a PR someone else approved.</>
                    )}
                  </p>
                  <div className="flex flex-col gap-2">
                    {rk.critical.slice(0, 6).map((p) => (
                      <div key={p.path} className="grid grid-cols-[150px_1fr_auto] items-center gap-3 text-[12.5px]">
                        <code className="truncate font-mono text-[11.5px]">{p.path}</code>
                        <div className="h-2 overflow-hidden rounded-full bg-line-strong/40">
                          <div className="h-full rounded-full bg-ai" style={{ width: `${p.ai_lines ? Math.round((p.ai_unreviewed / p.ai_lines) * 100) : 0}%` }} />
                        </div>
                        <span className="font-mono tabular-nums text-muted"><b className="text-ink">{p.ai_unreviewed}</b>/{p.ai_lines} unreviewed · {p.commits} {p.commits === 1 ? "commit" : "commits"}</span>
                      </div>
                    ))}
                  </div>
                  {rk.top.length > 0 && (
                    <div className="mt-3.5 border-t border-line/60 pt-3">
                      <div className="mb-1.5 font-mono text-[10.5px] uppercase tracking-wider text-muted">Hotspots</div>
                      <div className="flex flex-col gap-1">
                        {rk.top.slice(0, 5).map((h) => (
                          <div key={h.sha + h.path} className="flex items-center gap-2.5 text-[12.5px]">
                            <code className="font-mono text-[11px] text-faint">{h.sha.slice(0, 7)}</code>
                            <span className="min-w-0 flex-1 truncate">{h.subject}</span>
                            <code className="font-mono text-[11px] text-muted">{h.path}</code>
                            <span className="font-mono tabular-nums text-ai">{h.ai_lines}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </Card>
          );
        })()}

        {(() => {
          const sec = repo.security;
          if (!sec) return null;
          const scope = sec.source === "cloud" ? `last ${sec.commits ?? "?"} commits · GitHub scan` : sec.source === "cli" ? "full history · CLI scan" : "";
          return (
            <Card className="p-5">
              <div className="mb-1 flex items-center justify-between">
                <h3 className="font-display text-[15px] font-bold">Security</h3>
                <span className="font-mono text-[11px] text-faint">{scope || "danger patterns in added lines"}</span>
              </div>
              {sec.total === 0 ? (
                <p className="text-[12.5px] text-muted">No added line matched grain&apos;s danger patterns (secrets, disabled TLS, shell or SQL built from strings, unsafe deserialization, wildcard IAM). Tests and fixtures are not scanned.</p>
              ) : (
                <>
                  <p className="mb-3.5 text-[12.5px] text-muted">
                    <b className={sec.ai_unreviewed > 0 ? "text-ai" : "text-ink"}>{sec.total}</b> {sec.total === 1 ? "line looks" : "lines look"} worth a second look: <b className="text-ink">{sec.ai}</b> AI-written, <b className="text-ink">{sec.ai_unreviewed}</b> of those with no review evidence
                    {sec.ai_critical_unreviewed > 0 && <>, <b className="text-ai">{sec.ai_critical_unreviewed}</b> in a critical path</>}. Pattern matches joined with provenance, not confirmed vulnerabilities.
                  </p>
                  <div className="flex flex-col gap-2">
                    {sec.by_pattern.slice(0, 6).map((p) => (
                      <div key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-[12.5px]">
                        <span className="min-w-0 truncate">
                          <code className="font-mono text-[11.5px] text-muted">{p.id}</code> <span className="text-ink">{p.title}</span>
                          <span className={`ml-2 rounded-full px-1.5 py-px font-mono text-[10px] ${p.severity === "high" ? "bg-ai-soft text-ai" : "bg-surface-2 text-muted"}`}>{p.severity}</span>
                        </span>
                        <span className="font-mono tabular-nums text-muted"><b className="text-ai">{p.ai}</b> AI · {p.human} human</span>
                      </div>
                    ))}
                  </div>
                  {sec.findings.length > 0 && (
                    <div className="mt-3.5 border-t border-line/60 pt-3">
                      <div className="mb-1.5 font-mono text-[10.5px] uppercase tracking-wider text-muted">Start here</div>
                      <div className="flex flex-col gap-1.5">
                        {sec.findings.slice(0, 6).map((f) => (
                          <div key={f.sha + f.path + f.pattern + f.excerpt} className="text-[12.5px]">
                            <div className="flex items-center gap-2.5">
                              <code className="font-mono text-[11px] text-faint">{f.sha.slice(0, 7)}</code>
                              <code className="min-w-0 truncate font-mono text-[11.5px]">{f.path}</code>
                              <span className="text-muted">{f.title}</span>
                              <span className={`ml-auto font-mono text-[10.5px] ${f.ai ? "text-ai" : "text-muted"}`}>{f.ai ? "AI" : "human"}{f.reviewed ? "" : " · unreviewed"}{f.critical ? ` · ${f.critical}` : ""}</span>
                            </div>
                            {f.excerpt && <code className="mt-0.5 block truncate rounded bg-surface-2 px-2 py-1 font-mono text-[11px] text-muted">{f.excerpt}</code>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </Card>
          );
        })()}

        {(() => {
          const dp = repo.dependencies;
          if (!dp || dp.total === 0) return null;
          const scope = dp.source === "cloud" ? `last ${dp.commits ?? "?"} commits · GitHub scan` : dp.source === "cli" ? "full history · CLI scan" : "";
          const flagged = dp.deps.filter((d) => suspicious(d.triage, d) || (d.checked && (!d.exists || (d.age_days >= 0 && d.age_days < 30))));
          const rest = dp.deps.filter((d) => !flagged.includes(d));
          const reg = (d: (typeof dp.deps)[number]) =>
            !d.checked ? "not checked" : !d.exists ? "not found" : d.age_days >= 0 && d.age_days < 30 ? `${d.age_days} days old` : d.age_days >= 0 ? `${Math.round(d.age_days / 365)}y` : "exists";
          const why = (d: (typeof dp.deps)[number]) => (suspicious(d.triage, d) ? triageReason(d.triage) : "");
          const triaged = dp.deps.some((d) => d.triage);
          return (
            <Card className="p-5">
              <div className="mb-1 flex items-center justify-between">
                <h3 className="font-display text-[15px] font-bold">Dependencies</h3>
                <span className="font-mono text-[11px] text-faint">{scope || "added in this range"}</span>
              </div>
              <p className="mb-3.5 text-[12.5px] text-muted">
                <b className="text-ink">{dp.total}</b> added, <b className="text-ink">{dp.ai}</b> by AI-written lines, <b className="text-ink">{dp.ai_unreviewed}</b> of those with no review evidence.
                {dp.checked ? (
                  <> Registries: <b className={dp.missing > 0 ? "text-ai" : "text-ink"}>{dp.missing} not found</b>, <b className={dp.young > 0 ? "text-ai" : "text-ink"}>{dp.young}</b> younger than 30 days.{triaged && <> Names: <b className={(dp.suspicious ?? 0) > 0 ? "text-ai" : "text-ink"}>{dp.suspicious ?? 0}</b> look typosquatted or invented.</>}</>
                ) : (
                  <> Registries not consulted (run the CLI with <code className="font-mono">--check-registry</code>).</>
                )}
              </p>
              {flagged.length > 0 && (
                <div className="mb-3 flex flex-col gap-1.5">
                  {flagged.slice(0, 8).map((d) => (
                    <div key={d.ecosystem + d.name} className="flex items-center gap-2.5 rounded-[8px] bg-ai-soft px-2.5 py-1.5 text-[12.5px]">
                      <a href={d.url} target="_blank" rel="noreferrer" className="font-mono text-[12px] font-semibold text-ink hover:underline">{d.name}</a>
                      <span className="font-mono text-[10.5px] text-muted">{d.ecosystem}</span>
                      {why(d) && <span className="text-[11.5px] text-ai">{why(d)}</span>}
                      <span className="ml-auto font-mono text-[11px] font-semibold text-ai">{reg(d)}</span>
                      <span className="font-mono text-[10.5px] text-muted">{d.ai ? "AI" : "human"}{d.reviewed ? "" : " · unreviewed"}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-1.5">
                {rest.slice(0, 24).map((d) => (
                  <a key={d.ecosystem + d.name} href={d.url} target="_blank" rel="noreferrer" title={`${d.ecosystem} · ${d.ai ? "AI" : "human"} · ${d.reviewed ? "reviewed" : "no review evidence"} · ${reg(d)}`}
                    className={`rounded-full border px-2 py-0.5 font-mono text-[11px] hover:border-ink ${d.ai ? "border-ai/40 text-ai" : "border-line text-muted"}`}>
                    {d.name}
                  </a>
                ))}
                {rest.length > 24 && <span className="px-1 py-0.5 font-mono text-[11px] text-faint">+{rest.length - 24} more</span>}
              </div>
              <p className="mt-3 text-[11.5px] text-faint">Orange chips were added by AI-written lines. Existence is not safety; this is where to look, not an audit of package contents.{triaged && <> Name triage by TypeSafe Jev sees the package name, ecosystem and registry answer, nothing else.</>}</p>
            </Card>
          );
        })()}

        <Card className="p-5">
          <div className="mb-2.5 flex flex-wrap gap-3.5 font-mono text-[11px] text-muted">
            <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-human" />human</span>
            <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-ai" />AI-assisted</span>
            <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-line-strong" />unclassified</span>
            <span className="text-faint">· commit history, oldest → newest</span>
          </div>
          <Fingerprint height={84} bars={120} />
        </Card>

        <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
          <Card className="p-5">
            <h3 className="mb-3 font-display text-[15px] font-bold">By directory</h3>
            {dirs.length === 0 ? (
              <div className="py-6 text-center text-[13px] text-faint">No directory data yet.</div>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="[&_th]:border-b [&_th]:border-line/60 [&_th]:px-2 [&_th]:py-2 [&_th]:text-left [&_th]:font-mono [&_th]:text-[10px] [&_th]:font-normal [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted">
                    <th>Path</th><th>Mix</th><th>Human / AI</th><th></th>
                  </tr>
                </thead>
                <tbody className="[&_td]:border-b [&_td]:border-line/50 [&_td]:px-2 [&_td]:py-2.5 [&_td]:text-[12.5px] [&_tr:last-child_td]:border-none">
                  {dirs.map((row) => (
                    <tr key={row.path}>
                      <td className="font-mono">{row.path}</td>
                      <td><MiniBar human={num(row.human)} ai={num(row.ai)} width={96} /></td>
                      <td className="font-mono tabular-nums">{num(row.human)} / {num(row.ai)}</td>
                      <td>{row.owned && <span className="rounded bg-ai-soft px-1.5 py-0.5 font-mono text-[10px] text-ai">human-owned</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <div className="flex flex-col gap-4">
            <Card className="p-5">
              <RepoPolicyForm repoId={repo.id} name={repo.name} policy={policy} orgPolicy={orgPolicy} />
            </Card>

            <Card className="p-5">
              <BadgeCard repoId={repo.id} name={repo.name} badgeUrl={badgeUrl} />
            </Card>

            <Card className="p-5">
              <h3 className="mb-3 font-display text-[15px] font-bold">Recent pull requests</h3>
              <div className="flex flex-col">
                {prs.map((pr) => (
                  <div key={pr.number} className="flex items-center gap-2.5 border-b border-line/50 py-2.5 last:border-none">
                    <span className={`size-2 flex-none rounded-full ${num(pr.ai) >= 40 ? "bg-ai" : "bg-human"}`} />
                    <span className="text-[12.5px]">{pr.title} <span className="font-mono text-faint">#{pr.number}</span></span>
                    <span className={`ml-auto font-mono text-[12px] font-semibold ${num(pr.ai) >= 40 ? "text-ai" : "text-human"}`}>{num(pr.ai)}% AI</span>
                  </div>
                ))}
                {prs.length === 0 && <div className="py-6 text-center text-[13px] text-faint">No pull requests yet.</div>}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
