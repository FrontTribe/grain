// Package report aggregates per-commit classifications into a repo/PR report
// and renders it as grain.json, PROVENANCE.md, a shields badge, and terminal
// output.
package report

import (
	"encoding/json"
	"fmt"
	"io"
	"math"
	"sort"
	"strings"

	"github.com/kresimirgalic/grain/internal/config"
	"github.com/kresimirgalic/grain/internal/gitlog"
	"github.com/kresimirgalic/grain/internal/score"
)

// EngineVersion / WeightsID pin how a score was produced, so grain.json is reproducible.
const (
	EngineVersion = "0.1.0"
	WeightsID     = "w1"
)

type PathStat struct {
	Path       string
	Human      float64 // fraction of classified lines
	AI         float64
	Lines      int
	HumanOwned bool
}

type Summary struct {
	Human        float64
	AIAssisted   float64
	Unclassified float64
	Lines        int
}

type Report struct {
	Repo        string
	GeneratedAt string
	RangeFrom   string
	RangeTo     string
	NumCommits  int
	Summary     Summary
	ByPath      []PathStat
	Results     []score.Result
}

// Build aggregates results (line-weighted) into a report.
func Build(repo, generatedAt string, commits []gitlog.Commit, results []score.Result, cfg config.Config) Report {
	byClass := map[string]int{}
	resBySHA := make(map[string]score.Result, len(results))
	for _, r := range results {
		w := r.Lines
		if w == 0 {
			w = 1
		}
		switch {
		case r.Class == score.Human:
			byClass["human"] += w
		case r.IsAI():
			byClass["ai"] += w
		default:
			byClass["uncl"] += w
		}
		resBySHA[r.SHA] = r
	}
	total := byClass["human"] + byClass["ai"] + byClass["uncl"]
	if total == 0 {
		total = 1
	}

	dirs := map[string]*PathStat{}
	for _, c := range commits {
		cls := resBySHA[c.SHA].Class
		for _, f := range c.Files {
			d := topDir(f.Path)
			ps := dirs[d]
			if ps == nil {
				ps = &PathStat{Path: d, HumanOwned: matchOwned(d, cfg.HumanOwned)}
				dirs[d] = ps
			}
			w := f.Added + f.Deleted
			if w == 0 {
				w = 1
			}
			ps.Lines += w
			switch {
			case cls == score.Human:
				ps.Human += float64(w)
			case cls == score.AIAssisted || cls == score.AIAuthored:
				ps.AI += float64(w)
			}
		}
	}

	var paths []PathStat
	for _, ps := range dirs {
		denom := ps.Human + ps.AI
		if denom > 0 {
			ps.Human, ps.AI = ps.Human/denom, ps.AI/denom
		}
		paths = append(paths, *ps)
	}
	sort.Slice(paths, func(i, j int) bool { return paths[i].Lines > paths[j].Lines })
	if len(paths) > 8 {
		paths = paths[:8]
	}

	from, to := "", "HEAD"
	if len(commits) > 0 {
		to = commits[0].SHA[:min(7, len(commits[0].SHA))]
		from = commits[len(commits)-1].SHA[:min(7, len(commits[len(commits)-1].SHA))]
	}

	return Report{
		Repo:        repo,
		GeneratedAt: generatedAt,
		RangeFrom:   from,
		RangeTo:     to,
		NumCommits:  len(commits),
		Summary: Summary{
			Human:        float64(byClass["human"]) / float64(total),
			AIAssisted:   float64(byClass["ai"]) / float64(total),
			Unclassified: float64(byClass["uncl"]) / float64(total),
			Lines:        total,
		},
		ByPath:  paths,
		Results: results,
	}
}

// ---- rendering ----

func (r Report) WriteJSON(w io.Writer) error {
	type engineJSON struct {
		Version string `json:"version"`
		Weights string `json:"weights"`
	}
	type rangeJSON struct {
		From    string `json:"from"`
		To      string `json:"to"`
		Commits int    `json:"commits"`
	}
	type sumJSON struct {
		Human        float64 `json:"human"`
		AIAssisted   float64 `json:"ai_assisted"`
		Unclassified float64 `json:"unclassified"`
		Lines        int     `json:"lines"`
	}
	type pathJSON struct {
		Path  string  `json:"path"`
		Human float64 `json:"human"`
		AI    float64 `json:"ai"`
		Lines int     `json:"lines"`
		Owned bool    `json:"human_owned"`
	}
	type commitJSON struct {
		SHA          string   `json:"sha"`
		AILikelihood float64  `json:"ai_likelihood"`
		Confidence   float64  `json:"confidence"`
		Basis        string   `json:"basis"`
		Class        string   `json:"class"`
		Signals      []string `json:"signals,omitempty"`
		Lines        int      `json:"lines"`
	}
	doc := struct {
		Schema      string       `json:"schema"`
		Engine      engineJSON   `json:"engine"`
		Repo        string       `json:"repo"`
		GeneratedAt string       `json:"generated_at"`
		Range       rangeJSON    `json:"range"`
		Summary     sumJSON      `json:"summary"`
		ByPath      []pathJSON   `json:"by_path"`
		Commits     []commitJSON `json:"commits"`
	}{
		Schema:      "grain/v0.1",
		Engine:      engineJSON{EngineVersion, WeightsID},
		Repo:        r.Repo,
		GeneratedAt: r.GeneratedAt,
		Range:       rangeJSON{r.RangeFrom, r.RangeTo, r.NumCommits},
		Summary:     sumJSON{round2(r.Summary.Human), round2(r.Summary.AIAssisted), round2(r.Summary.Unclassified), r.Summary.Lines},
	}
	for _, p := range r.ByPath {
		doc.ByPath = append(doc.ByPath, pathJSON{p.Path, round2(p.Human), round2(p.AI), p.Lines, p.HumanOwned})
	}
	for _, c := range r.Results {
		doc.Commits = append(doc.Commits, commitJSON{c.SHA, round2(c.AILikelihood), round2(c.Confidence), c.Basis, c.Class, c.Signals, c.Lines})
	}
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	return enc.Encode(doc)
}

func (r Report) WriteMarkdown(w io.Writer) {
	p := func(format string, a ...any) { fmt.Fprintf(w, format, a...) }
	p("# Provenance\n\n")
	p("Authorship mix for **%s**, measured from %d commits. Signals, not verdicts.\n\n", r.Repo, r.NumCommits)
	p("| | Share |\n|---|---|\n")
	p("| Human-authored | **%d%%** |\n", pct(r.Summary.Human))
	p("| AI-assisted | %d%% |\n", pct(r.Summary.AIAssisted))
	p("| Unclassified | %d%% |\n\n", pct(r.Summary.Unclassified))

	if len(r.ByPath) > 0 {
		p("## By directory\n\n| Path | Human | AI | Lines | |\n|---|---|---|---|---|\n")
		for _, ps := range r.ByPath {
			flag := ""
			if ps.HumanOwned {
				flag = "`human-owned`"
			}
			p("| `%s` | %d%% | %d%% | %d | %s |\n", ps.Path, pct(ps.Human), pct(ps.AI), ps.Lines, flag)
		}
		p("\n")
	}
	p("> **How this is measured:** declared signals (`Co-Authored-By`, bot commits, explicit tags) dominate; behavioral inference is capped at %.2f confidence and never stated as fact.\n\n", score.InferredConfidenceCap)
	p("<sub>Generated by grain %s · engine weights %s · %s · reproducible from grain.json</sub>\n", EngineVersion, WeightsID, r.GeneratedAt)
}

// WriteCheckMarkdown renders the PR-comment body for `grain check`. The leading
// HTML marker lets the Action find and update its own sticky comment.
func (r Report) WriteCheckMarkdown(w io.Writer, threshold float64, flagged []string, over bool) {
	p := func(format string, a ...any) { fmt.Fprintf(w, format, a...) }
	p("<!-- grain-provenance -->\n")
	p("## 🌾 Provenance report\n\n")
	p("**%d%% AI-assisted** · %d%% human · %d%% unclassified — %d commits, %d lines changed\n\n",
		pct(r.Summary.AIAssisted), pct(r.Summary.Human), pct(r.Summary.Unclassified), r.NumCommits, r.Summary.Lines)

	if len(r.ByPath) > 0 {
		p("| Path | Human | AI | Lines | |\n|---|---|---|---|---|\n")
		for _, ps := range r.ByPath {
			flag := ""
			if ps.HumanOwned {
				flag = "`human-owned`"
			}
			p("| `%s` | %d%% | %d%% | %d | %s |\n", ps.Path, pct(ps.Human), pct(ps.AI), ps.Lines, flag)
		}
		p("\n")
	}

	switch {
	case len(flagged) > 0:
		p("> ⚠️ **Policy:** AI-assisted share is above %.0f%% in a human-owned path (%s) → **1 human review requested**. This is a signal, not a block.\n\n",
			threshold*100, "`"+strings.Join(flagged, "`, `")+"`")
	case over:
		p("> ⚠️ **Policy:** the change set is above the %.0f%% AI-assisted threshold → review suggested. This is a signal, not a block.\n\n", threshold*100)
	default:
		p("> ✅ Within policy.\n\n")
	}
	p("<sub>signals, not verdicts · grain %s</sub>\n", EngineVersion)
}

// Attention evaluates the policy and returns any flagged human-owned paths and
// whether the overall change set is over the AI threshold.
func (r Report) Attention(threshold float64) (flagged []string, over bool) {
	for _, p := range r.ByPath {
		if p.HumanOwned && p.AI > threshold {
			flagged = append(flagged, p.Path)
		}
	}
	over = r.Summary.AIAssisted > threshold
	return flagged, over
}

// Badge writes the shields.io endpoint JSON.
func (r Report) WriteBadge(w io.Writer) error {
	color := "1F6E5B"
	switch {
	case r.Summary.AIAssisted >= 0.40:
		color = "B0511C"
	case r.Summary.AIAssisted >= 0.15:
		color = "6B655B"
	}
	badge := map[string]any{
		"schemaVersion": 1,
		"label":         "grain",
		"message":       fmt.Sprintf("%d%% AI-assisted", pct(r.Summary.AIAssisted)),
		"color":         color,
	}
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	return enc.Encode(badge)
}

// WriteText prints the human-facing scan summary.
func (r Report) WriteText(w io.Writer, color bool) {
	c := colorizer(color)
	pad := func(s string) string { return fmt.Sprintf("%-15s", s) }
	fmt.Fprintf(w, "%s %s\n", c(bold, "grain "+EngineVersion), c(dim, "· scanning "+r.Repo))
	fmt.Fprintf(w, "  reading %d commits %s\n", r.NumCommits, c(human, "done"))
	fmt.Fprintf(w, "  provenance:\n")
	fmt.Fprintf(w, "    %s %3d%%  %s\n", c(human, pad("human-authored")), pct(r.Summary.Human), c(human, bar(r.Summary.Human)))
	fmt.Fprintf(w, "    %s %3d%%  %s\n", c(ai, pad("ai-assisted")), pct(r.Summary.AIAssisted), c(ai, bar(r.Summary.AIAssisted)))
	fmt.Fprintf(w, "    %s %3d%%  %s\n", c(dim, pad("unclassified")), pct(r.Summary.Unclassified), c(dim, bar(r.Summary.Unclassified)))
}

// ---- helpers ----

func topDir(path string) string {
	parts := strings.Split(path, "/")
	switch {
	case len(parts) >= 3:
		return parts[0] + "/" + parts[1] + "/"
	case len(parts) == 2:
		return parts[0] + "/"
	default:
		return "(root)"
	}
}

func matchOwned(dir string, patterns []string) bool {
	for _, pat := range patterns {
		base := strings.TrimSuffix(pat, "/**")
		base = strings.TrimSuffix(base, "/*")
		base = strings.TrimSuffix(base, "/")
		if base == "" {
			continue
		}
		if strings.HasPrefix(strings.TrimSuffix(dir, "/"), base) {
			return true
		}
	}
	return false
}

func bar(frac float64) string {
	const width = 20
	filled := int(math.Round(frac * width))
	if filled > width {
		filled = width
	}
	if filled < 0 {
		filled = 0
	}
	return strings.Repeat("█", filled) + strings.Repeat("░", width-filled)
}

func pct(f float64) int    { return int(math.Round(f * 100)) }
func round2(f float64) float64 { return math.Round(f*100) / 100 }

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// tiny ANSI colorizer
type style string

const (
	reset style = "\x1b[0m"
	human style = "\x1b[38;2;31;110;91m"
	ai    style = "\x1b[38;2;176;81;28m"
	dim   style = "\x1b[38;2;139;133;119m"
	bold  style = "\x1b[1m"
)

func colorizer(on bool) func(style, string) string {
	return func(s style, text string) string {
		if !on {
			return text
		}
		return string(s) + text + string(reset)
	}
}
