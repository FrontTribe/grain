import Link from "next/link";
import { TopBar, Card, MiniBar, Spark, Pill } from "@/components/dashboard/ui";
import { repos } from "@/lib/mock";

export default function Repositories() {
  return (
    <>
      <TopBar
        title="Repositories"
        right={<span className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] text-muted">Search repos…</span>}
      />
      <div className="flex-1 overflow-y-auto p-7">
        <Card className="px-2 pb-1">
          <table className="w-full border-collapse">
            <thead>
              <tr className="[&_th]:border-b [&_th]:border-line [&_th]:bg-surface-2 [&_th]:px-3.5 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-mono [&_th]:text-[10.5px] [&_th]:font-normal [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted">
                <th className="rounded-tl-lg">Repository</th><th>Provenance mix</th><th>AI</th><th>30-day trend</th><th>Status</th><th className="rounded-tr-lg">Last scan</th>
              </tr>
            </thead>
            <tbody className="[&_td]:border-b [&_td]:border-line/60 [&_td]:px-3.5 [&_td]:py-2.5 [&_td]:text-[13px] [&_tr:last-child_td]:border-none">
              {repos.map((r) => (
                <tr key={r.name} className="hover:bg-surface-2">
                  <td className="font-medium">
                    <Link href={`/app/repos/${r.name}`} className="hover:text-brand">
                      {r.name} <span className="font-mono font-normal text-faint">acme/</span>
                    </Link>
                  </td>
                  <td><MiniBar human={r.human} ai={r.ai} /></td>
                  <td className="font-mono tabular-nums">{r.ai}%</td>
                  <td><Spark series={r.spark} up={r.status === "attention"} /></td>
                  <td><Pill tone={r.status === "attention" ? "attention" : "ok"}>{r.status}</Pill></td>
                  <td className="font-mono tabular-nums text-faint">{r.lastScan}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
