package report

import (
	"fmt"
	"strings"

	"github.com/FrontTribe/grain/internal/outcomes"
)

// outcomesLine is the one-line terminal summary of the rework analysis, or ""
// when there is nothing to say.
func outcomesLine(o *outcomes.Summary) string {
	if o == nil {
		return ""
	}
	c, which := o.Headline()
	if c.AILines == 0 && c.HumanLines == 0 {
		return ""
	}
	s := fmt.Sprintf("  outcomes (%s · %d AI lines, %d human): AI reworked %d%% vs human %d%%",
		which, c.AILines, c.HumanLines, pct(c.AIRate()), pct(c.HumanRate()))
	switch {
	case !c.Valid():
		s += " · not enough lines for a verdict"
	case c.Ratio() > 0:
		if r := c.Ratio(); r < 1 {
			s += fmt.Sprintf(" · %.2f× as often", r)
		} else {
			s += fmt.Sprintf(" · %.1f× as often", r)
		}
	}
	return s + "\n"
}

// outcomesMarkdown is the "## Outcomes" section of PROVENANCE.md, or "".
func outcomesMarkdown(o *outcomes.Summary) string {
	if o == nil {
		return ""
	}
	c, which := o.Headline()
	if c.AILines == 0 && c.HumanLines == 0 {
		return ""
	}
	var b strings.Builder
	b.WriteString("## Outcomes\n\n")
	if which == "strict" {
		b.WriteString("What happened to the code after it landed — AI-written and human-written lines from the **same** line-attested commits, so author, style and era are held constant.\n\n")
	} else {
		b.WriteString("What happened to the code after it landed — across all commits. Undeclared AI counts as human here, so the AI figures are a floor.\n\n")
	}
	b.WriteString("| | Lines | Later reworked | In a fix/revert | Median commits until rework |\n|---|---|---|---|---|\n")
	fmt.Fprintf(&b, "| AI-written | %d | %d (%d%%) | %d | %d |\n", c.AILines, c.AIReworked, pct(c.AIRate()), c.AIInFix, c.AIMedianCommits)
	fmt.Fprintf(&b, "| Human-written | %d | %d (%d%%) | %d | %d |\n\n", c.HumanLines, c.HumanReworked, pct(c.HumanRate()), c.HumanInFix, c.HumanMedianCommits)
	switch {
	case !c.Valid():
		fmt.Fprintf(&b, "<sub>Not enough lines on both sides for a verdict yet (need %d each).</sub>\n\n", outcomes.MinLines)
	case c.Ratio() > 0:
		fmt.Fprintf(&b, "**AI-written lines were reworked %.1f× as often as human-written ones.**\n\n", c.Ratio())
	}
	return b.String()
}
