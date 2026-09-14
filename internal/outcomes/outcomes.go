// Package outcomes measures what happened to code after it was written: how
// often AI-written lines are later reworked (deleted or rewritten) compared to
// human-written lines in the same repository. It needs nothing but git history
// and grain's own provenance (attested notes, declared trailers) — no tickets,
// no CI, no external data — so every repo can answer "is AI code actually a
// problem here?" for itself.
package outcomes

import (
	"crypto/sha256"
	"encoding/hex"
	"regexp"
	"sort"
	"strings"

	"github.com/FrontTribe/grain/internal/config"
	"github.com/FrontTribe/grain/internal/gitlog"
	"github.com/FrontTribe/grain/internal/signal"
)

// LineHash is the content identity grain uses for a line everywhere (attest,
// blame, outcomes): sha256 of the trimmed text, first 10 hex chars. Content-
// based, so it survives the line moving; a rewrite gets a new hash.
func LineHash(line string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(line)))
	return hex.EncodeToString(sum[:])[:10]
}

// Substantive filters out lines that carry no authorship signal ("}", ")").
func Substantive(line string) bool { return len(strings.TrimSpace(line)) > 3 }

// AIHashes reads the AI-Hashes line of a grain note into a set (nil if absent).
func AIHashes(note string) map[string]bool {
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

// MinLines is how many lines each side of a cohort needs before its rates are
// reported as meaningful. Below it, grain shows the numbers but not a verdict.
const MinLines = 30

// Cohort compares AI-written and human-written lines that were introduced in a
// set of commits: how many were later reworked, by what, and how soon.
type Cohort struct {
	AILines       int `json:"ai_lines"`
	AIReworked    int `json:"ai_reworked"`
	AIInFix       int `json:"ai_reworked_in_fix"` // reworked by a fix/revert commit
	HumanLines    int `json:"human_lines"`
	HumanReworked int `json:"human_reworked"`
	HumanInFix    int `json:"human_reworked_in_fix"`
	// median number of commits between a line landing and being reworked
	AIMedianCommits    int `json:"ai_median_commits_to_rework"`
	HumanMedianCommits int `json:"human_median_commits_to_rework"`

	aiDist, humanDist []int
}

// AIRate is the share of AI lines later reworked (0..1).
func (c Cohort) AIRate() float64 { return rate(c.AIReworked, c.AILines) }

// HumanRate is the share of human lines later reworked (0..1).
func (c Cohort) HumanRate() float64 { return rate(c.HumanReworked, c.HumanLines) }

// Ratio is AIRate / HumanRate — how many times more often AI lines get
// reworked. 0 when undefined (no human rework to compare against).
func (c Cohort) Ratio() float64 {
	h := c.HumanRate()
	if h == 0 {
		return 0
	}
	return c.AIRate() / h
}

// Valid reports whether both sides have enough lines to draw a conclusion.
func (c Cohort) Valid() bool { return c.AILines >= MinLines && c.HumanLines >= MinLines }

func rate(n, d int) float64 {
	if d == 0 {
		return 0
	}
	return float64(n) / float64(d)
}

// Summary is the outcomes block of a report.
type Summary struct {
	// Strict compares AI and human lines from the SAME commits — only commits
	// with line-level attestation (AI-Lines from `grain attest`), so style,
	// author and era are held constant. The cleanest signal when available.
	Strict Cohort `json:"strict"`
	// Broad uses every commit: AI = lines of attested/declared-AI commits,
	// human = everything else. More data, weaker labels (undeclared AI counts
	// as human), so rates are a floor.
	Broad   Cohort `json:"broad"`
	Commits int    `json:"commits"`
}

// Headline picks the cohort a reader should trust: strict when it has enough
// data, otherwise broad. The second value says which one it is.
func (s Summary) Headline() (Cohort, string) {
	if s.Strict.Valid() {
		return s.Strict, "strict"
	}
	return s.Broad, "broad"
}

var fixRe = regexp.MustCompile(`(?i)^(fix|hotfix|bugfix|revert)\b|^Revert "`)

type live struct {
	pos    int  // position in oldest→newest order
	ai     bool // written by AI
	strict bool // introduced by a line-attested commit
}

// Compute walks the history oldest→newest, tracking every substantive line by
// content hash from the commit that introduced it until a later commit removes
// it. `commits` is in git-log order (newest first), as gitlog.ReadCommits
// returns it; `added`/`removed` are per-SHA diffs from gitlog.
func Compute(commits []gitlog.Commit, added, removed map[string]map[string][]string, cfg config.Config) Summary {
	sum := Summary{Commits: len(commits)}
	alive := map[string]*live{}

	for i := len(commits) - 1; i >= 0; i-- { // oldest → newest
		c := commits[i]
		pos := len(commits) - 1 - i
		s := signal.Extract(c, cfg)
		hashes := AIHashes(c.Note)
		lineLevel := len(hashes) > 0
		wholeAI := !lineLevel && (s.AttestedClass == "ai" || s.DeclaredAI)
		isFix := fixRe.MatchString(strings.TrimSpace(c.Subject))

		// Hashes added by this commit — a removal of the same content in the
		// same commit is a move, not rework.
		addedNow := map[string]bool{}
		for _, lines := range added[c.SHA] {
			for _, l := range lines {
				if Substantive(l) {
					addedNow[LineHash(l)] = true
				}
			}
		}

		// Rework: lines this commit removed that an earlier commit introduced.
		for _, lines := range removed[c.SHA] {
			for _, l := range lines {
				if !Substantive(l) {
					continue
				}
				h := LineHash(l)
				if addedNow[h] {
					continue // moved, still alive
				}
				e, ok := alive[h]
				if !ok {
					continue
				}
				dist := pos - e.pos
				record(&sum.Broad, e.ai, isFix, dist)
				if e.strict {
					record(&sum.Strict, e.ai, isFix, dist)
				}
				delete(alive, h)
			}
		}

		// Introductions: classify each added line and start tracking it.
		for _, lines := range added[c.SHA] {
			for _, l := range lines {
				if !Substantive(l) {
					continue
				}
				h := LineHash(l)
				ai := wholeAI
				if lineLevel {
					ai = hashes[h]
				}
				alive[h] = &live{pos: pos, ai: ai, strict: lineLevel}
				count(&sum.Broad, ai)
				if lineLevel {
					count(&sum.Strict, ai)
				}
			}
		}
	}

	sum.Strict.AIMedianCommits = median(sum.Strict.aiDist)
	sum.Strict.HumanMedianCommits = median(sum.Strict.humanDist)
	sum.Broad.AIMedianCommits = median(sum.Broad.aiDist)
	sum.Broad.HumanMedianCommits = median(sum.Broad.humanDist)
	return sum
}

func count(c *Cohort, ai bool) {
	if ai {
		c.AILines++
	} else {
		c.HumanLines++
	}
}

func record(c *Cohort, ai, inFix bool, dist int) {
	if ai {
		c.AIReworked++
		if inFix {
			c.AIInFix++
		}
		c.aiDist = append(c.aiDist, dist)
	} else {
		c.HumanReworked++
		if inFix {
			c.HumanInFix++
		}
		c.humanDist = append(c.humanDist, dist)
	}
}

func median(xs []int) int {
	if len(xs) == 0 {
		return 0
	}
	s := append([]int(nil), xs...)
	sort.Ints(s)
	return s[len(s)/2]
}
