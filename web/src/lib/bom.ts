// Shared, dependency-free helpers for the Authorship Bill of Materials so the
// same canonicalization runs on the server (to sign) and in the browser (to
// verify). Keep this pure — no Node built-ins — so it bundles for the client.

// Stable, key-sorted stringify so the integrity digest is reproducible.
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") {
    const keys = Object.keys(v as Record<string, unknown>).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}

// SHA-256 hex via Web Crypto — available in browsers and modern Node.
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type VerifyResult =
  | { ok: true; digest: string; doc: Record<string, unknown> }
  | { ok: false; reason: string; expected?: string; actual?: string };

// Recompute the integrity digest of a parsed BOM and compare it to the one it
// carries. The digest signs everything except the integrity block itself.
export async function verifyBOM(parsed: unknown): Promise<VerifyResult> {
  if (!parsed || typeof parsed !== "object") return { ok: false, reason: "Not a JSON object." };
  const obj = parsed as Record<string, unknown>;
  const integrity = obj.integrity as { algorithm?: string; digest?: string } | undefined;
  if (!integrity?.digest) return { ok: false, reason: "No integrity digest found — is this a grain authorship report?" };
  if (integrity.algorithm && integrity.algorithm !== "sha256") {
    return { ok: false, reason: `Unsupported digest algorithm: ${integrity.algorithm}.` };
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { integrity: _omit, ...rest } = obj;
  const actual = await sha256Hex(canonical(rest));
  if (actual !== integrity.digest) {
    return { ok: false, reason: "Digest mismatch — this report was altered after it was generated.", expected: integrity.digest, actual };
  }
  return { ok: true, digest: actual, doc: rest };
}
