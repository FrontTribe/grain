// Provider-agnostic transactional email. Ships a Resend adapter and stays inert
// until RESEND_API_KEY is set, so callers can send best-effort everywhere and
// the app degrades gracefully (e.g. invites still show a copyable link).

export type EmailResult = { sent: boolean; reason?: string };

export async function sendEmail(opts: { to: string | string[]; subject: string; html: string }): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? "grain <notifications@getgrain.dev>";
  if (!key) return { sent: false, reason: "email not configured" };

  const to = Array.isArray(opts.to) ? opts.to.filter(Boolean) : [opts.to].filter(Boolean);
  if (to.length === 0) return { sent: false, reason: "no recipients" };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to, subject: opts.subject, html: opts.html }),
      cache: "no-store",
    });
    if (!res.ok) return { sent: false, reason: `email send failed (${res.status})` };
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: (e as Error).message };
  }
}

// Minimal branded HTML shell shared by every grain email.
export function emailShell(heading: string, bodyHtml: string, cta?: { label: string; href: string }): string {
  const button = cta
    ? `<a href="${cta.href}" style="display:inline-block;background:#1F6E5B;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 20px;border-radius:9px;margin-top:8px">${cta.label}</a>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#ECE9E1;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#201D19">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px">
    <div style="font-size:20px;font-weight:800;letter-spacing:-0.02em;margin-bottom:20px">grain</div>
    <div style="background:#FBFAF6;border:1px solid #DCD6C9;border-radius:16px;padding:28px">
      <h1 style="font-size:19px;font-weight:800;margin:0 0 12px">${heading}</h1>
      <div style="font-size:14px;line-height:1.6;color:#4a453d">${bodyHtml}</div>
      ${button}
    </div>
    <div style="font-size:11px;color:#948D80;margin-top:16px">grain — code provenance. Signals, not verdicts.</div>
  </div></body></html>`;
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
}

export function inviteEmail(workspace: string, link: string, inviter?: string): { subject: string; html: string } {
  const who = inviter ? `${esc(inviter)} invited you` : "You've been invited";
  return {
    subject: `Join ${workspace} on grain`,
    html: emailShell(
      `Join ${esc(workspace)} on grain`,
      `<p style="margin:0 0 12px">${who} to the <b>${esc(workspace)}</b> workspace on grain — a shared view of human vs AI authorship across your repositories.</p>
       <p style="margin:0 0 16px;color:#948D80;font-size:12.5px">If the button doesn't work, paste this link:<br><span style="word-break:break-all">${esc(link)}</span></p>`,
      { label: "Accept invitation", href: link },
    ),
  };
}

export function attentionEmail(
  workspace: string,
  repo: string,
  ai: number,
  threshold: number,
  href: string,
): { subject: string; html: string } {
  return {
    subject: `${repo} is ${ai}% AI-assisted — over your ${threshold}% threshold`,
    html: emailShell(
      `${esc(repo)} crossed your AI threshold`,
      `<p style="margin:0 0 12px">A grain scan of <b>${esc(repo)}</b> in <b>${esc(workspace)}</b> puts it at <b>${ai}% AI-assisted</b>, above your policy threshold of ${threshold}%.</p>
       <p style="margin:0 0 16px;color:#948D80;font-size:12.5px">A signal, not a verdict — inferred provenance is a capped estimate. Open the repo to see the attested / declared / inferred breakdown.</p>`,
      { label: "View the repository", href },
    ),
  };
}

export function riskEmail(
  workspace: string,
  repo: string,
  lines: number,
  hotspots: { sha: string; subject: string; path: string; ai_lines: number }[],
  href: string,
): { subject: string; html: string } {
  const paths = [...new Set(hotspots.map((h) => h.path))];
  const items = hotspots
    .slice(0, 5)
    .map((h) => `<li><code>${esc(h.sha.slice(0, 7))}</code> ${esc(h.subject)} — <code>${esc(h.path)}</code>, ${h.ai_lines} lines</li>`)
    .join("");
  return {
    subject: `${repo}: ${lines} unreviewed AI-written lines landed in ${paths.join(", ")}`,
    html: emailShell(
      `Unreviewed AI code in a critical path`,
      `<p style="margin:0 0 12px">A push to <b>${esc(repo)}</b> in <b>${esc(workspace)}</b> put <b>${lines} AI-written lines</b> into ${paths.map((p) => `<code>${esc(p)}</code>`).join(", ")} with no review evidence — no pull request, no reviewer trailer, applied by the author.</p>
       <ul style="margin:0 0 14px;padding-left:18px;font-size:13px">${items}</ul>
       <p style="margin:0 0 16px;color:#948D80;font-size:12.5px">A place to look, not a verdict. Open the repo to see every critical path and the full hotspot list.</p>`,
      { label: "Review the hotspots", href },
    ),
  };
}

export type SecurityAlertFinding = { sha: string; subject: string; path: string; title: string; severity: string; excerpt: string };
export type SecurityAlertDep = { sha: string; name: string; ecosystem: string; url: string; ai: boolean; exists: boolean; age_days: number; reason?: string };

// One email per push: the AI-written security findings and the dependencies
// the registry does not know (or that are young and AI-added). Either list may
// be empty; the caller only sends when at least one is not.
export function securityEmail(
  workspace: string,
  repo: string,
  findings: SecurityAlertFinding[],
  deps: SecurityAlertDep[],
  href: string,
): { subject: string; html: string } {
  const missing = deps.filter((d) => !d.exists);
  const suspect = deps.filter((d) => d.reason);
  const parts: string[] = [];
  if (findings.length) parts.push(`${findings.length} AI-written security ${findings.length === 1 ? "finding" : "findings"}`);
  if (suspect.length) parts.push(`${suspect.length} package ${suspect.length === 1 ? "name that looks" : "names that look"} typosquatted or invented`);
  else if (missing.length) parts.push(`${missing.length} ${missing.length === 1 ? "package" : "packages"} not on the registry`);
  else if (deps.length) parts.push(`${deps.length} young AI-added ${deps.length === 1 ? "package" : "packages"}`);
  const subject = `${repo}: ${parts.join(", ")}`;

  const fItems = findings
    .slice(0, 6)
    .map((f) => `<li><code>${esc(f.sha.slice(0, 7))}</code> <code>${esc(f.path)}</code> — ${esc(f.title)} (${esc(f.severity)})${f.excerpt ? `<br><code style="color:#948D80">${esc(f.excerpt)}</code>` : ""}</li>`)
    .join("");
  const dItems = deps
    .slice(0, 6)
    .map((d) => {
      const reg = !d.exists ? "<b>not found</b>" : `${d.age_days} days old`;
      const why = d.reason ? `, <b>${esc(d.reason)}</b>` : "";
      return `<li><code>${esc(d.sha.slice(0, 7))}</code> <a href="${esc(d.url)}"><code>${esc(d.name)}</code></a> <span style="color:#948D80">${esc(d.ecosystem)}</span> — ${reg}${why}, added by ${d.ai ? "an AI-written line" : "a human"}</li>`;
    })
    .join("");

  const body =
    `<p style="margin:0 0 12px">A push to <b>${esc(repo)}</b> in <b>${esc(workspace)}</b> landed lines worth a second look before they spread.</p>` +
    (findings.length ? `<p style="margin:0 0 6px;font-weight:600">Security patterns in AI-written lines</p><ul style="margin:0 0 14px;padding-left:18px;font-size:13px">${fItems}</ul>` : "") +
    (deps.length ? `<p style="margin:0 0 6px;font-weight:600">Dependencies</p><ul style="margin:0 0 14px;padding-left:18px;font-size:13px">${dItems}</ul>` : "") +
    `<p style="margin:0 0 16px;color:#948D80;font-size:12.5px">Pattern matches and registry answers joined with provenance, not confirmed vulnerabilities. A name the registry does not know is the slopsquatting seed: look before someone registers it.</p>`;
  return { subject, html: emailShell("Security signals in a push", body, { label: "Review the findings", href }) };
}
