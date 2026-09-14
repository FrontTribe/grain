package report

import (
	"fmt"

	"github.com/FrontTribe/grain/internal/deps"
)

// Gate is one policy gate `grain check` evaluated and found something for:
// the config key it came from, whether the mode blocks or only warns, and a
// one-line reason in the report's own words. A gate with nothing to say is not
// returned at all, so callers can range over Gates and print each one.
type Gate struct {
	Key    string // "security" | "dependencies"
	Block  bool   // mode was "block"; the check fails on this gate
	Reason string
}

// Gates is the list of gates that fired.
type Gates []Gate

// Blocked reports whether any fired gate is a blocking one.
func (g Gates) Blocked() bool {
	for _, x := range g {
		if x.Block {
			return true
		}
	}
	return false
}

// Gates evaluates the security and dependency gates against the report's
// blocks. Modes are "off" | "warn" | "block"; anything else counts as "off".
//
// The security gate fires on findings in AI-written lines: a human-written
// dangerous line is your SAST's job, an AI-written one is exactly what
// provenance can say something about. The dependency gate fires on a package
// its registry does not know (the slopsquatting seed) or one that is both
// young and AI-added. Neither depends on review evidence: in a PR check the
// review is what the gate is asking for.
func (r Report) Gates(securityMode, depsMode string) Gates {
	var out Gates
	if s := r.Security; s != nil && gateOn(securityMode) && s.AI > 0 {
		reason := fmt.Sprintf("%d security %s in AI-written lines", s.AI, plural(s.AI, "finding", "findings"))
		if s.AICriticalUnrev > 0 {
			reason += fmt.Sprintf(", %d in a critical path", s.AICriticalUnrev)
		}
		out = append(out, Gate{Key: "security", Block: securityMode == "block", Reason: reason})
	}
	if d := r.Deps; d != nil && gateOn(depsMode) && d.Checked {
		youngAI := youngAIDeps(d)
		if d.Missing > 0 || youngAI > 0 {
			var parts []string
			if d.Missing > 0 {
				parts = append(parts, fmt.Sprintf("%d added %s not on the registry", d.Missing, plural(d.Missing, "dependency", "dependencies")))
			}
			if youngAI > 0 {
				parts = append(parts, fmt.Sprintf("%d AI-added %s younger than %d days", youngAI, plural(youngAI, "package", "packages"), deps.YoungDays))
			}
			reason := parts[0]
			if len(parts) == 2 {
				reason = parts[0] + ", " + parts[1]
			}
			out = append(out, Gate{Key: "dependencies", Block: depsMode == "block", Reason: reason})
		}
	}
	return out
}

func gateOn(mode string) bool { return mode == "warn" || mode == "block" }

// youngAIDeps counts checked, existing packages younger than deps.YoungDays
// that an AI-written line added: new packages happen, but a new package an
// agent reached for is the one to look at.
func youngAIDeps(d *deps.Summary) int {
	n := 0
	for _, x := range d.Deps {
		if x.AI && x.Checked && x.Exists && x.AgeDays >= 0 && x.AgeDays < deps.YoungDays {
			n++
		}
	}
	return n
}
