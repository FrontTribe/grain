package main

import (
	"bufio"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/FrontTribe/grain/internal/gitlog"
	"github.com/FrontTribe/grain/internal/outcomes"
	"github.com/FrontTribe/grain/internal/sign"
	"github.com/FrontTribe/grain/internal/signal"
)

// Capture-at-source provenance. Instead of guessing after the fact, record the
// truth when AI writes code:
//
//   grain hook claude   ← Claude Code PostToolUse hook: logs the lines AI just
//                         wrote (as content hashes) to .grain/ai-edits.jsonl
//   grain attest        ← post-commit: matches HEAD's added lines against that
//                         ledger and writes an attested note with the exact AI
//                         lines (line-level, shift-proof via content hashes)
//   grain blame <file>  ← git blame for AI: which lines are attested AI
//
// This turns the weakest tier (inferred, capped) into the strongest (attested)
// automatically, with zero effort from the developer.

const ledgerFile = ".grain/ai-edits.jsonl"

// lineHash is a short, content-based identity for a line — shift-proof, so an
// attestation survives later edits elsewhere in the file. Trivial lines
// ("}", ")") are skipped by callers: they'd collide across authors and carry no
// signal, matching internal/features' convention.
// One definition, shared with blame and outcome tracking, so hashes never drift.
func lineHash(line string) string { return outcomes.LineHash(line) }

func substantive(line string) bool { return outcomes.Substantive(line) }

type ledgerEntry struct {
	File   string   `json:"file"`
	Hashes []string `json:"hashes"`
}

func ledgerPath(root string) string { return filepath.Join(root, ledgerFile) }

// readLedger returns, per repo-relative file, the set of AI-written line hashes.
func readLedger(root string) map[string]map[string]bool {
	out := map[string]map[string]bool{}
	f, err := os.Open(ledgerPath(root))
	if err != nil {
		return out
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	sc.Buffer(make([]byte, 1<<20), 1<<24)
	for sc.Scan() {
		var e ledgerEntry
		if json.Unmarshal(sc.Bytes(), &e) != nil || e.File == "" {
			continue
		}
		set := out[e.File]
		if set == nil {
			set = map[string]bool{}
			out[e.File] = set
		}
		for _, h := range e.Hashes {
			set[h] = true
		}
	}
	return out
}

func writeLedger(root string, m map[string]map[string]bool) error {
	if err := os.MkdirAll(filepath.Dir(ledgerPath(root)), 0o755); err != nil {
		return err
	}
	var buf strings.Builder
	files := make([]string, 0, len(m))
	for f := range m {
		files = append(files, f)
	}
	sort.Strings(files)
	for _, f := range files {
		hs := make([]string, 0, len(m[f]))
		for h := range m[f] {
			hs = append(hs, h)
		}
		if len(hs) == 0 {
			continue
		}
		sort.Strings(hs)
		b, _ := json.Marshal(ledgerEntry{File: f, Hashes: hs})
		buf.Write(b)
		buf.WriteByte('\n')
	}
	return os.WriteFile(ledgerPath(root), []byte(buf.String()), 0o644)
}

func appendLedger(root, file string, hashes []string) error {
	if len(hashes) == 0 {
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(ledgerPath(root)), 0o755); err != nil {
		return err
	}
	f, err := os.OpenFile(ledgerPath(root), os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return err
	}
	defer f.Close()
	b, _ := json.Marshal(ledgerEntry{File: file, Hashes: hashes})
	_, err = f.Write(append(b, '\n'))
	return err
}

// ---- grain hook ----

// cmdHook handles editor/agent integrations.
//   grain hook claude   reads a Claude Code PostToolUse event on stdin
//   grain hook install  installs the git post-commit hook + prints the Claude config
func cmdHook(args []string) error {
	if len(args) == 0 {
		return fmt.Errorf("usage: grain hook claude | grain hook install")
	}
	switch args[0] {
	case "claude":
		return hookClaude(os.Stdin)
	case "install":
		return hookInstall(args[1:])
	}
	return fmt.Errorf("unknown hook %q (want: claude, install)", args[0])
}

// claudeEvent is the subset of a Claude Code PostToolUse payload grain reads.
type claudeEvent struct {
	CWD       string `json:"cwd"`
	ToolName  string `json:"tool_name"`
	ToolInput struct {
		FilePath  string `json:"file_path"`
		NewString string `json:"new_string"` // Edit
		Content   string `json:"content"`    // Write
		Edits     []struct {
			NewString string `json:"new_string"` // MultiEdit
		} `json:"edits"`
	} `json:"tool_input"`
}

func hookClaude(r io.Reader) error {
	data, err := io.ReadAll(r)
	if err != nil {
		return err
	}
	var ev claudeEvent
	if err := json.Unmarshal(data, &ev); err != nil {
		return nil // not our payload; never break the agent
	}
	if ev.ToolInput.FilePath == "" {
		return nil
	}
	switch ev.ToolName {
	case "Edit", "Write", "MultiEdit":
	default:
		return nil
	}

	// Gather the text AI just wrote.
	var written []string
	if ev.ToolInput.NewString != "" {
		written = append(written, ev.ToolInput.NewString)
	}
	if ev.ToolInput.Content != "" {
		written = append(written, ev.ToolInput.Content)
	}
	for _, e := range ev.ToolInput.Edits {
		if e.NewString != "" {
			written = append(written, e.NewString)
		}
	}
	if len(written) == 0 {
		return nil
	}

	cwd := ev.CWD
	if cwd == "" {
		cwd = filepath.Dir(ev.ToolInput.FilePath)
	}
	root, err := gitlog.Toplevel(cwd)
	if err != nil {
		return nil // not in a repo; nothing to attest
	}
	// Resolve symlinks on both sides (macOS /tmp → /private/tmp) so Rel works.
	if r, err := filepath.EvalSymlinks(root); err == nil {
		root = r
	}
	fp := ev.ToolInput.FilePath
	if f, err := filepath.EvalSymlinks(fp); err == nil {
		fp = f
	}
	rel, err := filepath.Rel(root, fp)
	if err != nil || strings.HasPrefix(rel, "..") {
		return nil
	}
	rel = filepath.ToSlash(rel)

	seen := map[string]bool{}
	var hashes []string
	for _, block := range written {
		for _, line := range strings.Split(block, "\n") {
			if !substantive(line) {
				continue
			}
			h := lineHash(line)
			if !seen[h] {
				seen[h] = true
				hashes = append(hashes, h)
			}
		}
	}
	return appendLedger(root, rel, hashes)
}

const postCommitHook = `#!/bin/sh
# grain: attest AI-written lines on every commit (installed by 'grain hook install')
command -v grain >/dev/null 2>&1 && grain attest -q
exit 0
`

func hookInstall(args []string) error {
	fs := flag.NewFlagSet("hook install", flag.ExitOnError)
	dir := fs.String("C", ".", "run in this directory")
	fs.Parse(args)
	root, err := gitlog.Toplevel(*dir)
	if err != nil {
		return fmt.Errorf("not a git repository (%s)", *dir)
	}
	hook := filepath.Join(root, ".git", "hooks", "post-commit")
	if err := os.WriteFile(hook, []byte(postCommitHook), 0o755); err != nil {
		return err
	}
	fmt.Printf("✓ installed %s\n\n", hook)
	fmt.Println("Add this to your Claude Code settings (.claude/settings.json in the repo,")
	fmt.Println("or ~/.claude/settings.json for every repo) so AI edits are captured at the source:")
	fmt.Println(`
{
  "hooks": {
    "PostToolUse": [
      { "matcher": "Edit|Write|MultiEdit",
        "hooks": [ { "type": "command",
                     "command": "command -v grain >/dev/null 2>&1 && grain hook claude || true" } ] }
    ]
  }
}`)
	fmt.Println("\nFrom then on every commit is attested automatically. Try: grain blame <file>")
	return nil
}

// ---- grain attest ----

// cmdAttest matches HEAD's added lines against the AI-edit ledger and writes an
// attested note carrying the exact AI lines (as content hashes).
func cmdAttest(args []string) error {
	fs := flag.NewFlagSet("attest", flag.ExitOnError)
	dir := fs.String("C", ".", "run in this directory")
	quiet := fs.Bool("q", false, "quiet (for hooks)")
	fs.Parse(args)

	root, err := gitlog.Toplevel(*dir)
	if err != nil {
		return fmt.Errorf("not a git repository (%s)", *dir)
	}
	ledger := readLedger(root)
	if len(ledger) == 0 {
		if !*quiet {
			fmt.Println("grain attest — no AI edits recorded (is the Claude hook installed? grain hook install)")
		}
		return nil
	}
	head, err := gitlog.Head(root)
	if err != nil {
		return err
	}
	added, err := gitlog.ReadAddedLines(root, "HEAD", 1)
	if err != nil {
		return err
	}
	byFile := added[head]

	var aiHashes []string
	var aiN, totalN int
	consumed := map[string]map[string]bool{}
	for file, lines := range byFile {
		set := ledger[file]
		for _, l := range lines {
			if !substantive(l) {
				continue
			}
			totalN++
			h := lineHash(l)
			if set != nil && set[h] {
				aiN++
				aiHashes = append(aiHashes, h)
				if consumed[file] == nil {
					consumed[file] = map[string]bool{}
				}
				consumed[file][h] = true
			}
		}
	}

	if aiN == 0 {
		if !*quiet {
			fmt.Printf("grain attest — %s: no recorded AI lines in this commit (%d added)\n", head[:7], totalN)
		}
		return nil
	}

	prov := "assisted"
	if aiN == totalN {
		prov = "ai"
	}
	sort.Strings(aiHashes)
	note := fmt.Sprintf("Provenance: %s\nAI-Lines: %d/%d\nAI-Hashes: %s", prov, aiN, totalN, strings.Join(aiHashes, ","))
	note, signedBy := signNote(head, note)
	if err := gitlog.AddNote(root, gitlog.NotesRef, head, note); err != nil {
		return err
	}

	// Consume the attested lines so they aren't re-attested on a later commit.
	for file, hs := range consumed {
		for h := range hs {
			delete(ledger[file], h)
		}
	}
	if err := writeLedger(root, ledger); err != nil {
		return err
	}
	if !*quiet {
		fmt.Printf("grain attest — %s: Provenance: %s · %d/%d added lines AI-written (note on %s%s)\n",
			head[:7], prov, aiN, totalN, gitlog.NotesRef, signedBy)
		fmt.Println("  push it with: git push origin " + gitlog.NotesRef)
	}
	return nil
}

// signNote signs an attestation with the local key (created on first use).
// Signing is best-effort: an attestation is still worth writing unsigned.
// Returns the note and a suffix for messages (", signed <fingerprint>").
func signNote(sha, note string) (string, string) {
	k, _, err := sign.LoadOrCreate()
	if err != nil {
		return note, ""
	}
	return sign.SignNote(k, sha, note), ", signed " + k.Fingerprint()
}

// parseAIHashes reads the AI-Hashes line of a grain note into a set.
func parseAIHashes(note string) map[string]bool {
	for _, raw := range strings.Split(note, "\n") {
		k, v, ok := strings.Cut(strings.TrimSpace(raw), ":")
		if ok && strings.EqualFold(strings.TrimSpace(k), "ai-hashes") {
			set := map[string]bool{}
			for _, h := range strings.Split(v, ",") {
				if h = strings.TrimSpace(h); h != "" {
					set[h] = true
				}
			}
			return set
		}
	}
	return nil
}

// ---- grain blame ----

type blameLine struct {
	sha     string
	content string
}

func gitBlame(root, file string) ([]blameLine, error) {
	out, err := gitlog.Run(root, "blame", "--line-porcelain", "--", file)
	if err != nil {
		return nil, err
	}
	var lines []blameLine
	var cur string
	for _, l := range strings.Split(out, "\n") {
		if strings.HasPrefix(l, "\t") {
			lines = append(lines, blameLine{sha: cur, content: l[1:]})
			continue
		}
		if len(l) >= 40 && !strings.Contains(l[:40], " ") && isHex(l[:40]) {
			cur = l[:40]
		}
	}
	return lines, nil
}

func isHex(s string) bool {
	for _, c := range s {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f')) {
			return false
		}
	}
	return true
}

type commitProv struct {
	aiWhole bool            // attested/declared AI for the whole commit
	human   bool            // attested human
	hashes  map[string]bool // exact AI lines, when line-level attested
}

// cmdBlame shows per-line provenance: which lines of a file were AI-written.
func cmdBlame(args []string) error {
	fs := flag.NewFlagSet("blame", flag.ExitOnError)
	dir := fs.String("C", ".", "run in this directory")
	fs.Parse(args)
	if fs.NArg() < 1 {
		return fmt.Errorf("usage: grain blame <file>")
	}
	file := fs.Arg(0)

	root, cfg, err := setup(*dir)
	if err != nil {
		return err
	}
	rel := file
	if abs, err := filepath.Abs(file); err == nil {
		if r, err := filepath.EvalSymlinks(root); err == nil {
			root = r
		}
		if a, err := filepath.EvalSymlinks(abs); err == nil {
			abs = a
		}
		if r, err := filepath.Rel(root, abs); err == nil && !strings.HasPrefix(r, "..") {
			rel = filepath.ToSlash(r)
		}
	}
	lines, err := gitBlame(root, rel)
	if err != nil {
		return fmt.Errorf("git blame failed for %s: %v", rel, err)
	}

	// Provenance per commit, resolved once.
	provs := map[string]commitProv{}
	for _, bl := range lines {
		if _, ok := provs[bl.sha]; ok {
			continue
		}
		note := gitlog.ReadNote(root, gitlog.NotesRef, bl.sha)
		c := gitlog.Commit{SHA: bl.sha, Body: gitlog.ShowBody(root, bl.sha), Note: note}
		s := signal.Extract(c, cfg)
		provs[bl.sha] = commitProv{
			aiWhole: s.AttestedClass == "ai" || s.DeclaredAI,
			human:   s.AttestedClass == "human",
			hashes:  parseAIHashes(note),
		}
	}

	tty := isTTY()
	const (
		cAI    = "\x1b[38;5;208m"
		cDim   = "\x1b[2m"
		cReset = "\x1b[0m"
	)
	aiCount := 0
	for i, bl := range lines {
		p := provs[bl.sha]
		isAI := false
		switch {
		case p.hashes != nil:
			isAI = substantive(bl.content) && p.hashes[lineHash(bl.content)]
		case p.aiWhole:
			isAI = substantive(bl.content)
		}
		if isAI {
			aiCount++
		}
		mark := "  "
		if isAI {
			mark = "AI"
		}
		short := bl.sha
		if len(short) > 7 {
			short = short[:7]
		}
		if tty {
			if isAI {
				fmt.Printf("%s%s%s %s%s%s %4d  %s%s%s\n", cAI, mark, cReset, cDim, short, cReset, i+1, cAI, bl.content, cReset)
			} else {
				fmt.Printf("%s %s%s%s %4d  %s\n", mark, cDim, short, cReset, i+1, bl.content)
			}
		} else {
			fmt.Printf("%s %s %4d  %s\n", mark, short, i+1, bl.content)
		}
	}
	n := len(lines)
	pct := 0
	if n > 0 {
		pct = aiCount * 100 / n
	}
	fmt.Printf("\n%s — %d lines · %d AI-written (%d%%) · attested from git notes; unattested lines shown as human\n", rel, n, aiCount, pct)
	return nil
}

func isTTY() bool {
	fi, err := os.Stdout.Stat()
	return err == nil && fi.Mode()&os.ModeCharDevice != 0
}
