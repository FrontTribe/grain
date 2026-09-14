package report

import (
	"fmt"
	"strings"

	"github.com/FrontTribe/grain/internal/risk"
)

// riskLine is the one-line terminal summary of the risk analysis, or "".
func riskLine(r *risk.Summary) string {
	if r == nil || r.AILines == 0 {
		return ""
	}
	if r.CriticalAILines == 0 {
		return "  risk: no AI-written lines in critical paths\n"
	}
	s := fmt.Sprintf("  risk: %d AI lines in critical paths, %d (%d%%) without review evidence",
		r.CriticalAILines, r.CriticalUnreviewed, pct(r.UnreviewedShare()))
	var top []string
	for i, p := range r.Critical {
		if i == 3 {
			break
		}
		top = append(top, fmt.Sprintf("%s %d", p.Path, p.Unreviewed))
	}
	if len(top) > 0 {
		s += " · " + strings.Join(top, ", ")
	}
	return s + "\n"
}

// riskMarkdown is the "## Risk" section of PROVENANCE.md, or "".
func riskMarkdown(r *risk.Summary) string {
	if r == nil || r.AILines == 0 {
		return ""
	}
	var b strings.Builder
	b.WriteString("## Risk\n\n")
	if r.CriticalAILines == 0 {
		fmt.Fprintf(&b, "No AI-written lines landed in critical paths (%s).\n\n", strings.Join(r.Patterns, ", "))
		return b.String()
	}
	fmt.Fprintf(&b, "**%d of %d AI-written lines in critical paths (%d%%) landed without review evidence.** ",
		r.CriticalUnreviewed, r.CriticalAILines, pct(r.UnreviewedShare()))
	b.WriteString("Review evidence is anything git can see — a `Reviewed-by` trailer, a squash-merge `(#123)` subject, arriving via a merge, or a committer other than the author. Absence means no evidence, not proof of no review.\n\n")
	b.WriteString("| Critical path | AI lines | Unreviewed | Commits |\n|---|---|---|---|\n")
	for _, p := range r.Critical {
		fmt.Fprintf(&b, "| `%s` | %d | %d | %d |\n", p.Path, p.AILines, p.Unreviewed, p.Commits)
	}
	if len(r.Top) > 0 {
		b.WriteString("\n**Hotspots** — commits that put the most unreviewed AI lines into a critical path:\n\n")
		for _, h := range r.Top {
			sha := h.SHA
			if len(sha) > 7 {
				sha = sha[:7]
			}
			fmt.Fprintf(&b, "- `%s` %s — `%s`, %d lines\n", sha, h.Subject, h.Path, h.AILines)
		}
	}
	b.WriteString("\n")
	return b.String()
}
