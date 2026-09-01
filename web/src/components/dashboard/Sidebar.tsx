"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mark } from "@/components/Mark";

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
        active ? "bg-[#242c26] text-[#7FD8BE] [&_svg]:text-[#57C6A8]" : "text-[#A69E8D] hover:text-[#ECE6D8]"
      }`}
    >
      {item.icon} {item.label}
    </Link>
  );
}

export function Sidebar() {
  const path = usePathname();
  const isActive = (href: string) => (href === "/app" ? path === "/app" : path.startsWith(href));

  return (
    <aside className="flex w-[244px] flex-none flex-col bg-[#1A1712] p-4 text-[#C9C2B3]">
      <div className="flex items-center gap-2.5 px-2 pb-1">
        <Mark size={26} />
        <span className="font-display text-xl font-extrabold tracking-tight text-[#F1ECE0]">grain</span>
        <span className="rounded border border-[#35301f] px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-[#8A8272]">cloud</span>
      </div>

      <div className="my-5 flex items-center gap-2.5 rounded-[10px] border border-[#322c1f] bg-[#241F17] px-3 py-2.5 text-[13px]">
        <span className="size-[22px] flex-none rounded-md bg-gradient-to-br from-[#57C6A8] to-[#E28A50]" />
        <span className="font-semibold text-[#ECE6D8]">Acme Corp</span>
        <span className="ml-auto text-[#6E6656]">▾</span>
      </div>

      <nav className="flex flex-col gap-0.5">
        {NAV.map((n) => link(n, isActive(n.href)))}
        <div className="px-3 pb-1.5 pt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-[#6A6252]">Workspace</div>
        {link(SETTINGS, isActive(SETTINGS.href))}
      </nav>

      <div className="mt-auto flex items-center gap-2.5 border-t border-[#2a2519] px-2 pt-2.5">
        <span className="flex size-[30px] flex-none items-center justify-center rounded-lg bg-[#3a3323] text-xs font-semibold">MG</span>
        <div>
          <div className="text-[13px] font-medium text-[#E4DDCD]">Maya G.</div>
          <div className="text-[11px] text-[#7C7462]">Team plan · 42 repos</div>
        </div>
      </div>
    </aside>
  );
}
