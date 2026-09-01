import { getGithubConnection, getGithubRepos } from "@/lib/data";
import { connectGithub } from "@/app/auth/actions";
import { disconnectGithub } from "@/app/app/integrations/actions";
import { ConnectRepo } from "@/components/dashboard/ConnectRepo";
import { RepoPicker } from "@/components/dashboard/RepoPicker";

const gitIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-[18px]">
    <circle cx="6" cy="6" r="2.4" /><circle cx="6" cy="18" r="2.4" /><circle cx="18" cy="9" r="2.4" />
    <path d="M6 8.4v7.2M8.2 6h5.6a2 2 0 0 1 2 2v.6" />
  </svg>
);

// Server component: shows GitHub connection state, a private-repo picker when
// connected, and always the manual owner/repo field (public repos need no token).
export async function GithubPanel({ heading = true }: { heading?: boolean }) {
  const conn = await getGithubConnection();
  const repos = conn ? await getGithubRepos() : [];

  return (
    <div>
      {heading && <h3 className="font-display text-base font-bold">Connect a repository</h3>}

      {conn ? (
        <>
          <div className="mb-3.5 mt-1 flex items-center gap-2 text-[12.5px]">
            <span className="inline-flex items-center gap-1.5 font-mono text-human">
              <span className="size-2 rounded-full bg-human" /> GitHub connected
            </span>
            {conn.github_login && <span className="text-muted">as {conn.github_login}</span>}
            <form action={disconnectGithub} className="ml-auto">
              <button type="submit" className="rounded-[7px] px-2 py-1 font-mono text-[11.5px] text-ai hover:bg-ai-soft">
                disconnect
              </button>
            </form>
          </div>
          {repos.length > 0 ? (
            <RepoPicker repos={repos} />
          ) : (
            <div className="mb-3 rounded-[10px] border border-dashed border-line px-3.5 py-3 text-[12.5px] text-faint">
              No repositories returned from GitHub. Enter one manually below.
            </div>
          )}
          <div className="mt-4 border-t border-line pt-4">
            <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-faint">or by name</div>
            <ConnectRepo compact />
          </div>
        </>
      ) : (
        <>
          <p className="mb-3.5 mt-1 text-[12.5px] text-muted">
            Scan a public repo by name, or connect GitHub to pick from your private repositories.
          </p>
          <ConnectRepo compact />
          <div className="mt-4 border-t border-line pt-4">
            <form action={connectGithub}>
              <button
                type="submit"
                className="inline-flex h-[42px] items-center gap-2 rounded-[10px] bg-ink px-4 text-[13.5px] font-semibold text-ground"
              >
                {gitIcon} Connect GitHub for private repos
              </button>
            </form>
            <p className="mt-2 text-[11.5px] text-faint">Requests repo read access; the token is stored server-side only.</p>
          </div>
        </>
      )}
    </div>
  );
}
