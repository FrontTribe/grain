import { TopBar, Card } from "@/components/dashboard/ui";
import { activityDays } from "@/lib/mock";

const chip = "inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[12.5px] text-muted";

// Render a string with **bold** spans.
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
  attention: "bg-ai-soft text-ai",
  scan: "bg-human-soft text-human",
  policy: "bg-surface-2 text-muted",
  repo: "bg-[#E7EEF4] text-[#3B6EA5]",
};

export default function Activity() {
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
          {activityDays.map((day) => (
            <div key={day.label}>
              <div className="px-4 pb-2 pt-4 font-mono text-[11px] uppercase tracking-widest text-faint">{day.label}</div>
              {day.events.map((e, i) => (
                <div key={i} className="flex items-center gap-3.5 rounded-lg px-4 py-3 hover:bg-surface-2">
                  <span className={`flex size-8 flex-none items-center justify-center rounded-lg ${tone[e.kind]}`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-[17px]">
                      {icons[e.kind]}
                    </svg>
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13.5px]"><RichText text={e.text} /></div>
                    <div className="mt-0.5 text-[12px] text-faint">{e.sub}</div>
                  </div>
                  {"ai" in e && e.ai != null && (
                    <span className={`ml-auto font-mono text-[12.5px] font-semibold ${e.ai >= 40 ? "text-ai" : "text-muted"}`}>{e.ai}%</span>
                  )}
                  <span className={`${"ai" in e && e.ai != null ? "" : "ml-auto"} w-16 text-right font-mono text-[11.5px] text-faint`}>{e.ago}</span>
                </div>
              ))}
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}
