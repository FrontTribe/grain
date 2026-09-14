package sign

import (
	"crypto/ed25519"
	"os"
	"strings"
	"testing"
)

func testKey(t *testing.T) Key {
	t.Helper()
	seed := make([]byte, ed25519.SeedSize)
	for i := range seed {
		seed[i] = byte(i)
	}
	k, err := fromSeed(seed, "")
	if err != nil {
		t.Fatal(err)
	}
	return k
}

func TestNoteSignRoundTrip(t *testing.T) {
	k := testKey(t)
	sha := strings.Repeat("a", 40)
	note := SignNote(k, sha, "Provenance: ai\nAI-Lines: 2/2\nAI-Hashes: 51d38cbb32,fdb281d1ac")

	if st, id := VerifyNote(sha, note); st != Valid || id != k.ID() {
		t.Fatalf("want valid by %s, got %v by %s", k.ID(), st, id)
	}
	// Bound to the commit: the same note on another SHA fails.
	if st, _ := VerifyNote(strings.Repeat("b", 40), note); st != Invalid {
		t.Fatalf("moved note: want invalid, got %v", st)
	}
	// Any edit to a claim fails.
	if st, _ := VerifyNote(sha, strings.Replace(note, "Provenance: ai", "Provenance: human", 1)); st != Invalid {
		t.Fatalf("tampered note: want invalid, got %v", st)
	}
	// Whitespace and line endings don't matter; the claims do.
	if st, _ := VerifyNote(sha, strings.ReplaceAll(note, "\n", "  \r\n")+"\n\n"); st != Valid {
		t.Fatalf("reformatted note: want valid, got %v", st)
	}
	if st, _ := VerifyNote(sha, "Provenance: ai"); st != Unsigned {
		t.Fatalf("plain note: want unsigned, got %v", st)
	}
	// Re-signing replaces the claim instead of stacking Signed-By lines.
	again := SignNote(k, sha, note)
	if strings.Count(again, "Signed-By:") != 1 || strings.Count(again, "Signature:") != 1 {
		t.Fatalf("re-signed note stacks headers:\n%s", again)
	}
}

func TestCanonicalMatchesJSONStringify(t *testing.T) {
	// Sorted keys, no whitespace, JS escaping: <>& and non-ASCII raw, controls escaped.
	doc := map[string]interface{}{
		"z": []interface{}{true, nil, "a<b>&c"},
		"a": map[string]interface{}{"š": "Galić's\tx\n", "n": 1},
	}
	// Raw string: the tab and newline appear as the two-character escapes.
	want := `{"a":{"n":1,"š":"Galić's\tx\n"},"z":[true,null,"a<b>&c"]}`
	if got := Canonical(doc); got != want {
		t.Fatalf("canonical mismatch:\n got %s\nwant %s", got, want)
	}
}

// The reference BOM was generated and signed by grain Cloud (TypeScript). Its
// digest and signature verifying here proves the two canonical forms agree.
func TestVerifyCloudSignedBOM(t *testing.T) {
	data, err := os.ReadFile("testdata/bom-signed.json")
	if err != nil {
		t.Fatal(err)
	}
	r := VerifyBOM(data)
	if r.Err != "" || !r.DigestOK || !r.Signed || !r.SigOK {
		t.Fatalf("cloud BOM should verify: %+v", r)
	}
	if r.KeyIDShort != "33907b75a6a4824c" {
		t.Fatalf("key id: %s", r.KeyIDShort)
	}
	tampered := strings.Replace(string(data), `"ai_assisted": 63`, `"ai_assisted": 36`, 1)
	if rt := VerifyBOM([]byte(tampered)); rt.DigestOK || !rt.SigOK {
		t.Fatalf("tampered BOM: digest must fail (signature over the old digest still verifies): %+v", rt)
	}
}
