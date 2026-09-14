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
