import Link from "next/link";
import { TopBar, Card } from "@/components/dashboard/ui";
import { getUserAndOrg, getIngestTokens, getOrgMembers, getInvites, getMyOrgs, getActiveOrgId, getRepos } from "@/lib/data";
import { FREE_LIMITS, PLAN_FEATURES, TEAM_PRICE_USD } from "@/lib/plan";
import { IngestTokens } from "@/components/dashboard/IngestTokens";
import { MembersCard } from "@/components/dashboard/MembersCard";
import { GithubPanel } from "@/components/dashboard/GithubPanel";
import { renameWorkspace } from "@/app/app/settings/general/actions";
import { startCheckout, openPortal } from "@/app/app/settings/billing/actions";

const btn = "inline-flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13.5px] font-semibold";

const BILLING_MSG: Record<string, { ok: boolean; text: string }> = {
  success: { ok: true, text: "Subscription active. Welcome to Team." },
  cancelled: { ok: false, text: "Checkout cancelled." },
  error: { ok: false, text: "Something went wrong with billing. Try again." },
  unconfigured: { ok: false, text: "Billing isn't configured yet." },
};

const TABS = [
  { key: "general", label: "General" },
  { key: "members", label: "Members" },
  { key: "billing", label: "Billing" },
  { key: "integrations", label: "Integrations" },
];

function Usage({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = Math.min(100, (used / limit) * 100);
  const full = used >= limit;
  return (
    <div>
      <div className="mb-1 flex justify-between text-[13px]">
        <span className="font-medium">{label}</span>
        <span className={`font-mono ${full ? "text-ai" : "text-muted"}`}>{used} / {limit}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-line-strong/50">
        <div className={`h-full rounded-full ${full ? "bg-ai" : "bg-brand"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default async function Settings({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string; billing?: string; tab?: string }> }) {
  const { saved, error, billing, tab: tabParam } = await searchParams;
  const tab = TABS.some((t) => t.key === tabParam) ? tabParam! : "general";
  const [{ org }, tokens, members, invites, myOrgs, activeId, repos] = await Promise.all([
    getUserAndOrg(), getIngestTokens(), getOrgMembers(), getInvites(), getMyOrgs(), getActiveOrgId(), getRepos(),
  ]);
  const name = org?.name ?? "Workspace";
  const slug = org?.slug ?? "workspace";
  const plan = org?.plan ?? "team";
  const subStatus = (org as { subscription_status?: string | null } | null)?.subscription_status ?? null;
  const periodEnd = (org as { current_period_end?: string | null } | null)?.current_period_end ?? null;
  const subscribed = subStatus === "active" || subStatus === "trialing";
  const myRole = myOrgs.find((o) => o.org_id === activeId)?.role ?? "member";
  const canInvite = myRole === "admin" || myRole === "owner";
  const billingMsg = billing ? BILLING_MSG[billing] : null;

  return (
    <>
      <TopBar title="Settings" />
      <div className="flex flex-none gap-6 border-b border-line bg-surface px-7">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/app/settings?tab=${t.key}`}
            className={`border-b-2 py-3.5 text-sm ${tab === t.key ? "border-brand font-medium text-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-7">
        <div className="flex max-w-[880px] flex-col gap-[18px]">
          {(saved || error) && (
            <div className={`rounded-[10px] border px-3.5 py-2.5 text-[13px] ${error ? "border-ai/40 bg-ai-soft text-ai" : "border-human/40 bg-human-soft text-human"}`}>
              {error ? error : "Saved."}
            </div>
          )}
          {billingMsg && (
            <div className={`rounded-[10px] border px-3.5 py-2.5 text-[13px] ${billingMsg.ok ? "border-human/40 bg-human-soft text-human" : "border-ai/40 bg-ai-soft text-ai"}`}>
              {billingMsg.text}
            </div>
          )}

          {tab === "general" && (
            <>
            <Card className="p-6">
              <form action={renameWorkspace}>
                <h3 className="font-display text-base font-bold">Workspace</h3>
                <p className="mb-4 mt-1 text-[12.5px] text-muted">The name and URL your team sees.</p>
                <div className="mb-3.5 flex items-center gap-4">
                  <label className="w-[150px] text-[13px] font-medium">Workspace name</label>
                  <input name="name" defaultValue={name} maxLength={60} className="h-[42px] flex-1 rounded-[9px] border border-line bg-surface px-3 text-sm outline-none focus:border-brand" />
                </div>
                <div className="flex items-center gap-4">
                  <label className="w-[150px] text-[13px] font-medium">URL</label>
                  <div className="flex h-[42px] flex-1 items-center rounded-[9px] border border-line bg-surface px-3 text-sm text-muted">
                    <span className="text-faint">getgrain.dev/</span>{slug}
                  </div>
                </div>
                <div className="mt-4 flex justify-end"><button type="submit" className={`${btn} bg-ink text-ground`}>Save changes</button></div>
              </form>
            </Card>

            <Card className="p-6">
              <h3 className="font-display text-base font-bold">Authorship report</h3>
              <p className="mb-4 mt-1 text-[12.5px] text-muted">
                A timestamped, integrity-hashed Bill of Materials of human vs AI authorship across your repos, for audits, IP due diligence, or M&amp;A.
              </p>
              <a href="/app/export" className={`${btn} border border-line bg-surface text-ink`}>Open authorship report →</a>
            </Card>
            </>
          )}

          {tab === "members" && (
            <Card className="p-6">
              <MembersCard members={members} invites={invites} canInvite={canInvite} />
            </Card>
          )}

          {tab === "billing" && (
            <Card className="flex flex-col p-6">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-bold">Plan</h3>
                {subscribed && <span className="rounded-full bg-human-soft px-2 py-0.5 font-mono text-[10.5px] text-human">{subStatus}</span>}
              </div>
              <div className="mt-2 font-display text-2xl font-extrabold capitalize tracking-tight">{subscribed ? "Team" : plan}</div>
              <div className="mt-1 text-[13px] text-muted">
                {subscribed
                  ? `$${TEAM_PRICE_USD} / month${periodEnd ? ` · renews ${new Date(periodEnd).toLocaleDateString()}` : ""}`
                  : "No card on file"}
              </div>
              {subscribed ? (
                <ul className="mt-3.5 flex flex-col gap-1.5 text-[13px]">
                  {PLAN_FEATURES.team.slice(0, 3).map((f) => (
                    <li key={f} className="before:mr-1 before:font-mono before:text-brand before:content-['→']">{f}</li>
                  ))}
                  <li className="before:mr-1 before:font-mono before:text-brand before:content-['→']">{members.length} {members.length === 1 ? "seat" : "seats"} used</li>
                </ul>
              ) : (
                <div className="mt-4 flex flex-col gap-3">
                  <Usage label="Repositories" used={repos.length} limit={FREE_LIMITS.repos} />
                  <Usage label="Seats" used={members.length + invites.length} limit={FREE_LIMITS.seats} />
                  <div className="mt-1 text-[12.5px] text-muted">
                    <p>Team adds:</p>
                    <ul className="mt-1 flex flex-col gap-1">
                      {PLAN_FEATURES.team.slice(0, 3).map((f) => (
                        <li key={f} className="before:mr-1 before:font-mono before:text-brand before:content-['→']">{f}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              <div className="mt-5 flex justify-end">
                {!canInvite ? (
                  <span className="font-mono text-[11.5px] text-faint">Ask an admin to manage billing</span>
                ) : subscribed ? (
                  <form action={openPortal}><button type="submit" className={`${btn} border border-line bg-surface text-muted`}>Manage subscription</button></form>
                ) : (
                  <form action={startCheckout}><button type="submit" className={`${btn} bg-ink text-ground`}>Upgrade to Team, ${TEAM_PRICE_USD}/mo</button></form>
                )}
              </div>
            </Card>
          )}

          {tab === "integrations" && (
            <>
              <Card className="p-6">
                <GithubPanel />
              </Card>
              <Card className="p-6">
                <IngestTokens tokens={tokens} />
              </Card>
            </>
          )}
        </div>
      </div>
    </>
  );
}
