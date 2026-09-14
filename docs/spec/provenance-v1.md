# grain provenance v1 — signed attestation format

**Status:** stable · **Spec id:** `grain/provenance/v1` · **Reference implementations:**
`internal/sign` (Go, stdlib only) and `web/src/lib/signing.ts` + `web/src/lib/bom.ts` (TypeScript, Node crypto / Web Crypto).

The goal is a provenance record that any tool can write, read and check
without grain: plain text in git notes, plain JSON for reports, one signature
scheme (Ed25519), no registries, no services in the loop. A record is either
verifiable offline or it makes no claim.

## 1. Attestation notes

An attestation is a git note on `refs/notes/grain` attached to a commit. It
is a set of `Key: value` lines. Keys are case-insensitive; unknown keys are
ignored; order is not significant except that `Signed-By` and `Signature`
come last.

```
Provenance: assisted
AI-Lines: 360/464
AI-Hashes: 0320d2bd7a,1c9e0f77b2,…
Signed-By: ed25519:gsnAw0076ceAPFu8U35z7QjoQYD8ZTrNksSjzdPF6B4=
Signature: Ki31g1pCmPPq9GZju…4ycxDA==
```

| Key | Value | Meaning |
|---|---|---|
| `Provenance` | `ai` · `assisted` · `human` | Who wrote the commit's added lines. `ai` = every substantive added line; `assisted` = some; `human` = none. |
| `AI-Lines` | `n/m` | Exactly `n` of the `m` substantive added lines were AI-written. Optional; without it an `ai`/`assisted` note covers the whole commit. |
| `AI-Hashes` | comma-separated | The AI-written lines, by line hash (§1.1). Optional; enables per-line attribution (`grain blame`) and rework tracking. |
| `Signed-By` | `ed25519:<base64 public key>` | The key that signed this note. |
| `Signature` | base64 | Ed25519 signature (§1.2). |

Legacy keys `AI-Authored`, `Human-Authored`, `AI-Assisted`, `Co-Authored-By`,
`Generated-By`, `Assisted-By` are still read as in `internal/signal`.

### 1.1 Line hash

`hash(line) = hex(sha256(trim(line)))[0:10]` where `trim` removes leading and
trailing whitespace. Lines whose trimmed length is ≤ 3 characters
(`}`, `)`, `end`) are *not substantive*: they are never hashed, counted or
attributed. Hashes are content-based, so attestations survive later edits
elsewhere in the file; a line that is rewritten gets a new hash and stops
matching, which is the intended answer.

### 1.2 Note signature

The signed message binds the note to **one commit**, so a valid note cannot be
copied onto another:

```
message  = "grain/note/v1" LF <full commit sha, 40 hex> LF <canonical note>
canonical note =
  lines of the note, in order, each with trailing spaces/tabs removed,
  the Signature line removed,
  trailing blank lines removed,
  joined with LF (no trailing LF)
```

`Signed-By` **is** part of the canonical note, so the claimed key is under the
signature. `Signature` is `base64(Ed25519.sign(sk, message))`.

Verification outcomes:

- **unsigned** — neither `Signed-By` nor `Signature` present. Read as a claim
  with no signer (pre-v1 notes).
- **valid** — the signature verifies for this commit with the key in `Signed-By`.
- **invalid** — a key is claimed but the signature does not verify: the note
  was altered, or moved from another commit. Readers MUST NOT treat an invalid
  note as an attestation. grain Cloud counts it and ignores its claim.

### 1.3 Keys and trust

Signers use a 32-byte Ed25519 seed, stored base64-encoded in
`~/.config/grain/signing.key` (0600) or `GRAIN_SIGNING_KEY`. `grain key`
creates and shows it. The public key travels inside every note, so
verification never needs a lookup. Identity is opt-in: a repo may list the
keys it trusts in `.grain/signers`:

```
# name  key
kresimir  ed25519:gsnAw0076ceAPFu8U35z7QjoQYD8ZTrNksSjzdPF6B4=
ci-bot    ed25519:…
```

`grain verify` reports valid signatures by keys outside that list as
*untrusted*; `grain verify --strict` fails on them and on unsigned notes.
Without the file, every valid signature is reported as valid and nothing is
called trusted — the spec never invents trust it wasn't given.

## 2. Authorship BOM

An Authorship Bill of Materials (`schema: "grain/authorship-bom/v1"`) is a
JSON document with an `integrity` block and, when the generator has a key, a
`signature` block:

```json
{
  "schema": "grain/authorship-bom/v1",
  "generated_at": "2026-09-14T21:30:00.000Z",
  "workspace": { "name": "FrontTribe", "slug": "fronttribe" },
  "summary": { "human": 62, "ai_assisted": 35, "unclassified": 3, "ai_by_basis": { "attested": 20, "declared": 10, "inferred": 5 } },
  "repositories": [ … ],
  "methodology": "…",
  "integrity": { "algorithm": "sha256", "digest": "3d2e…" },
  "signature": {
    "algorithm": "ed25519",
    "key_id": "336b33f8517eb53b",
    "public_key": "ed25519:gsnAw…6B4=",
    "signed_at": "2026-09-14T21:30:00.000Z",
    "value": "base64…"
  }
}
```

### 2.1 Digest

`digest = hex(sha256(canonical(doc without "integrity" and "signature")))`.

`canonical` is deterministic JSON: object keys sorted by code point, no
whitespace, strings escaped exactly as `JSON.stringify` does (only `"`, `\`,
and control characters; `<`, `>`, `&` and non-ASCII stay raw), numbers as
they appear in the document. The Go reference (`sign.Canonical`) and the
TypeScript reference (`canonical()`) produce identical bytes.

### 2.2 Signature

```
message = "grain/bom/v1" LF <digest>
value   = base64(Ed25519.sign(sk, message))
key_id  = hex(sha256(raw public key))[0:16]
```

The signature covers the digest, and the digest covers the content, so a
valid signature over a mismatched digest still means the content changed.
Verifiers check the digest first, then the signature.

### 2.3 Publisher keys

A publisher exposes the keys it signs with at
`https://<host>/.well-known/grain-keys.json`:

```json
{ "issuer": "getgrain.dev", "spec": "grain/provenance/v1",
  "keys": [ { "key_id": "336b33f8517eb53b", "algorithm": "ed25519", "public_key": "ed25519:…", "use": "authorship-bom" } ] }
```

Rotated keys stay listed so older reports keep verifying. A verifier that can
reach the host reports whether the report's `key_id` is published there;
one that can't (or is asked to stay offline) reports the signature as valid
but the publisher as unchecked. grain Cloud publishes at
`https://getgrain.dev/.well-known/grain-keys.json`.

## 3. Verifying

- `grain verify` — every note in a repo: valid / invalid / unsigned, trust
  per `.grain/signers`; exit 1 on any invalid note (`--strict`: also on
  unsigned or untrusted).
- `grain verify --bom report.json [--offline]` — digest, signature, publisher.
- `https://getgrain.dev/verify` — the same check in the browser (Web Crypto
  Ed25519; the page says so when a browser can't).

## 4. What a signature does and doesn't say

A valid note signature proves the note was written by the holder of that key
for that commit and has not changed since. It does not prove the key belongs
to a particular person (that is `.grain/signers`), and it does not prove the
claim is *true* — an attestation is a statement by a tool or a person, and
`grain attest` only claims what a hook actually captured. A valid BOM
signature proves grain Cloud generated the report from its data at that
time; the figures inside remain signals, not verdicts.
