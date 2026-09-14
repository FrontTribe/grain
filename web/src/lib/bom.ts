// Shared, dependency-free helpers for the Authorship Bill of Materials so the
// same canonicalization runs on the server (to sign) and in the browser (to
// verify). Keep this pure — no Node built-ins — so it bundles for the client.
// Format: docs/spec/provenance-v1.md.

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

export const KEYS_URL = "https://getgrain.dev/.well-known/grain-keys.json";
const BOM_DOMAIN = "grain/bom/v1";

export type SignatureCheck = {
  // valid: the Ed25519 signature verifies over the digest
  // invalid: it doesn't — the report was re-signed or tampered with
  // unsupported: this browser can't verify Ed25519 (the CLI can: grain verify --bom)
  status: "valid" | "invalid" | "unsupported";
  key_id: string;
  // whether getgrain.dev publishes that key (undefined = couldn't check)
  published?: boolean;
};

export type VerifyResult =
  | { ok: true; digest: string; doc: Record<string, unknown>; signature: SignatureCheck | null }
  | { ok: false; reason: string; expected?: string; actual?: string };

function b64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Verify the Ed25519 signature a BOM carries, and ask getgrain.dev whether the
// key is one it publishes. Never throws; degrades to "unsupported".
async function checkSignature(sig: Record<string, unknown>, digest: string): Promise<SignatureCheck> {
  const key_id = String(sig.key_id ?? "");
  const pub = String(sig.public_key ?? "");
  if (sig.algorithm !== "ed25519" || !pub.startsWith("ed25519:")) return { status: "invalid", key_id };
  let valid: boolean;
  try {
    const raw = b64(pub.slice("ed25519:".length));
    const key = await crypto.subtle.importKey("raw", raw, { name: "Ed25519" }, false, ["verify"]);
    const msg = new TextEncoder().encode(`${BOM_DOMAIN}\n${digest}`);
    valid = await crypto.subtle.verify({ name: "Ed25519" }, key, b64(String(sig.value ?? "")), msg);
  } catch {
    return { status: "unsupported", key_id };
  }
  if (!valid) return { status: "invalid", key_id };
  let published: boolean | undefined;
  try {
    const res = await fetch(KEYS_URL, { cache: "no-store" });
    if (res.ok) {
      const doc = (await res.json()) as { keys?: { key_id?: string }[] };
      published = (doc.keys ?? []).some((k) => k.key_id === key_id);
    }
  } catch {
    published = undefined;
  }
  return { status: "valid", key_id, published };
}

// Recompute the integrity digest of a parsed BOM and compare it to the one it
// carries, then check its signature when it has one. The digest covers
// everything except the integrity and signature blocks.
export async function verifyBOM(parsed: unknown): Promise<VerifyResult> {
  if (!parsed || typeof parsed !== "object") return { ok: false, reason: "Not a JSON object." };
  const obj = parsed as Record<string, unknown>;
  const integrity = obj.integrity as { algorithm?: string; digest?: string } | undefined;
  if (!integrity?.digest) return { ok: false, reason: "No integrity digest found — is this a grain authorship report?" };
  if (integrity.algorithm && integrity.algorithm !== "sha256") {
    return { ok: false, reason: `Unsupported digest algorithm: ${integrity.algorithm}.` };
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { integrity: _omit, signature: sig, ...rest } = obj;
  const actual = await sha256Hex(canonical(rest));
  if (actual !== integrity.digest) {
    return { ok: false, reason: "Digest mismatch — this report was altered after it was generated.", expected: integrity.digest, actual };
  }
  const signature = sig && typeof sig === "object" ? await checkSignature(sig as Record<string, unknown>, actual) : null;
  return { ok: true, digest: actual, doc: rest, signature };
}
