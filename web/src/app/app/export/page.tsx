import { TopBar } from "@/components/dashboard/ui";
import { PrintButton } from "@/components/dashboard/PrintButton";
import { buildAuthorshipBOM } from "@/lib/export";

const btn = "inline-flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13.5px] font-semibold";

export default async function ExportPage() {
  const bom = await buildAuthorshipBOM(new Date().toISOString());
  const s = bom.summary;

  return (
    <>
      <TopBar
        title="Authorship report"
        right={
          <>
            <a href="/api/export/authorship" className={`${btn} border border-line bg-surface text-muted no-print`}>Download JSON</a>
            <PrintButton className={`${btn} bg-brand text-surface no-print`} />
          </>
        }
      />
      <div className="flex-1 overflow-y-auto bg-ground p-7 print:p-0">
        <div id="bom" className="mx-auto max-w-[820px] rounded-2xl border border-line bg-surface p-10 print:border-0 print:shadow-none">
          <div className="mb-6 border-b border-line pb-5">
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">Authorship Bill of Materials</div>
            <h1 className="mt-1 font-display text-[26px] font-extrabold tracking-tight">{bom.workspace.name}</h1>
            <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[12px] text-muted">
              <span>generated {new Date(bom.generated_at).toISOString().replace("T", " ").slice(0, 16)} UTC</span>
              <span>engine {bom.engine.version}</span>
              <span>{bom.scope.repositories} {bom.scope.repositories === 1 ? "repository" : "repositories"}</span>
            </div>
          </div>

          <h2 className="mb-2 font-display text-[15px] font-bold">Workspace summary</h2>
          <div className="mb-1 flex h-4 gap-0.5 overflow-hidden rounded-md border border-line-strong">
            <span className="bg-human" style={{ width: `${s.human}%` }} />
            <span className="bg-ai" style={{ width: `${s.ai_assisted}%` }} />
            <span className="bg-line-strong" style={{ width: `${s.unclassified}%` }} />
          </div>
          <div className="mb-4 flex flex-wrap gap-4 font-mono text-[12px] text-muted">
            <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-human" />{s.human}% human</span>
            <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-ai" />{s.ai_assisted}% AI-assisted</span>
            <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-line-strong" />{s.unclassified}% unclassified</span>
          </div>
          <div className="mb-7 text-[12.5px] text-muted">
            Of the AI-assisted share — <b className="text-ink">{s.ai_by_basis.declared}% declared</b>,{" "}
            <b className="text-ink">{s.ai_by_basis.attested}% attested</b>,{" "}
            <b className="text-ink">{s.ai_by_basis.inferred}% inferred</b> (a capped estimate, not certain).
          </div>

          <h2 className="mb-2 font-display text-[15px] font-bold">By repository</h2>
          <table className="mb-7 w-full border-collapse">
            <thead>
              <tr className="[&_th]:border-b [&_th]:border-line [&_th]:px-2 [&_th]:py-2 [&_th]:text-left [&_th]:font-mono [&_th]:text-[10px] [&_th]:font-normal [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted">
                <th>Repository</th><th>Human</th><th>AI</th><th>Declared</th><th>Attested</th><th>Inferred</th><th>Last scan</th>
              </tr>
            </thead>
            <tbody className="[&_td]:border-b [&_td]:border-line/60 [&_td]:px-2 [&_td]:py-2 [&_td]:text-[12.5px] [&_td]:font-mono [&_td]:tabular-nums [&_tr:last-child_td]:border-none">
              {bom.repositories.map((r) => (
                <tr key={r.full_name ?? r.name}>
                  <td className="font-sans">{r.name} <span className="text-faint">{r.full_name?.split("/")[0] ?? ""}</span></td>
                  <td>{r.human}%</td>
                  <td>{r.ai_assisted}%</td>
                  <td>{r.ai_by_basis.declared}%</td>
                  <td>{r.ai_by_basis.attested}%</td>
                  <td>{r.ai_by_basis.inferred}%</td>
                  <td className="text-faint">{r.last_scan_at ? new Date(r.last_scan_at).toISOString().slice(0, 10) : "—"}</td>
                </tr>
              ))}
              {bom.repositories.length === 0 && (
                <tr><td colSpan={7} className="py-6 text-center font-sans text-[13px] text-faint">No repositories scanned yet.</td></tr>
              )}
            </tbody>
          </table>

          <h2 className="mb-1.5 font-display text-[15px] font-bold">Methodology</h2>
          <p className="mb-6 text-[12.5px] leading-relaxed text-muted">{bom.methodology}</p>

          <div className="rounded-[10px] border border-line bg-surface-2 p-4">
            <div className="font-mono text-[11px] uppercase tracking-wider text-muted">Integrity</div>
            <div className="mt-1 text-[12.5px] text-muted">
              {bom.integrity.algorithm}: <code className="break-all font-mono text-[11.5px] text-ink">{bom.integrity.digest}</code>
            </div>
            <div className="mt-1.5 text-[11.5px] text-faint">Hash of the canonical report — recompute it from the JSON to verify this document is unaltered.</div>
          </div>
        </div>
      </div>
    </>
  );
}
