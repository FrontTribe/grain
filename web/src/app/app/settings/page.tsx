import { TopBar, Card } from "@/components/dashboard/ui";
import { getUserAndOrg, getIngestTokens, getOrgMembers, getInvites, getMyOrgs, getActiveOrgId } from "@/lib/data";
import { IngestTokens } from "@/components/dashboard/IngestTokens";
import { MembersCard } from "@/components/dashboard/MembersCard";
import { GithubPanel } from "@/components/dashboard/GithubPanel";
import { renameWorkspace } from "@/app/app/settings/general/actions";
import { startCheckout, openPortal } from "@/app/app/settings/billing/actions";

const btn = "inline-flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13.5px] font-semibold";

const BILLING_MSG: Record<string, { ok: boolean; text: string }> = {
  success: { ok: true, text: "Subscription active — welcome to Team." },
  cancelled: { ok: false, text: "Checkout cancelled." },
  error: { ok: false, text: "Something went wrong with billing. Try again." },
  unconfigured: { ok: false, text: "Billing isn't configured yet." },
};

export default async function Settings({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string; billing?: string }> }) {
  const { saved, error, billing } = await searchParams;
  const [{ org }, tokens, members, invites, myOrgs, activeId] = await Promise.all([
    getUserAndOrg(), getIngestTokens(), getOrgMembers(), getInvites(), getMyOrgs(), getActiveOrgId(),
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
        {["General", "Members", "Billing", "Integrations"].map((t, i) => (
          <span key={t} className={`border-b-2 py-3.5 text-sm ${i === 0 ? "border-brand font-medium text-ink" : "border-transparent text-muted"}`}>{t}</span>
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
                  <span className="text-faint">grain.dev/</span>{slug}
                </div>
              </div>
              <div className="mt-4 flex justify-end"><button type="submit" className={`${btn} bg-brand text-surface`}>Save changes</button></div>
            </form>
          </Card>

          <Card className="p-6">
            <MembersCard members={members} invites={invites} canInvite={canInvite} />
          </Card>

          <Card className="p-6">
            <IngestTokens tokens={tokens} />
          </Card>

          <div className="grid grid-cols-1 gap-[18px] md:grid-cols-2">
            <Card className="flex flex-col p-6">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-bold">Plan</h3>
                {subscribed && <span className="rounded-full bg-human-soft px-2 py-0.5 font-mono text-[10.5px] text-human">{subStatus}</span>}
              </div>
              <div className="mt-2 font-display text-2xl font-extrabold capitalize tracking-tight">{subscribed ? "Team" : plan}</div>
              <div className="mt-1 text-[13px] text-muted">
                {subscribed
                  ? `$20 / month${periodEnd ? ` · renews ${new Date(periodEnd).toLocaleDateString()}` : ""}`
                  : "Free during early access"}
              </div>
              <ul className="mt-3.5 flex flex-col gap-1.5 text-[13px]">
                <li className="before:mr-1 before:font-mono before:text-brand before:content-['→']">Unlimited repos</li>
                <li className="before:mr-1 before:font-mono before:text-brand before:content-['→']">Org dashboard &amp; policy</li>
                <li className="before:mr-1 before:font-mono before:text-brand before:content-['→']">{members.length} {members.length === 1 ? "seat" : "seats"} used</li>
              </ul>
              <div className="mt-auto flex justify-end pt-4">
                {!canInvite ? (
                  <span className="font-mono text-[11.5px] text-faint">Ask an admin to manage billing</span>
                ) : subscribed ? (
                  <form action={openPortal}><button type="submit" className={`${btn} border border-line bg-surface text-muted`}>Manage subscription</button></form>
                ) : (
                  <form action={startCheckout}><button type="submit" className={`${btn} bg-brand text-surface`}>Upgrade to Team — $20/mo</button></form>
                )}
              </div>
            </Card>

            <Card className="p-6">
              <GithubPanel />
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
