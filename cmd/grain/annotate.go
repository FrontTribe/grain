package main

import (
	"flag"
	"fmt"
	"strings"

	"github.com/FrontTribe/grain/internal/gitlog"
)

// cmdAnnotate records an attested provenance declaration on a commit as a git
// note (refs/notes/grain). grain reads these as authoritative — the "declared/
// attested" tier a human or tool can write directly into git.
func cmdAnnotate(args []string) error {
	fs := flag.NewFlagSet("annotate", flag.ExitOnError)
	dir := fs.String("C", ".", "run in this directory")
	ai := fs.Bool("ai", false, "attest AI-authored")
	human := fs.Bool("human", false, "attest human-authored")
	assisted := fs.Bool("assisted", false, "attest AI-assisted")
	extra := fs.String("note", "", "optional extra note text")

	// Allow the <sha> before the flags (stdlib flag stops at the first positional).
	var sha string
	parseArgs := args
	if len(args) > 0 && !strings.HasPrefix(args[0], "-") {
		sha, parseArgs = args[0], args[1:]
	}
	fs.Parse(parseArgs)
	if sha == "" {
		sha = fs.Arg(0)
	}
	if sha == "" {
		return fmt.Errorf("usage: grain annotate <sha> --ai|--human|--assisted")
	}

	var prov string
	switch {
	case *ai:
		prov = "ai"
	case *assisted:
		prov = "assisted"
	case *human:
		prov = "human"
	default:
		return fmt.Errorf("choose one: --ai, --human, or --assisted")
	}

	root, err := gitlog.Toplevel(*dir)
	if err != nil {
		return fmt.Errorf("not a git repository (%s)", *dir)
	}
	body := "Provenance: " + prov
	if *extra != "" {
		body += "\n" + *extra
	}
	if err := gitlog.AddNote(root, gitlog.NotesRef, sha, body); err != nil {
		return err
	}

	short := sha
	if len(short) > 7 {
		short = short[:7]
	}
	fmt.Printf("annotated %s → Provenance: %s  (note on %s)\n", short, prov, gitlog.NotesRef)
	fmt.Println("  push it with: git push origin " + gitlog.NotesRef)
	return nil
}
