package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/FrontTribe/grain/internal/gitlog"
	"github.com/FrontTribe/grain/internal/sign"
)

// grain key — show (or create) the signing identity attestations are signed with.
func cmdKey(args []string) error {
	fs := flag.NewFlagSet("key", flag.ExitOnError)
	fs.Parse(args)

	k, created, err := sign.LoadOrCreate()
	if err != nil {
		return err
	}
	if created {
		fmt.Printf("✓ generated a new signing key at %s\n\n", k.Path)
	}
	fmt.Printf("public key   %s\n", k.ID())
	fmt.Printf("fingerprint  %s\n", k.Fingerprint())
	if k.Path != "" {
		fmt.Printf("private key  %s (keep it; never commit it)\n", k.Path)
	} else {
		fmt.Println("private key  from GRAIN_SIGNING_KEY")
	}
	fmt.Println("\nTo let teammates and CI trust your attestations, add this line to .grain/signers:")
	name := os.Getenv("USER")
	if name == "" {
		name = "you"
	}
	fmt.Printf("  %s %s\n", name, k.ID())
	return nil
}

// grain verify — check attestation signatures in a repo, or a BOM file.
func cmdVerify(args []string) error {
	fs := flag.NewFlagSet("verify", flag.ExitOnError)
	dir := fs.String("C", ".", "run in this directory")
	max := fs.Int("max", 2000, "commits to examine")
	strict := fs.Bool("strict", false, "fail on unsigned notes, and on untrusted keys when .grain/signers exists")
	bom := fs.String("bom", "", "verify an Authorship BOM JSON file instead of the repo")
	offline := fs.Bool("offline", false, "don't ask getgrain.dev whether the BOM key is published")
	fs.Parse(args)

	if *bom != "" {
		return verifyBOMFile(*bom, *offline)
	}

	root, err := gitlog.Toplevel(*dir)
	if err != nil {
		return fmt.Errorf("not a git repository (%s)", *dir)
	}
	commits, err := gitlog.ReadCommits(root, "", *max)
	if err != nil {
		return err
	}
	signers := sign.LoadSigners(root)

	var noted, valid, invalid, unsigned, untrusted int
	type bad struct{ sha, why string }
	var problems []bad
	for _, c := range commits {
		if strings.TrimSpace(c.Note) == "" {
			continue
		}
		noted++
		st, keyID := sign.VerifyNote(c.SHA, c.Note)
		switch st {
		case sign.Valid:
			valid++
			if len(signers) > 0 {
				if _, ok := signers[keyID]; !ok {
					untrusted++
					problems = append(problems, bad{c.SHA, "signed by a key not in .grain/signers (" + shortKey(keyID) + ")"})
				}
			}
		case sign.Invalid:
			invalid++
			problems = append(problems, bad{c.SHA, "signature does not verify — note altered or moved (" + shortKey(keyID) + ")"})
		default:
			unsigned++
			if *strict {
				problems = append(problems, bad{c.SHA, "unsigned attestation"})
			}
		}
	}

	fmt.Printf("grain verify — %d commits, %d attested\n", len(commits), noted)
	fmt.Printf("  signed, valid     %d\n", valid)
	if len(signers) > 0 {
		fmt.Printf("  of which trusted  %d  (.grain/signers: %d keys)\n", valid-untrusted, len(signers))
	}
	fmt.Printf("  signed, invalid   %d\n", invalid)
	fmt.Printf("  unsigned          %d\n", unsigned)
	for _, p := range problems {
		fmt.Printf("  ✗ %s  %s\n", p.sha[:7], p.why)
	}
	if invalid > 0 || (*strict && (unsigned > 0 || untrusted > 0)) {
		return policyExit(1)
	}
	if noted > 0 && len(problems) == 0 {
		fmt.Println("  ✓ every attestation checks out")
	}
	return nil
}

func shortKey(id string) string {
	if pub, err := sign.ParseKeyID(id); err == nil {
		return sign.Fingerprint(pub)
	}
	if len(id) > 20 {
		return id[:20] + "…"
	}
	return id
}

const keysURL = "https://getgrain.dev/.well-known/grain-keys.json"

func verifyBOMFile(path string, offline bool) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	r := sign.VerifyBOM(data)
	if r.Err != "" && !r.Signed {
		return fmt.Errorf("%s: %s", path, r.Err)
	}
	fmt.Printf("grain verify — %s\n", path)
	if r.DigestOK {
		fmt.Printf("  ✓ digest      sha256 %s — unaltered since it was generated\n", r.Digest[:16])
	} else {
		fmt.Printf("  ✗ digest      mismatch — the report was altered after it was generated\n      claimed %s\n      actual  %s\n", r.Claimed, r.Digest)
	}
	if !r.Signed {
		fmt.Println("  – signature   none (older report, or generated without a signing key)")
	} else if r.Err != "" {
		fmt.Printf("  ✗ signature   %s\n", r.Err)
	} else if r.SigOK {
		fmt.Printf("  ✓ signature   ed25519, key %s\n", r.KeyIDShort)
		if !offline {
			switch published(r.KeyIDShort) {
			case 1:
				fmt.Println("  ✓ publisher   key is published by getgrain.dev")
			case 0:
				fmt.Println("  ✗ publisher   key is NOT published by getgrain.dev")
			default:
				fmt.Println("  ? publisher   could not reach getgrain.dev (try --offline to skip)")
			}
		}
	} else {
		fmt.Printf("  ✗ signature   does not verify (key %s)\n", r.KeyIDShort)
	}
	if !r.DigestOK || (r.Signed && (!r.SigOK || r.Err != "")) {
		return policyExit(1)
	}
	return nil
}

// published asks getgrain.dev whether a BOM key id is one it publishes:
// 1 yes, 0 no, -1 unreachable.
func published(keyID string) int {
	client := &http.Client{Timeout: 5 * time.Second}
	res, err := client.Get(keysURL)
	if err != nil || res.StatusCode != 200 {
		return -1
	}
	defer res.Body.Close()
	var doc struct {
		Keys []struct {
			KeyID string `json:"key_id"`
		} `json:"keys"`
	}
	if json.NewDecoder(res.Body).Decode(&doc) != nil {
		return -1
	}
	for _, k := range doc.Keys {
		if k.KeyID == keyID {
			return 1
		}
	}
	return 0
}
