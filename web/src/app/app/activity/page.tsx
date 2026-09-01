import { TopBar, Card } from "@/components/dashboard/ui";
import { getEvents, ago, num, type EventRow } from "@/lib/data";

const chip = "inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[12.5px] text-muted";

function RichText({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return <>{parts.map((p, i) => (i % 2 === 1 ? <b key={i} className="font-semibold">{p}</b> : <span key={i}>{p}</span>))}</>;
}

const icons: Record<string, React.ReactNode> = {
  attention: <path d="M12 9v4M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />,
  scan: <><path d="M4 15l5-5 4 3 6-7" /><path d="M4 20h16" /></>,
  policy: <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />,
  repo: <><circle cx="6" cy="6" r="2.4" /><circle cx="6" cy="18" r="2.4" /><circle cx="18" cy="9" r="2.4" /><path d="M6 8.4v7.2M8.2 6h5.6a2 2 0 0 1 2 2v.6" /></>,
};
const tone: Record<string, string> = {
  attention: "bg-ai-soft text-ai", scan: "bg-human-soft text-human", policy: "bg-surface-2 text-muted", repo: "bg-[#E7EEF4] text-[#3B6EA5]",
};

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function Activity() {
  const events = await getEvents();
  const groups: { label: string; events: EventRow[] }[] = [];
  for (const e of events) {
    const label = dayLabel(e.created_at);
    const g = groups.find((x) => x.label === label);
    if (g) g.events.push(e);
    else groups.push({ label, events: [e] });
  }

  return (
    <>
      <TopBar
        title="Activity"
        right={
          <div className="flex items-center gap-2.5">
            <span className="rounded-full bg-ink px-3 py-1.5 text-[12.5px] text-ground">All</span>
            <span className={chip}>Attention</span>
            <span className={chip}>Scans</span>
            <span className={chip}>Policy</span>
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto p-7">
        <Card className="p-2">
          {groups.map((day) => (
            <div key={day.label}>
              <div className="px-4 pb-2 pt-4 font-mono text-[11px] uppercase tracking-widest text-faint">{day.label}</div>
              {day.events.map((e) => (
                <div key={e.id} className="flex items-center gap-3.5 rounded-lg px-4 py-3 hover:bg-surface-2">
                  <span className={`flex size-8 flex-none items-center justify-center rounded-lg ${tone[e.kind] ?? tone.scan}`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-[17px]">
                      {icons[e.kind] ?? icons.scan}
                    </svg>
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13.5px]"><RichText text={e.title} /></div>
                    {e.subtitle && <div className="mt-0.5 text-[12px] text-faint">{e.subtitle}</div>}
                  </div>
                  {e.ai != null && (
                    <span className={`ml-auto font-mono text-[12.5px] font-semibold ${num(e.ai) >= 40 ? "text-ai" : "text-muted"}`}>{num(e.ai)}%</span>
                  )}
                  <span className={`${e.ai != null ? "" : "ml-auto"} w-16 text-right font-mono text-[11.5px] text-faint`}>{ago(e.created_at)} ago</span>
                </div>
              ))}
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}
