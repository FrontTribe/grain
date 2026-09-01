import { Mark } from "@/components/Mark";
import { getGithubConnection, getGithubRepos } from "@/lib/data";
import { connectGithub } from "@/app/auth/actions";
import { OnboardRepoPicker } from "@/components/dashboard/OnboardRepoPicker";

const gitIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-[18px]">
    <circle cx="6" cy="6" r="2.4" /><circle cx="6" cy="18" r="2.4" /><circle cx="18" cy="9" r="2.4" />
    <path d="M6 8.4v7.2M8.2 6h5.6a2 2 0 0 1 2 2v.6" />
  </svg>
);

export default async function Connect() {
  const conn = await getGithubConnection();
  const repos = conn ? await getGithubRepos() : [];

  return (
    <div className="flex min-h-screen flex-col items-center bg-ground p-10 text-ink">
      <div className="flex w-[720px] items-center justify-between">
        <div className="flex items-center gap-2.5 font-display text-[19px] font-extrabold tracking-tight">
          <Mark size={24} /> grain
        </div>
        <div className="flex items-center gap-2 font-mono text-[11.5px] text-faint">
          <span className="size-2 rounded-full bg-[#57C6A8]" />
          <span className="size-2 rounded-full bg-brand" />
          <span className="size-2 rounded-full bg-line-strong" /> Step 2 of 3 — Connect
        </div>
      </div>

      <div className="mt-[18px] w-[720px] overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_18px_46px_rgba(32,29,25,0.08)]">
        <div className="border-b border-line px-[30px] pb-5 pt-[26px]">
          <h2 className="font-display text-2xl font-bold">Connect your repositories</h2>
          <p className="mt-2 max-w-[60ch] text-[14px] text-muted">
            Grain reads commit metadata and pull-request events to measure provenance. It never sends your source code to our servers.
          </p>
        </div>

        {!conn ? (
          <div className="px-[30px] py-[26px]">
            <div className="flex items-center gap-3.5 rounded-xl border border-line bg-surface-2 p-4">
              <span className="flex size-[42px] flex-none items-center justify-center rounded-xl bg-ink text-ground">{gitIcon}</span>
              <div className="text-[13.5px]">
                <div className="font-semibold">Authorize GitHub</div>
                <div className="text-muted">Grants read access to your repositories so Grain can scan them.</div>
              </div>
              <form action={connectGithub} className="ml-auto">
                <input type="hidden" name="next" value="/connect" />
                <button type="submit" className="flex h-11 items-center gap-2 rounded-[10px] bg-brand px-5 text-[14px] font-semibold text-white">
                  {gitIcon} Connect GitHub
                </button>
              </form>
            </div>
            <div className="mt-4 rounded-[10px] border border-line bg-surface-2 px-4 py-3.5 text-[12.5px] text-ink">
              <div className="font-mono text-[11px] uppercase tracking-wider text-muted">Permissions grain requests</div>
              <div className="mt-1.5"><span className="font-semibold text-human">Read</span> — repository metadata, commits, pull requests</div>
            </div>
          </div>
        ) : (
          <OnboardRepoPicker repos={repos} login={conn.github_login} />
        )}
      </div>
      <div className="mt-3.5 w-[720px] text-center text-[12px] text-faint">You can change repository access anytime in Settings.</div>
    </div>
  );
}
