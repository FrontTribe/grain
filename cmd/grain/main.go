// Command grain is a code-provenance CLI: it reads a git history and reports
// how much of a repository is human-written vs AI-assisted. Signals, not verdicts.
package main

import (
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/FrontTribe/grain/internal/config"
	"github.com/FrontTribe/grain/internal/gitlog"
	"github.com/FrontTribe/grain/internal/report"
	"github.com/FrontTribe/grain/internal/score"
	"github.com/FrontTribe/grain/internal/signal"
)

const version = "0.1.0"

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}
	var err error
	switch os.Args[1] {
	case "scan":
		err = cmdScan(os.Args[2:])
	case "check":
		err = cmdCheck(os.Args[2:])
	case "badge":
		err = cmdBadge(os.Args[2:])
	case "explain":
		err = cmdExplain(os.Args[2:])
	case "annotate":
		err = cmdAnnotate(os.Args[2:])
	case "eval":
		err = cmdEval(os.Args[2:])
	case "push":
		err = cmdPush(os.Args[2:])
	case "init":
		err = cmdInit(os.Args[2:])
	case "version", "--version", "-v":
		fmt.Printf("grain %s (engine %s, weights %s)\n", version, report.EngineVersion, report.WeightsID)
	case "help", "--help", "-h":
		usage()
	default:
		fmt.Fprintf(os.Stderr, "grain: unknown command %q\n\n", os.Args[1])
		usage()
		os.Exit(2)
	}
	if err != nil {
		// exit code 1 is reserved for policy violations (see cmdCheck); errors use 2.
		if pe, ok := err.(policyExit); ok {
			os.Exit(int(pe))
		}
		fmt.Fprintln(os.Stderr, "grain: "+err.Error())
		os.Exit(2)
	}
}

// policyExit signals a clean, non-error policy violation with a specific exit code.
type policyExit int

func (policyExit) Error() string { return "policy violation" }

func usage() {
	fmt.Fprint(os.Stderr, `grain — code provenance layer. Signals, not verdicts.

usage:
  grain scan [-C dir] [--max N] [--no-color]     scan history → PROVENANCE.md + grain.json
  grain check --range <a..b> [-C dir]            gate a change set; exit 1 on attention
  grain badge [-C dir]                           print the shields.io endpoint JSON
  grain explain <sha> [-C dir]                    why a commit was classified as it was
  grain annotate <sha> --ai|--human|--assisted   attest a commit's provenance in a git note
  grain eval [--fit] [-C dir]                     score the content classifier vs declared commits
  grain push [--url U] [--token T] [--file f]     push grain.json to Grain Cloud
  grain init [-C dir]                            write an example .grain.toml
  grain version

`)
}

// setup resolves the repo root and config for a command's -C flag.
func setup(dir string) (root string, cfg config.Config, err error) {
	root, err = gitlog.Toplevel(dir)
	if err != nil {
		return "", config.Config{}, fmt.Errorf("not a git repository (%s)", dir)
	}
	cfg, err = config.Load(root)
	return root, cfg, err
}

func repoName(root string) string {
	if slug := gitlog.RemoteSlug(root); slug != "" {
		return slug
	}
	return filepath.Base(root)
}

func classifyAll(commits []gitlog.Commit, cfg config.Config, added map[string]map[string][]string) []score.Result {
	out := make([]score.Result, 0, len(commits))
	for _, c := range commits {
		out = append(out, score.Classify(c, signal.Extract(c, cfg), cfg, added[c.SHA]))
	}
	return out
}

// addedFor reads per-commit added lines when the content classifier is enabled.
// Best-effort: a git error falls back to nil (behavioral heuristic).
func addedFor(root, rev string, max int, cfg config.Config) map[string]map[string][]string {
	if !cfg.ContentClassifier {
		return nil
	}
	m, err := gitlog.ReadAddedLines(root, rev, max)
	if err != nil {
		return nil
	}
	return m
}

func today() string { return time.Now().UTC().Format("2006-01-02") }

func cmdScan(args []string) error {
	fs := flag.NewFlagSet("scan", flag.ExitOnError)
	dir := fs.String("C", ".", "run in this directory")
	max := fs.Int("max", 0, "limit to the most recent N commits (0 = all)")
	noColor := fs.Bool("no-color", false, "disable colored output")
	noInfer := fs.Bool("no-inference", false, "declared signals only")
	fs.Parse(args)

	root, cfg, err := setup(*dir)
	if err != nil {
		return err
	}
	if *noInfer {
		cfg.Inference = false
	}
	commits, err := gitlog.ReadCommits(root, "", *max)
	if err != nil {
		return err
	}
	if len(commits) == 0 {
		return fmt.Errorf("no commits found")
	}
	added := addedFor(root, "", *max, cfg)
	rep := report.Build(repoName(root), today(), commits, classifyAll(commits, cfg, added), cfg)

	if err := writeFile(filepath.Join(root, cfg.Output), rep.WriteMarkdown); err != nil {
		return err
	}
	if err := writeFileErr(filepath.Join(root, "grain.json"), rep.WriteJSON); err != nil {
		return err
	}

	rep.WriteText(os.Stdout, useColor(*noColor))
	fmt.Printf("  wrote %s · grain.json\n", cfg.Output)
	return nil
}

func cmdCheck(args []string) error {
	fs := flag.NewFlagSet("check", flag.ExitOnError)
	dir := fs.String("C", ".", "run in this directory")
	rev := fs.String("range", "", "commit range to check, e.g. main..HEAD")
	max := fs.Int("max", 50, "cap commits when no range is given")
	format := fs.String("format", "text", "output format: text | md")
	noColor := fs.Bool("no-color", false, "disable colored output")
	fs.Parse(args)

	root, cfg, err := setup(*dir)
	if err != nil {
		return err
	}
	capN := 0
	if *rev == "" {
		capN = *max // no range: treat the most recent commits as the change set
	}
	commits, err := gitlog.ReadCommits(root, *rev, capN)
	if err != nil {
		return err
	}
	if len(commits) == 0 {
		fmt.Println("grain: no commits in range — nothing to check")
		return nil
	}
	added := addedFor(root, *rev, capN, cfg)
	rep := report.Build(repoName(root), today(), commits, classifyAll(commits, cfg, added), cfg)
	flagged, over := rep.Attention(cfg.AIThreshold)

	if *format == "md" {
		rep.WriteCheckMarkdown(os.Stdout, cfg.AIThreshold, flagged, over)
	} else {
		rep.WriteText(os.Stdout, useColor(*noColor))
		switch {
		case len(flagged) > 0:
			fmt.Printf("  ⚠ human-owned paths above %.0f%% AI: %v\n", cfg.AIThreshold*100, flagged)
			fmt.Println("  → 1 human review requested (signal, not a block)")
		case over:
			fmt.Printf("  ⚠ change set is %d%% AI-assisted (over %.0f%% threshold)\n", pctInt(rep.Summary.AIAssisted), cfg.AIThreshold*100)
			fmt.Println("  → review suggested (signal, not a block)")
		default:
			fmt.Println("  ✓ within policy")
		}
	}

	if len(flagged) > 0 || over {
		return policyExit(1)
	}
	return nil
}

func pctInt(f float64) int { return int(f*100 + 0.5) }

func cmdBadge(args []string) error {
	fs := flag.NewFlagSet("badge", flag.ExitOnError)
	dir := fs.String("C", ".", "run in this directory")
	max := fs.Int("max", 0, "limit to the most recent N commits")
	fs.Parse(args)

	root, cfg, err := setup(*dir)
	if err != nil {
		return err
	}
	commits, err := gitlog.ReadCommits(root, "", *max)
	if err != nil {
		return err
	}
	added := addedFor(root, "", *max, cfg)
	rep := report.Build(repoName(root), today(), commits, classifyAll(commits, cfg, added), cfg)
	return rep.WriteBadge(os.Stdout)
}

func cmdExplain(args []string) error {
	fs := flag.NewFlagSet("explain", flag.ExitOnError)
	dir := fs.String("C", ".", "run in this directory")
	fs.Parse(args)
	if fs.NArg() < 1 {
		return fmt.Errorf("usage: grain explain <sha>")
	}
	sha := fs.Arg(0)

	root, cfg, err := setup(*dir)
	if err != nil {
		return err
	}
	commits, err := gitlog.ReadCommits(root, sha, 1)
	if err != nil {
		return err
	}
	if len(commits) == 0 {
		return fmt.Errorf("commit %s not found", sha)
	}
	c := commits[0]
	res := score.Classify(c, signal.Extract(c, cfg), cfg, addedFor(root, sha, 1, cfg)[c.SHA])

	short := c.SHA
	if len(short) > 7 {
		short = short[:7]
	}
	fmt.Printf("%s  %s · conf %.2f · basis %s\n", short, res.Class, res.Confidence, res.Basis)
	fmt.Printf("  subject: %s\n", c.Subject)
	fmt.Printf("  churn:   %d lines across %d files\n", c.Lines(), len(c.Files))
	if len(res.Signals) == 0 {
		fmt.Printf("  signals: none declared — classification is inferred (capped at %.2f)\n", score.InferredConfidenceCap)
	} else {
		for _, s := range res.Signals {
			fmt.Printf("  signal:  %s\n", s)
		}
	}
	return nil
}

func cmdInit(args []string) error {
	fs := flag.NewFlagSet("init", flag.ExitOnError)
	dir := fs.String("C", ".", "run in this directory")
	fs.Parse(args)

	root, err := gitlog.Toplevel(*dir)
	if err != nil {
		root = *dir
	}
	path := filepath.Join(root, ".grain.toml")
	if _, err := os.Stat(path); err == nil {
		return fmt.Errorf(".grain.toml already exists")
	}
	if err := os.WriteFile(path, []byte(defaultConfig), 0o644); err != nil {
		return err
	}
	fmt.Printf("wrote %s\n", path)
	return nil
}

// ---- small IO helpers ----

func writeFile(path string, render func(w io.Writer)) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	render(f)
	return nil
}

func writeFileErr(path string, render func(w io.Writer) error) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	return render(f)
}

func useColor(noColor bool) bool {
	if noColor || os.Getenv("NO_COLOR") != "" {
		return false
	}
	info, err := os.Stdout.Stat()
	if err != nil {
		return false
	}
	return info.Mode()&os.ModeCharDevice != 0
}

const defaultConfig = `# Grain configuration. All fields are optional; shown values are defaults.

[policy]
ai_threshold = 0.40
human_owned  = ["src/auth/**", "src/payments/**"]

[detection]
inference          = true
content_classifier = false   # score inferred commits from code content (experimental)
local_model = "off"
agents      = ["claude", "copilot", "cursor", "codex", "devin"]
bot_authors = ["*[bot]"]

[report]
badge  = "mix"
output = "PROVENANCE.md"
`
