// Package security answers "did AI-written code introduce something that looks
// dangerous, and did anyone look?" It runs a deliberately small, conservative
// set of line patterns (secrets, disabled TLS, shell/SQL built from strings,
// unsafe deserialization, wildcard IAM, …) over added lines and joins each hit
// with grain's provenance: AI-written or not, review evidence or not, critical
// path or not. It is not a scanner that finds vulnerabilities; it is the
// provenance layer pointing at the lines worth a second look. Signals, not
// verdicts.
//
// The patterns live in patterns.json (RE2 and JavaScript compatible) so the
// Cloud scanner runs the identical set; a test keeps the two copies equal.
package security

import (
	_ "embed"
	"encoding/json"
	"regexp"
	"sort"
	"strings"
	"sync"

	"github.com/FrontTribe/grain/internal/config"
	"github.com/FrontTribe/grain/internal/gitlog"
	"github.com/FrontTribe/grain/internal/outcomes"
	"github.com/FrontTribe/grain/internal/risk"
	"github.com/FrontTribe/grain/internal/signal"
)

//go:embed patterns.json
var PatternsJSON []byte

type patternSpec struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Severity string `json:"severity"`
	Re       string `json:"re"`
	Flags    string `json:"flags"`
	Unless   string `json:"unless"`
	Paths    string `json:"paths"`
	Redact   bool   `json:"redact"`
	Once     bool   `json:"once"` // report at most once per file (e.g. a whole .env file)
	Note     string `json:"note"`
}

// Pattern is one compiled rule.
type Pattern struct {
	ID       string
	Title    string
	Severity string // "high" | "medium"
	Note     string
	Redact   bool
	Once     bool
	re       *regexp.Regexp
	unless   *regexp.Regexp
	paths    *regexp.Regexp
}

var (
	loadOnce sync.Once
	patterns []Pattern
)

// Patterns returns the compiled rule set.
func Patterns() []Pattern {
	loadOnce.Do(func() {
		var specs []patternSpec
		if err := json.Unmarshal(PatternsJSON, &specs); err != nil {
			panic("security: patterns.json: " + err.Error())
		}
		for _, s := range specs {
			p := Pattern{ID: s.ID, Title: s.Title, Severity: s.Severity, Note: s.Note, Redact: s.Redact, Once: s.Once}
			re := s.Re
			if strings.Contains(s.Flags, "i") {
				re = "(?i)" + re
			}
			p.re = regexp.MustCompile(re)
			if s.Unless != "" {
				p.unless = regexp.MustCompile("(?i)" + s.Unless)
			}
			if s.Paths != "" {
				p.paths = regexp.MustCompile("(?i)" + s.Paths)
			}
			patterns = append(patterns, p)
		}
	})
	return patterns
}

var (
	// Lines that are commentary or that *define* one of these patterns (grain's
	// own source, a linter config) are not findings.
	commentLine = regexp.MustCompile(`^\s*(//|#|\*|/\*|--|<!--)`)
	defineLine  = regexp.MustCompile(`regexp\.MustCompile\(|new RegExp\(|re\.compile\(|"re":\s*"`)
	// Test and fixture paths carry fake secrets and deliberately bad examples;
	// prose (markdown, text) talks about dangerous lines without being code.
	testPath = regexp.MustCompile(`(?i)(^|/)(test|tests|__tests__|spec|specs|fixtures?|testdata|mocks?|examples?)(/|$)|_test\.go$|\.(test|spec)\.[jt]sx?$|\.snap$|\.(md|mdx|markdown|rst|txt|adoc)$`)
)

// Skip reports whether a path is out of scope for findings (tests, fixtures).
func Skip(path string) bool { return testPath.MatchString(path) }

// Check returns the patterns a single added line trips, for a file at path.
func Check(path, line string) []Pattern {
	if Skip(path) || commentLine.MatchString(line) || defineLine.MatchString(line) {
		return nil
	}
	var hits []Pattern
	for _, p := range Patterns() {
		if p.paths != nil && !p.paths.MatchString(path) {
			continue
		}
		if !p.re.MatchString(line) {
			continue
		}
		if p.unless != nil && p.unless.MatchString(line) {
			continue
		}
		hits = append(hits, p)
	}
	return hits
}

// Excerpt is the line as it may appear in a report: trimmed, capped, and with
// the matched secret reduced to its first characters when the pattern says so.
func Excerpt(p Pattern, line string) string {
	s := strings.TrimSpace(line)
	if p.Redact {
		s = p.re.ReplaceAllStringFunc(s, func(m string) string {
			if len(m) <= 8 {
				return "…"
			}
			return m[:6] + "…"
		})
	}
	if len(s) > 120 {
		s = s[:117] + "…"
	}
	return s
}

// Finding is one line that tripped a pattern, with its provenance.
type Finding struct {
	Pattern  string `json:"pattern"`
	Title    string `json:"title"`
	Severity string `json:"severity"`
	Path     string `json:"path"`
	SHA      string `json:"sha"`
	Subject  string `json:"subject"`
	Excerpt  string `json:"excerpt"`
	AI       bool   `json:"ai"`       // the line is AI-written (attested or declared)
	Reviewed bool   `json:"reviewed"` // the commit carries review evidence
	Critical string `json:"critical"` // the critical-path pattern it landed in, or ""
	Note     string `json:"note"`
}

// PatternCount is the per-rule roll-up.
type PatternCount struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Severity string `json:"severity"`
	AI       int    `json:"ai"`
	Human    int    `json:"human"`
}

// Summary is the security block of a report.
type Summary struct {
	Total            int            `json:"total"`
	AI               int            `json:"ai"`                  // findings in AI-written lines
	AIUnreviewed     int            `json:"ai_unreviewed"`       // of those, no review evidence
	AICriticalUnrev  int            `json:"ai_critical_unreviewed"` // and in a critical path: the headline
	Human            int            `json:"human"`
	ByPattern        []PatternCount `json:"by_pattern"`
	Findings         []Finding      `json:"findings"` // worst first, capped
	Commits          int            `json:"commits"`
	Source           string         `json:"source"`
}

const maxFindings = 50

// Compute runs the patterns over every added line and joins each hit with
// provenance, mirroring risk.Compute's attribution so the two blocks agree on
// which lines are AI-written and which commits carry review evidence.
func Compute(commits []gitlog.Commit, added map[string]map[string][]string, firstParent map[string]bool, critical []string, cfg config.Config) Summary {
	if len(critical) == 0 {
		critical = risk.DefaultCritical
	}
	sum := Summary{Commits: len(commits), Source: "cli"}
	byPat := map[string]*PatternCount{}
	var all []Finding

	for _, c := range commits {
		files := added[c.SHA]
		if len(files) == 0 {
			continue
		}
		s := signal.Extract(c, cfg)
		hashes := outcomes.AIHashes(c.Note)
		lineLevel := len(hashes) > 0
		wholeAI := !lineLevel && (s.AttestedClass == "ai" || s.DeclaredAI)
		reviewed := risk.Reviewed(c, firstParent)

		for path, lines := range files {
			if Skip(path) {
				continue
			}
			crit, _ := risk.Matches(path, critical)
			seenOnce := map[string]bool{}
			for _, l := range lines {
				for _, p := range Check(path, l) {
					if p.Once {
						if seenOnce[p.ID] {
							continue
						}
						seenOnce[p.ID] = true
					}
					ai := wholeAI || (lineLevel && outcomes.Substantive(l) && hashes[outcomes.LineHash(l)])
					f := Finding{
						Pattern: p.ID, Title: p.Title, Severity: p.Severity, Note: p.Note,
						Path: path, SHA: c.SHA, Subject: strings.TrimSpace(c.Subject),
						Excerpt: Excerpt(p, l), AI: ai, Reviewed: reviewed, Critical: crit,
					}
					if p.Once {
						f.Excerpt = ""
					}
					all = append(all, f)
					sum.Total++
					pc := byPat[p.ID]
					if pc == nil {
						pc = &PatternCount{ID: p.ID, Title: p.Title, Severity: p.Severity}
						byPat[p.ID] = pc
					}
					if ai {
						sum.AI++
						pc.AI++
						if !reviewed {
							sum.AIUnreviewed++
							if crit != "" {
								sum.AICriticalUnrev++
							}
						}
					} else {
						sum.Human++
						pc.Human++
					}
				}
			}
		}
	}

	for _, pc := range byPat {
		sum.ByPattern = append(sum.ByPattern, *pc)
	}
	sort.Slice(sum.ByPattern, func(i, j int) bool {
		a, b := sum.ByPattern[i], sum.ByPattern[j]
		if a.AI != b.AI {
			return a.AI > b.AI
		}
		return a.ID < b.ID
	})
	// Worst first: AI + unreviewed + critical, then severity, then AI, then recency.
	sort.SliceStable(all, func(i, j int) bool {
		return rank(all[i]) > rank(all[j])
	})
	if len(all) > maxFindings {
		all = all[:maxFindings]
	}
	sum.Findings = all
	return sum
}

func rank(f Finding) int {
	r := 0
	if f.AI {
		r += 8
	}
	if !f.Reviewed {
		r += 4
	}
	if f.Critical != "" {
		r += 2
	}
	if f.Severity == "high" {
		r++
	}
	return r
}
