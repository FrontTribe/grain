package report

import (
	"fmt"
	"strings"

	"github.com/FrontTribe/grain/internal/deps"
)

// depsLine is the one-line terminal summary of added dependencies, or "".
func depsLine(d *deps.Summary) string {
	if d == nil || d.Total == 0 {
		return ""
	}
	s := fmt.Sprintf("  deps: %d added, %d by AI (%d unreviewed)", d.Total, d.AI, d.AIUnreviewed)
	if d.Checked {
		s += fmt.Sprintf(" · registry: %d not found, %d younger than %d days", d.Missing, d.Young, deps.YoungDays)
	} else {
		s += " · registry not checked (--check-registry)"
	}
	return s + "\n"
}

// depsMarkdown is the "## Dependencies" section of PROVENANCE.md, or "".
func depsMarkdown(d *deps.Summary) string {
	if d == nil || d.Total == 0 {
		return ""
	}
	var b strings.Builder
	b.WriteString("## Dependencies\n\n")
	fmt.Fprintf(&b, "**%d dependencies were added in this range; %d by AI-written lines, %d of those with no review evidence.** ", d.Total, d.AI, d.AIUnreviewed)
	if d.Checked {
		fmt.Fprintf(&b, "Checked against the registries: **%d not found** (a hallucinated name is the slopsquatting seed) and **%d younger than %d days**.\n\n", d.Missing, d.Young, deps.YoungDays)
	} else {
		b.WriteString("Registries were not consulted (run with `--check-registry`; only package names are sent).\n\n")
	}
	b.WriteString("| Package | Ecosystem | Added by | Reviewed | Registry |\n|---|---|---|---|---|\n")
	shown := 0
	for _, x := range d.Deps {
		if shown == 20 {
			fmt.Fprintf(&b, "| … %d more in `grain.json` | | | | |\n", len(d.Deps)-shown)
			break
		}
		who := "human"
		if x.AI {
			who = "AI"
		}
		rev := "no evidence"
		if x.Reviewed {
			rev = "yes"
		}
		reg := "not checked"
		if x.Checked {
			switch {
			case !x.Exists:
				reg = "**not found**"
			case x.AgeDays >= 0 && x.AgeDays < deps.YoungDays:
				reg = fmt.Sprintf("**%d days old**", x.AgeDays)
			case x.AgeDays >= 0:
				reg = fmt.Sprintf("%d days old", x.AgeDays)
			default:
				reg = "exists"
			}
		}
		sha := x.SHA
		if len(sha) > 7 {
			sha = sha[:7]
		}
		fmt.Fprintf(&b, "| `%s` | %s | %s (`%s`) | %s | %s |\n", x.Name, x.Ecosystem, who, sha, rev, reg)
		shown++
	}
	b.WriteString("\n")
	return b.String()
}

// depsCheckMarkdown is the PR-comment "Dependencies" section: every package
// this change set added, with the registry answer when it was consulted.
// Empty when the range added none.
func depsCheckMarkdown(d *deps.Summary) string {
	if d == nil || d.Total == 0 {
		return ""
	}
	var b strings.Builder
	fmt.Fprintf(&b, "### Dependencies · %d added, %d by AI-written lines\n\n", d.Total, d.AI)
	b.WriteString("| Package | Added by | Registry |\n|---|---|---|\n")
	shown := 0
	for _, x := range d.Deps {
		if shown == 12 {
			fmt.Fprintf(&b, "| … %d more in the full report | | |\n", len(d.Deps)-shown)
			break
		}
		who := "human"
		if x.AI {
			who = "**AI**"
		}
		reg := "not checked"
		if x.Checked {
			switch {
			case !x.Exists:
				reg = "**not found**"
			case x.AgeDays >= 0 && x.AgeDays < deps.YoungDays:
				reg = fmt.Sprintf("**%d days old**", x.AgeDays)
			case x.AgeDays >= 0:
				reg = fmt.Sprintf("%d days old", x.AgeDays)
			default:
				reg = "exists"
			}
		}
		name := x.Name
		if x.URL != "" {
			name = fmt.Sprintf("[%s](%s)", x.Name, x.URL)
		}
		fmt.Fprintf(&b, "| %s `%s` | %s | %s |\n", name, x.Ecosystem, who, reg)
		shown++
	}
	if d.Checked {
		b.WriteString("\nExistence is not safety: a name the registry does not know is the slopsquatting seed, and a package that exists can still be malicious.\n\n")
	} else {
		b.WriteString("\nRegistries were not consulted (`--check-registry`, or `check_registry: true` in the Action).\n\n")
	}
	return b.String()
}
