package report

import (
	"fmt"
	"strings"

	"github.com/FrontTribe/grain/internal/security"
)

// securityLine is the one-line terminal summary of the security analysis, or "".
func securityLine(s *security.Summary) string {
	if s == nil || s.Total == 0 {
		return ""
	}
	line := fmt.Sprintf("  security: %d signals, %d in AI-written lines, %d of those unreviewed", s.Total, s.AI, s.AIUnreviewed)
	if s.AICriticalUnrev > 0 {
		line += fmt.Sprintf(" (%d in critical paths)", s.AICriticalUnrev)
	}
	var top []string
	for i, p := range s.ByPattern {
		if i == 3 {
			break
		}
		top = append(top, fmt.Sprintf("%s %d", p.ID, p.AI+p.Human))
	}
	if len(top) > 0 {
		line += " · " + strings.Join(top, ", ")
	}
	return line + "\n"
}

// securityMarkdown is the "## Security" section of PROVENANCE.md, or "".
func securityMarkdown(s *security.Summary) string {
	if s == nil {
		return ""
	}
	var b strings.Builder
	b.WriteString("## Security\n\n")
	if s.Total == 0 {
		b.WriteString("No added line matched grain's security patterns (secrets, disabled TLS, shell or SQL built from strings, unsafe deserialization, wildcard IAM, and similar). Tests and fixtures are not scanned.\n\n")
		return b.String()
	}
	fmt.Fprintf(&b, "**%d lines look worth a second look; %d were AI-written, %d of those with no review evidence", s.Total, s.AI, s.AIUnreviewed)
	if s.AICriticalUnrev > 0 {
		fmt.Fprintf(&b, ", %d in a critical path", s.AICriticalUnrev)
	}
	b.WriteString(".** These are pattern matches joined with provenance, not confirmed vulnerabilities: a place to look, not a verdict.\n\n")
	b.WriteString("| Pattern | Severity | AI-written | Human |\n|---|---|---|---|\n")
	for _, p := range s.ByPattern {
		fmt.Fprintf(&b, "| `%s` %s | %s | %d | %d |\n", p.ID, p.Title, p.Severity, p.AI, p.Human)
	}
	b.WriteString("\n**Findings** — worst first (AI-written, unreviewed, critical path):\n\n")
	shown := 0
	for _, f := range s.Findings {
		if shown == 15 {
			fmt.Fprintf(&b, "- … and %d more in `grain.json`\n", len(s.Findings)-shown)
			break
		}
		sha := f.SHA
		if len(sha) > 7 {
			sha = sha[:7]
		}
		who := "human"
		if f.AI {
			who = "AI"
		}
		rev := "unreviewed"
		if f.Reviewed {
			rev = "reviewed"
		}
		fmt.Fprintf(&b, "- `%s` `%s` — %s (%s, %s, %s", sha, f.Path, f.Title, f.Severity, who, rev)
		if f.Critical != "" {
			fmt.Fprintf(&b, ", in `%s`", f.Critical)
		}
		b.WriteString(")")
		if f.Excerpt != "" {
			fmt.Fprintf(&b, "  \n  `%s`", strings.ReplaceAll(f.Excerpt, "`", "'"))
		}
		b.WriteString("\n")
		shown++
	}
	b.WriteString("\n")
	return b.String()
}
