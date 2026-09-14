// Package sign implements grain's provenance signatures (docs/spec/provenance-v1.md):
// Ed25519 signatures over attestation notes, bound to the commit they describe,
// and over Authorship BOM documents. Stdlib only, like the rest of the engine.
package sign

import (
	"bytes"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// Domain separators: a signature over a note can never be replayed as a BOM
// signature and vice versa, and a note signature is bound to one commit.
const (
	noteDomain = "grain/note/v1"
	bomDomain  = "grain/bom/v1"
	KeyPrefix  = "ed25519:"
)

// Key is a signing identity: a 32-byte Ed25519 seed on disk, nothing else.
type Key struct {
	Priv ed25519.PrivateKey
	Pub  ed25519.PublicKey
	Path string // "" when it came from GRAIN_SIGNING_KEY
}

// ID is the public key in its textual form: "ed25519:<base64>".
func (k Key) ID() string { return KeyID(k.Pub) }

// Fingerprint is a short, stable handle for a public key (16 hex of SHA-256).
func (k Key) Fingerprint() string { return Fingerprint(k.Pub) }

func KeyID(pub ed25519.PublicKey) string {
	return KeyPrefix + base64.StdEncoding.EncodeToString(pub)
}

func Fingerprint(pub ed25519.PublicKey) string {
	sum := sha256.Sum256(pub)
	return hex.EncodeToString(sum[:8])
}

// ParseKeyID turns "ed25519:<base64>" back into a public key.
func ParseKeyID(id string) (ed25519.PublicKey, error) {
	id = strings.TrimSpace(id)
	if !strings.HasPrefix(id, KeyPrefix) {
		return nil, fmt.Errorf("unsupported key %q (want ed25519:<base64>)", id)
	}
	raw, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(id, KeyPrefix))
	if err != nil || len(raw) != ed25519.PublicKeySize {
		return nil, fmt.Errorf("malformed ed25519 public key")
	}
	return ed25519.PublicKey(raw), nil
}

// DefaultKeyPath is ~/.config/grain/signing.key (XDG_CONFIG_HOME honoured).
func DefaultKeyPath() string {
	if p := os.Getenv("GRAIN_SIGNING_KEY_FILE"); p != "" {
		return p
	}
	base := os.Getenv("XDG_CONFIG_HOME")
	if base == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return ""
		}
		base = filepath.Join(home, ".config")
	}
	return filepath.Join(base, "grain", "signing.key")
}

func fromSeed(seed []byte, path string) (Key, error) {
	if len(seed) != ed25519.SeedSize {
		return Key{}, fmt.Errorf("signing key must be a %d-byte seed", ed25519.SeedSize)
	}
	priv := ed25519.NewKeyFromSeed(seed)
	return Key{Priv: priv, Pub: priv.Public().(ed25519.PublicKey), Path: path}, nil
}

// Load returns the signing key from GRAIN_SIGNING_KEY (base64 seed) or the key
// file. os.ErrNotExist when there is none.
func Load() (Key, error) {
	if env := os.Getenv("GRAIN_SIGNING_KEY"); env != "" {
		seed, err := base64.StdEncoding.DecodeString(strings.TrimSpace(env))
		if err != nil {
			return Key{}, fmt.Errorf("GRAIN_SIGNING_KEY: %v", err)
		}
		return fromSeed(seed, "")
	}
	path := DefaultKeyPath()
	if path == "" {
		return Key{}, os.ErrNotExist
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return Key{}, err
	}
	seed, err := base64.StdEncoding.DecodeString(strings.TrimSpace(string(data)))
	if err != nil {
		return Key{}, fmt.Errorf("%s: not a base64 seed", path)
	}
	return fromSeed(seed, path)
}

// LoadOrCreate loads the key, generating one on first use (0600).
func LoadOrCreate() (Key, bool, error) {
	k, err := Load()
	if err == nil {
		return k, false, nil
	}
	if !errors.Is(err, os.ErrNotExist) {
		return Key{}, false, err
	}
	path := DefaultKeyPath()
	if path == "" {
		return Key{}, false, errors.New("no home directory for the signing key")
	}
	seed := make([]byte, ed25519.SeedSize)
	if _, err := rand.Read(seed); err != nil {
		return Key{}, false, err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return Key{}, false, err
	}
	if err := os.WriteFile(path, []byte(base64.StdEncoding.EncodeToString(seed)+"\n"), 0o600); err != nil {
		return Key{}, false, err
	}
	k, err = fromSeed(seed, path)
	return k, true, err
}

// ---- notes ----

// CanonicalNote is the note body as signed: every line right-trimmed, the
// Signature line removed, trailing blank lines dropped, LF-joined. Signed-By
// stays in, so the claimed key is covered by the signature.
func CanonicalNote(body string) string {
	var out []string
	for _, raw := range strings.Split(strings.ReplaceAll(body, "\r\n", "\n"), "\n") {
		line := strings.TrimRight(raw, " \t")
		if k, _, ok := strings.Cut(line, ":"); ok && strings.EqualFold(strings.TrimSpace(k), "signature") {
			continue
		}
		out = append(out, line)
	}
	for len(out) > 0 && strings.TrimSpace(out[len(out)-1]) == "" {
		out = out[:len(out)-1]
	}
	return strings.Join(out, "\n")
}

func noteMessage(sha, canonical string) []byte {
	return []byte(noteDomain + "\n" + strings.TrimSpace(sha) + "\n" + canonical)
}

// SignNote appends Signed-By and Signature lines to a note body for commit sha.
func SignNote(k Key, sha, body string) string {
	body = CanonicalNote(body)
	// Replace any earlier Signed-By so re-signing doesn't stack claims.
	var kept []string
	for _, line := range strings.Split(body, "\n") {
		if key, _, ok := strings.Cut(line, ":"); ok && strings.EqualFold(strings.TrimSpace(key), "signed-by") {
			continue
		}
		kept = append(kept, line)
	}
	body = strings.Join(kept, "\n") + "\nSigned-By: " + k.ID()
	sig := ed25519.Sign(k.Priv, noteMessage(sha, body))
	return body + "\nSignature: " + base64.StdEncoding.EncodeToString(sig)
}

// Status of a note's signature.
type Status int

const (
	Unsigned Status = iota
	Valid
	Invalid
)

func (s Status) String() string {
	switch s {
	case Valid:
		return "valid"
	case Invalid:
		return "invalid"
	}
	return "unsigned"
}

// VerifyNote checks the signature on a note for commit sha. keyID is the
// Signed-By value when present (even when the signature is invalid).
func VerifyNote(sha, note string) (Status, string) {
	var keyID, sigB64 string
	for _, raw := range strings.Split(note, "\n") {
		k, v, ok := strings.Cut(strings.TrimSpace(raw), ":")
		if !ok {
			continue
		}
		switch strings.ToLower(strings.TrimSpace(k)) {
		case "signed-by":
			keyID = strings.TrimSpace(v)
		case "signature":
			sigB64 = strings.TrimSpace(v)
		}
	}
	if keyID == "" && sigB64 == "" {
		return Unsigned, ""
	}
	pub, err := ParseKeyID(keyID)
	if err != nil {
		return Invalid, keyID
	}
	sig, err := base64.StdEncoding.DecodeString(sigB64)
	if err != nil || len(sig) != ed25519.SignatureSize {
		return Invalid, keyID
	}
	if ed25519.Verify(pub, noteMessage(sha, CanonicalNote(note)), sig) {
		return Valid, keyID
	}
	return Invalid, keyID
}

// ---- trust ----

// LoadSigners reads .grain/signers ("name ed25519:<base64>" per line, # comments)
// into keyID → name. A missing file is an empty, not an error: trust is opt-in.
func LoadSigners(root string) map[string]string {
	out := map[string]string{}
	data, err := os.ReadFile(filepath.Join(root, ".grain", "signers"))
	if err != nil {
		return out
	}
	for _, raw := range strings.Split(string(data), "\n") {
		line := strings.TrimSpace(raw)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		fields := strings.Fields(line)
		key := fields[len(fields)-1]
		if !strings.HasPrefix(key, KeyPrefix) {
			continue
		}
		name := strings.TrimSpace(strings.TrimSuffix(line, key))
		if name == "" {
			name = "(unnamed)"
		}
		out[key] = name
	}
	return out
}

// ---- BOM ----

// BOMResult is what verifying an Authorship BOM yields.
type BOMResult struct {
	DigestOK   bool
	Digest     string // recomputed
	Claimed    string // integrity.digest
	Signed     bool
	SigOK      bool
	KeyID      string
	KeyIDShort string // key_id field (16 hex)
	Err        string
}

// bomMessage is what a BOM signature covers: the integrity digest, domain-separated.
func bomMessage(digest string) []byte { return []byte(bomDomain + "\n" + digest) }

// SignBOMDigest signs a BOM's integrity digest.
func SignBOMDigest(k Key, digest string) string {
	return base64.StdEncoding.EncodeToString(ed25519.Sign(k.Priv, bomMessage(digest)))
}

// VerifyBOM recomputes the digest of a BOM document and checks its signature.
// The digest covers everything except `integrity` and `signature`; the
// canonical form matches web/src/lib/bom.ts byte for byte.
func VerifyBOM(data []byte) BOMResult {
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.UseNumber()
	var v interface{}
	if err := dec.Decode(&v); err != nil {
		return BOMResult{Err: "not valid JSON"}
	}
	obj, ok := v.(map[string]interface{})
	if !ok {
		return BOMResult{Err: "not a JSON object"}
	}
	integ, _ := obj["integrity"].(map[string]interface{})
	claimed, _ := integ["digest"].(string)
	if claimed == "" {
		return BOMResult{Err: "no integrity digest — is this a grain authorship report?"}
	}
	if alg, _ := integ["algorithm"].(string); alg != "" && alg != "sha256" {
		return BOMResult{Err: "unsupported digest algorithm " + alg}
	}
	sigObj, _ := obj["signature"].(map[string]interface{})
	rest := map[string]interface{}{}
	for k, val := range obj {
		if k != "integrity" && k != "signature" {
			rest[k] = val
		}
	}
	sum := sha256.Sum256([]byte(Canonical(rest)))
	res := BOMResult{Digest: hex.EncodeToString(sum[:]), Claimed: claimed}
	res.DigestOK = res.Digest == claimed
	if sigObj == nil {
		return res
	}
	res.Signed = true
	pubStr, _ := sigObj["public_key"].(string)
	res.KeyID = pubStr
	res.KeyIDShort, _ = sigObj["key_id"].(string)
	if alg, _ := sigObj["algorithm"].(string); alg != "ed25519" {
		res.Err = "unsupported signature algorithm " + alg
		return res
	}
	pub, err := ParseKeyID(pubStr)
	if err != nil {
		res.Err = err.Error()
		return res
	}
	sig, err := base64.StdEncoding.DecodeString(strings.TrimSpace(fmt.Sprint(sigObj["value"])))
	if err != nil || len(sig) != ed25519.SignatureSize {
		res.Err = "malformed signature"
		return res
	}
	// The signature covers the claimed digest; a valid signature over a
	// digest that doesn't match the content still means the content changed.
	res.SigOK = ed25519.Verify(pub, bomMessage(claimed), sig)
	return res
}

// Canonical is the key-sorted, whitespace-free JSON used for BOM digests —
// identical to `canonical()` in web/src/lib/bom.ts (JSON.stringify semantics).
func Canonical(v interface{}) string {
	var b strings.Builder
	writeCanonical(&b, v)
	return b.String()
}

func writeCanonical(b *strings.Builder, v interface{}) {
	switch t := v.(type) {
	case nil:
		b.WriteString("null")
	case bool:
		if t {
			b.WriteString("true")
		} else {
			b.WriteString("false")
		}
	case json.Number:
		b.WriteString(t.String())
	case float64:
		b.WriteString(json.Number(fmt.Sprintf("%v", t)).String())
	case string:
		writeJSString(b, t)
	case []interface{}:
		b.WriteByte('[')
		for i, e := range t {
			if i > 0 {
				b.WriteByte(',')
			}
			writeCanonical(b, e)
		}
		b.WriteByte(']')
	case map[string]interface{}:
		keys := make([]string, 0, len(t))
		for k := range t {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		b.WriteByte('{')
		for i, k := range keys {
			if i > 0 {
				b.WriteByte(',')
			}
			writeJSString(b, k)
			b.WriteByte(':')
			writeCanonical(b, t[k])
		}
		b.WriteByte('}')
	default:
		enc, _ := json.Marshal(t)
		b.Write(enc)
	}
}

// writeJSString escapes exactly like JSON.stringify: quotes, backslashes and
// control characters only; everything else (including <, >, &, non-ASCII) raw.
func writeJSString(b *strings.Builder, s string) {
	b.WriteByte('"')
	for _, r := range s {
		switch r {
		case '"':
			b.WriteString(`\"`)
		case '\\':
			b.WriteString(`\\`)
		case '\b':
			b.WriteString(`\b`)
		case '\f':
			b.WriteString(`\f`)
		case '\n':
			b.WriteString(`\n`)
		case '\r':
			b.WriteString(`\r`)
		case '\t':
			b.WriteString(`\t`)
		default:
			if r < 0x20 {
				fmt.Fprintf(b, `\u%04x`, r)
			} else {
				b.WriteRune(r)
			}
		}
	}
	b.WriteByte('"')
}
