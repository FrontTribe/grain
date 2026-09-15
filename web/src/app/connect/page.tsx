import { getGithubConnection, getGithubReposChecked } from "@/lib/data";
import { connectGithub } from "@/app/auth/actions";
import { OnboardRepoPicker } from "@/components/dashboard/OnboardRepoPicker";
import { FlowShell, GitHubMark, primaryBtn } from "@/components/AuthShell";

export const metadata = { title: "Connect repositories" };

export default async function Connect() {
  const conn = await getGithubConnection();
  const listed = conn && !conn.invalid_at ? await getGithubReposChecked() : { repos: [], invalid: false };
  const repos = listed.repos;
  const rejected = Boolean(conn && (conn.invalid_at || listed.invalid));

  return (
    <FlowShell step={2}>
      <div className="border-b border-line px-6 pb-5 pt-6 sm:px-8">
        <h1 className="font-display text-[24px] font-bold tracking-tight">Connect your repositories</h1>
        <p className="mt-1.5 max-w-[60ch] text-[14px] text-muted">
          grain reads commit metadata and pull-request events to measure provenance. Source code stays on GitHub.
        </p>
      </div>

      {!conn || rejected ? (
        <div className="px-6 py-6 sm:px-8">
          <div className="flex flex-wrap items-center gap-4 rounded-[12px] border border-line bg-ground p-4">
            <span className="flex size-10 flex-none items-center justify-center rounded-[10px] bg-ink text-ground">
              <GitHubMark />
            </span>
            <div className="min-w-0 flex-1 text-[13.5px]">
              <div className="font-semibold">{rejected ? "Reconnect GitHub" : "Authorize GitHub"}</div>
              <div className="text-muted">
                {rejected
                  ? "GitHub no longer accepts the stored token. Authorize again to list your repositories."
                  : "Read access to your repositories, so grain can scan them. Revoke any time."}
              </div>
            </div>
            <form action={connectGithub}>
              <input type="hidden" name="next" value="/connect" />
              <button type="submit" className={`${primaryBtn} w-auto px-5`}>
                <GitHubMark /> {rejected ? "Reconnect GitHub" : "Connect GitHub"}
              </button>
            </form>
          </div>
          <dl className="mt-4 grid gap-1.5 rounded-[12px] border border-line bg-ground px-4 py-3.5 text-[12.5px]">
            <dt className="font-mono text-[11px] text-faint">What grain reads</dt>
            <dd><span className="font-semibold text-human">Read</span>: repository metadata, commits, authorship trailers, pull requests.</dd>
          </dl>
        </div>
      ) : (
        <OnboardRepoPicker repos={repos} login={conn.github_login} />
      )}
    </FlowShell>
  );
}
