// Server-side half of grain's provenance signatures (docs/spec/provenance-v1.md).
// Ed25519 via Node's crypto; the key is a 32-byte seed in GRAIN_SIGNING_KEY,
// the same format the CLI uses, so the two sides can verify each other.
import { createHash, createPrivateKey, createPublicKey, sign, verify, type KeyObject } from "crypto";

const NOTE_DOMAIN = "grain/note/v1";
const BOM_DOMAIN = "grain/bom/v1";
export const KEY_PREFIX = "ed25519:";

// DER prefixes that wrap a raw Ed25519 key into PKCS#8 / SPKI.
const PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
const SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

export type SigningKey = { priv: KeyObject; pub: Buffer; id: string; keyId: string };

// key_id: the first 16 hex characters of SHA-256 over the raw public key —
// the same as the CLI's fingerprint.
export function keyIdOf(pub: Buffer): string {
  return createHash("sha256").update(pub).digest("hex").slice(0, 16);
}

export function loadSigningKey(): SigningKey | null {
  const env = process.env.GRAIN_SIGNING_KEY?.trim();
  if (!env) return null;
  const seed = Buffer.from(env, "base64");
  if (seed.length !== 32) return null;
  const priv = createPrivateKey({ key: Buffer.concat([PKCS8_PREFIX, seed]), format: "der", type: "pkcs8" });
  const pub = Buffer.from(createPublicKey(priv).export({ format: "der", type: "spki" })).subarray(-32);
  return { priv, pub, id: KEY_PREFIX + pub.toString("base64"), keyId: keyIdOf(pub) };
}

export function publicKeyObject(id: string): KeyObject | null {
  if (!id.startsWith(KEY_PREFIX)) return null;
  const raw = Buffer.from(id.slice(KEY_PREFIX.length), "base64");
  if (raw.length !== 32) return null;
  try {
    return createPublicKey({ key: Buffer.concat([SPKI_PREFIX, raw]), format: "der", type: "spki" });
  } catch {
    return null;
  }
}

// ---- BOM ----

export type BomSignature = {
  algorithm: "ed25519";
  key_id: string;
  public_key: string;
  signed_at: string;
  value: string;
};

// A BOM signature covers the integrity digest, domain-separated.
export function signBomDigest(k: SigningKey, digest: string, signedAt: string): BomSignature {
  const value = sign(null, Buffer.from(`${BOM_DOMAIN}\n${digest}`), k.priv).toString("base64");
  return { algorithm: "ed25519", key_id: k.keyId, public_key: k.id, signed_at: signedAt, value };
}

// ---- notes ----

// Canonical note body, exactly as internal/sign: right-trimmed lines, the
// Signature line removed, trailing blank lines dropped, LF-joined.
export function canonicalNote(body: string): string {
  const out: string[] = [];
  for (const raw of body.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.replace(/[ \t]+$/, "");
    const idx = line.indexOf(":");
    if (idx >= 0 && line.slice(0, idx).trim().toLowerCase() === "signature") continue;
    out.push(line);
  }
  while (out.length && out[out.length - 1].trim() === "") out.pop();
  return out.join("\n");
}

export type NoteSignature = "unsigned" | "valid" | "invalid";

// Verify a note's signature for the commit it is attached to.
export function verifyNoteSignature(sha: string, note: string): { status: NoteSignature; keyId: string } {
  let keyId = "";
  let sigB64 = "";
  for (const raw of note.split("\n")) {
    const line = raw.trim();
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const k = line.slice(0, idx).trim().toLowerCase();
    const v = line.slice(idx + 1).trim();
    if (k === "signed-by") keyId = v;
    else if (k === "signature") sigB64 = v;
  }
  if (!keyId && !sigB64) return { status: "unsigned", keyId: "" };
  const pub = publicKeyObject(keyId);
  const sig = Buffer.from(sigB64, "base64");
  if (!pub || sig.length !== 64) return { status: "invalid", keyId };
  const msg = Buffer.from(`${NOTE_DOMAIN}\n${sha.trim()}\n${canonicalNote(note)}`);
  try {
    return { status: verify(null, msg, pub, sig) ? "valid" : "invalid", keyId };
  } catch {
    return { status: "invalid", keyId };
  }
}
