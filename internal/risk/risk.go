// Package risk answers "where does AI-written code carry the most risk?":
// AI lines that landed in critical paths without any evidence of review. It
// turns a percentage into something a lead can act on — the specific paths and
// commits — using only git history and grain's provenance.
package risk

import (
	"regexp"
	"sort"
	"strings"

	"github.com/FrontTribe/grain/internal/config"
	"github.com/FrontTribe/grain/internal/gitlog"
	"github.com/FrontTribe/grain/internal/outcomes"
	"github.com/FrontTribe/grain/internal/signal"
)

// DefaultCritical is the built-in list of security- and money-sensitive path
// fragments, matched case-insensitively against each path segment. A repo's
// human_owned paths and any `critical = [...]` patterns are added on top.
var DefaultCritical = []string{
	"auth", "authn", "authz", "login", "session", "token", "secret", "secrets",
	"crypto", "password", "payment", "payments", "billing", "checkout", "iam",
	"permission", "permissions", "migration", "migrations", "infra", "terraform",
	"k8s", "helm", "deploy", "workflows", "dockerfile",
}

// Path is one critical path's exposure.
type Path struct {
	Path       string `json:"path"`          // the matched pattern
	AILines    int    `json:"ai_lines"`      // AI-written lines landed here
	Unreviewed int    `json:"ai_unreviewed"` // of those, with no review evidence
	Commits    int    `json:"commits"`       // commits that put AI lines here
}

// Hotspot is a single commit that put unreviewed AI lines into a critical path.
type Hotspot struct {
	SHA     string `json:"sha"`
	Subject string `json:"subject"`
	Path    string `json:"path"`
	AILines int    `json:"ai_lines"`
}

// Summary is the risk block of a report.
type Summary struct {
	AILines            int       `json:"ai_lines"`               // all AI-written lines in range
	AIUnreviewed       int       `json:"ai_unreviewed"`          // anywhere, no review evidence
	CriticalAILines    int       `json:"critical_ai_lines"`      // in critical paths
	CriticalUnreviewed int       `json:"critical_ai_unreviewed"` // the headline number
	Critical           []Path    `json:"critical"`               // per path, worst first
	Top                []Hotspot `json:"top"`                    // worst commits, up to 10
	Patterns           []string  `json:"patterns"`               // what counted as critical
	ReviewedCommits    int       `json:"reviewed_commits"`
	UnreviewedCommits  int       `json:"unreviewed_commits"`
}

// UnreviewedShare is the share of AI lines in critical paths that had no
// review evidence (0..1); 0 when there are none.
func (s Summary) UnreviewedShare() float64 {
	if s.CriticalAILines == 0 {
		return 0
	}
	return float64(s.CriticalUnreviewed) / float64(s.CriticalAILines)
}

var (
	reviewedTrailer = regexp.MustCompile(`(?im)^\s*(reviewed-by|reviewed-on|approved-by):`)
	squashSubject   = regexp.MustCompile(`\(#\d+\)\s*$`)
	mergeSubject    = regexp.MustCompile(`^Merge (pull request|branch)\b`)
)

// Reviewed reports whether a commit carries evidence of having gone through
// review. Git can't see approvals, so this is the union of the signals it does
// leave: a Reviewed-by/Approved-by trailer, a squash-merge subject "(#123)", a
// merge subject, arriving via a merge (not on the first-parent chain), or being
// applied by someone other than the author (committer ≠ author, as with
// GitHub's merge button). Absence is "no evidence", not proof of no review.
func Reviewed(c gitlog.Commit, firstParent map[string]bool) bool {
	if reviewedTrailer.MatchString(c.Body) {
		return true
	}
	subj := strings.TrimSpace(c.Subject)
	if squashSubject.MatchString(subj) || mergeSubject.MatchString(subj) {
		return true
	}
	if len(firstParent) > 0 && !firstParent[c.SHA] {
		return true // came in through a merge
	}
	if c.CommitterEmail != "" && c.AuthorEmail != "" && !strings.EqualFold(c.CommitterEmail, c.AuthorEmail) {
		return true
	}
	return false
}

// Matches reports which pattern (if any) a file path is critical under.
// Explicit patterns (human_owned, critical) match as path prefixes the way the
// policy does ("src/auth/**"); built-in fragments match whole path segments or
// file stems, case-insensitively, so "auth" hits src/auth/ and auth.go but not
// author.go.
func Matches(path string, patterns []string) (string, bool) {
	lower := strings.ToLower(path)
	segs := strings.Split(lower, "/")
	for _, pat := range patterns {
		p := strings.ToLower(strings.TrimSpace(pat))
		if p == "" {
			continue
		}
		if strings.ContainsAny(p, "/*") {
			base := strings.TrimSuffix(strings.TrimSuffix(strings.TrimSuffix(p, "/**"), "/*"), "/")
			if base != "" && (lower == base || strings.HasPrefix(lower, base+"/")) {
				return pat, true
			}
			continue
		}
		for _, seg := range segs {
			stem := seg
			if i := strings.LastIndexByte(seg, '.'); i > 0 {
				stem = seg[:i]
			}
			if seg == p || stem == p {
				return pat, true
			}
		}
	}
	return "", false
}

// Compute walks the commits and attributes every AI-written line to the file
// it landed in, then rolls up by critical pattern. `added` is the per-SHA diff
// from gitlog (needed to tell which lines are AI when attestation is line-level).
func Compute(commits []gitlog.Commit, added map[string]map[string][]string, firstParent map[string]bool, patterns []string, cfg config.Config) Summary {
	if len(patterns) == 0 {
		patterns = DefaultCritical
	}
	sum := Summary{Patterns: patterns}
	byPath := map[string]*Path{}
	seenPathCommit := map[string]bool{}
	var hot []Hotspot

	for _, c := range commits {
		s := signal.Extract(c, cfg)
		hashes := outcomes.AIHashes(c.Note)
		lineLevel := len(hashes) > 0
		wholeAI := !lineLevel && (s.AttestedClass == "ai" || s.DeclaredAI)
		if !lineLevel && !wholeAI {
			continue // no AI lines to attribute
		}
		reviewed := Reviewed(c, firstParent)
		if reviewed {
			sum.ReviewedCommits++
		} else {
			sum.UnreviewedCommits++
		}

		files := added[c.SHA]
		for path, lines := range files {
			n := 0
			for _, l := range lines {
				if !outcomes.Substantive(l) {
					continue
				}
				if wholeAI || hashes[outcomes.LineHash(l)] {
					n++
				}
			}
			if n == 0 {
				continue
			}
			sum.AILines += n
			if !reviewed {
				sum.AIUnreviewed += n
			}
			pat, crit := Matches(path, patterns)
			if !crit {
				continue
			}
			sum.CriticalAILines += n
			ps := byPath[pat]
			if ps == nil {
				ps = &Path{Path: pat}
				byPath[pat] = ps
			}
			ps.AILines += n
			if !seenPathCommit[pat+"\x00"+c.SHA] {
				seenPathCommit[pat+"\x00"+c.SHA] = true
				ps.Commits++
			}
			if !reviewed {
				sum.CriticalUnreviewed += n
				ps.Unreviewed += n
				hot = append(hot, Hotspot{SHA: c.SHA, Subject: strings.TrimSpace(c.Subject), Path: pat, AILines: n})
			}
		}
	}

	for _, ps := range byPath {
		sum.Critical = append(sum.Critical, *ps)
	}
	sort.Slice(sum.Critical, func(i, j int) bool {
		if sum.Critical[i].Unreviewed != sum.Critical[j].Unreviewed {
			return sum.Critical[i].Unreviewed > sum.Critical[j].Unreviewed
		}
		return sum.Critical[i].AILines > sum.Critical[j].AILines
	})
	sort.Slice(hot, func(i, j int) bool { return hot[i].AILines > hot[j].AILines })
	if len(hot) > 10 {
		hot = hot[:10]
	}
	sum.Top = hot
	return sum
}
