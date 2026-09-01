import { TopBar, Card } from "@/components/dashboard/ui";
import { getUserAndOrg, getIngestTokens } from "@/lib/data";
import { IngestTokens } from "@/components/dashboard/IngestTokens";
import { GithubPanel } from "@/components/dashboard/GithubPanel";
import { members } from "@/lib/mock";

const btn = "inline-flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13.5px] font-semibold";

export default async function Settings() {
  const { org } = await getUserAndOrg();
  const tokens = await getIngestTokens();
  const name = org?.name ?? "Workspace";
  const slug = org?.slug ?? "workspace";
  const plan = org?.plan ?? "team";

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
          <Card className="p-6">
            <h3 className="font-display text-base font-bold">Workspace</h3>
            <p className="mb-4 mt-1 text-[12.5px] text-muted">The name and URL your team sees.</p>
            <div className="mb-3.5 flex items-center gap-4">
              <label className="w-[150px] text-[13px] font-medium">Workspace name</label>
              <div className="flex h-[42px] flex-1 items-center rounded-[9px] border border-line bg-surface px-3 text-sm">{name}</div>
            </div>
            <div className="flex items-center gap-4">
              <label className="w-[150px] text-[13px] font-medium">URL</label>
              <div className="flex h-[42px] flex-1 items-center rounded-[9px] border border-line bg-surface px-3 text-sm">
                <span className="text-faint">grain.dev/</span>{slug}
              </div>
            </div>
            <div className="mt-4 flex justify-end"><span className={`${btn} bg-brand text-surface`}>Save changes</span></div>
          </Card>

          <Card className="p-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-base font-bold">Members</h3>
              <span className={`${btn} border border-line bg-surface text-muted`}>Invite people</span>
            </div>
            <table className="w-full border-collapse">
              <thead>
                <tr className="[&_th]:border-b [&_th]:border-line [&_th]:px-2 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-mono [&_th]:text-[10px] [&_th]:font-normal [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted">
                  <th>Person</th><th>Email</th><th>Role</th><th>Last active</th>
                </tr>
              </thead>
              <tbody className="[&_td]:border-b [&_td]:border-line/60 [&_td]:px-2 [&_td]:py-2.5 [&_td]:text-[13px] [&_tr:last-child_td]:border-none">
                {members.map((m) => (
                  <tr key={m.email}>
                    <td><span className="flex items-center gap-2.5"><span className="flex size-7 items-center justify-center rounded-lg bg-surface-2 text-[11px] font-semibold text-muted">{m.initials}</span>{m.name}</span></td>
                    <td className="text-muted">{m.email}</td>
                    <td><span className={`rounded-full px-2 py-0.5 font-mono text-[11px] ${m.role === "admin" ? "bg-human-soft text-human" : "bg-surface-2 text-muted"}`}>{m.role}</span></td>
                    <td className="text-faint">{m.active}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card className="p-6">
            <IngestTokens tokens={tokens} />
          </Card>

          <div className="grid grid-cols-1 gap-[18px] md:grid-cols-2">
            <Card className="flex flex-col p-6">
              <h3 className="font-display text-base font-bold">Plan</h3>
              <p className="mb-3 mt-1 text-[12.5px] text-muted">Free during early access.</p>
              <div className="font-display text-2xl font-extrabold capitalize tracking-tight">{plan}</div>
              <div className="mt-1 text-[13px] text-muted">$0 / seat · early access</div>
              <ul className="mt-3.5 flex flex-col gap-1.5 text-[13px]">
                <li className="before:mr-1 before:font-mono before:text-brand before:content-['→']">Unlimited repos</li>
                <li className="before:mr-1 before:font-mono before:text-brand before:content-['→']">Org dashboard &amp; policy</li>
                <li className="before:mr-1 before:font-mono before:text-brand before:content-['→']">{members.length} seats used</li>
              </ul>
              <div className="mt-4 flex justify-end"><span className={`${btn} border border-line bg-surface text-muted`}>Manage billing</span></div>
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
