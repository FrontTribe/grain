"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mark } from "@/components/Mark";
import { signout } from "@/app/auth/actions";
import { switchOrg } from "@/app/app/org-actions";

type Org = { org_id: string; name: string };

type NavItem = { href: string; label: string; icon: React.ReactNode };

const icon = (d: React.ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-[18px]">
    {d}
  </svg>
);

const NAV: NavItem[] = [
  { href: "/app", label: "Overview", icon: icon(<><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>) },
  { href: "/app/repos", label: "Repositories", icon: icon(<><circle cx="6" cy="6" r="2.4" /><circle cx="6" cy="18" r="2.4" /><circle cx="18" cy="9" r="2.4" /><path d="M6 8.4v7.2M8.2 6h5.6a2 2 0 0 1 2 2v.6" /></>) },
  { href: "/app/trends", label: "Trends", icon: icon(<><path d="M4 15l5-5 4 3 6-7" /><path d="M4 20h16" /></>) },
  { href: "/app/policy", label: "Policy", icon: icon(<path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />) },
  { href: "/app/activity", label: "Activity", icon: icon(<path d="M3 12h4l2 6 4-14 2 8h6" />) },
];

const SETTINGS: NavItem = {
  href: "/app/settings", label: "Settings",
  icon: icon(<><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L16.2 2h-4l-.4 2.6a7 7 0 0 0-2 1.2L7.5 4.9l-2 3.4 2 1.5A7 7 0 0 0 5 12" /></>),
};

function link(item: NavItem, active: boolean) {
  return (
    <Link
      key={item.href}
      href={item.href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] transition ${
        active ? "bg-human-soft text-human [&_svg]:text-human" : "text-muted hover:bg-surface-2 hover:text-ink"
      }`}
    >
      {item.icon} {item.label}
    </Link>
  );
}

export function Sidebar({ orgName, plan, userName, userEmail, orgs = [], activeOrgId }: { orgName: string; plan: string; userName: string; userEmail: string; orgs?: Org[]; activeOrgId?: string | null }) {
  const path = usePathname();
  const isActive = (href: string) => (href === "/app" ? path === "/app" : path.startsWith(href));
  const initials = userName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "U";

  return (
    <aside className="flex w-[244px] flex-none flex-col border-r border-line bg-surface p-4 text-ink">
      <div className="flex items-center gap-2.5 px-2 pb-1">
        <Mark size={26} />
        <span className="font-display text-xl font-extrabold tracking-tight text-ink">grain</span>
        <span className="rounded border border-line px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-faint">cloud</span>
      </div>

      {orgs.length > 1 ? (
        <details className="relative my-5">
          <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-[10px] border border-line bg-ground px-3 py-2.5 text-[13px] marker:hidden [&::-webkit-details-marker]:hidden">
            <span className="size-[22px] flex-none rounded-md bg-gradient-to-br from-human to-ai" />
            <span className="truncate font-semibold text-ink">{orgName}</span>
            <span className="ml-auto text-faint">▾</span>
          </summary>
          <div className="absolute left-0 right-0 z-20 mt-1 max-h-[300px] overflow-y-auto rounded-[10px] border border-line bg-ground p-1 shadow-[var(--shadow)]">
            {orgs.map((o) => (
              <form key={o.org_id} action={switchOrg}>
                <input type="hidden" name="org" value={o.org_id} />
                <button type="submit" className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12.5px] ${o.org_id === activeOrgId ? "text-human" : "text-ink hover:bg-surface-2"}`}>
                  <span className="size-4 flex-none rounded bg-gradient-to-br from-human to-ai" />
                  <span className="truncate">{o.name}</span>
                  {o.org_id === activeOrgId && <span className="ml-auto text-human">✓</span>}
                </button>
              </form>
            ))}
          </div>
        </details>
      ) : (
        <div className="my-5 flex items-center gap-2.5 rounded-[10px] border border-line bg-ground px-3 py-2.5 text-[13px]">
          <span className="size-[22px] flex-none rounded-md bg-gradient-to-br from-human to-ai" />
          <span className="truncate font-semibold text-ink">{orgName}</span>
        </div>
      )}

      <nav className="flex flex-col gap-0.5">
        {NAV.map((n) => link(n, isActive(n.href)))}
        <div className="px-3 pb-1.5 pt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">Workspace</div>
        {link(SETTINGS, isActive(SETTINGS.href))}
      </nav>

      <div className="mt-auto flex items-center gap-2.5 border-t border-line px-2 pt-2.5">
        <span title={userEmail} className="flex size-[30px] flex-none items-center justify-center rounded-lg bg-surface-2 text-xs font-semibold text-ink">{initials}</span>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium text-ink">{userName}</div>
          <div className="truncate text-[11px] capitalize text-muted">{plan} plan</div>
        </div>
        <form action={signout} className="ml-auto">
          <button type="submit" title="Sign out" className="flex size-7 items-center justify-center rounded-md text-muted hover:bg-human-soft hover:text-human">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-[16px]">
              <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" />
            </svg>
          </button>
        </form>
      </div>
    </aside>
  );
}
