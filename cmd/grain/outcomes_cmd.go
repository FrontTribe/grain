package main

import (
	"context"

	"github.com/FrontTribe/grain/internal/config"
	"github.com/FrontTribe/grain/internal/deps"
	"github.com/FrontTribe/grain/internal/gitlog"
	"github.com/FrontTribe/grain/internal/outcomes"
	"github.com/FrontTribe/grain/internal/report"
	"github.com/FrontTribe/grain/internal/risk"
	"github.com/FrontTribe/grain/internal/security"
)

// attachOutcomes adds the two post-hoc analyses to a report: Outcomes (how
// often AI vs human lines get reworked) and Risk (AI lines in critical paths
// without review evidence). Both need every diff's added lines regardless of
// whether the classifier is on, so it reads them when scan didn't. Best-effort:
// a git failure just leaves the block out. rev scopes every read to a commit
// range (`grain check`); "" means the whole history.
func attachOutcomes(rep *report.Report, root, rev string, max int, commits []gitlog.Commit, added map[string]map[string][]string, cfg config.Config, checkRegistry bool) {
	if added == nil {
		var err error
		if added, err = gitlog.ReadAddedLines(root, rev, max); err != nil {
			return
		}
	}

	// grain's own generated outputs are rewritten on every scan; their churn is
	// noise, not authorship — keep them out of both analyses.
	skip := map[string]bool{"grain.json": true}
	if cfg.Output != "" {
		skip[cfg.Output] = true
	}
	added = without(added, skip)

	if removed, err := gitlog.ReadRemovedLines(root, rev, max); err == nil {
		o := outcomes.Compute(commits, added, without(removed, skip), cfg)
		rep.Outcomes = &o
	}

	// Critical paths: the built-in security/money list unless the repo sets
	// `critical = [...]`, plus its human_owned paths either way.
	patterns := cfg.Critical
	if len(patterns) == 0 {
		patterns = risk.DefaultCritical
	}
	patterns = append(append([]string{}, patterns...), cfg.HumanOwned...)
	firstParent := gitlog.FirstParentSet(root, rev, max)
	r := risk.Compute(commits, added, firstParent, patterns, cfg)
	rep.Risk = &r

	// Security: the same added lines through the danger patterns, joined with
	// the same provenance and review evidence.
	sec := security.Compute(commits, added, firstParent, patterns, cfg)
	rep.Security = &sec

	// Dependencies the range added, attributed the same way; registries only
	// when asked (local-first: nothing leaves the machine by default).
	d := deps.Compute(context.Background(), commits, added, firstParent, cfg, checkRegistry)
	rep.Deps = &d
}

// without returns a copy of a per-commit diff map with the given paths dropped.
func without(m map[string]map[string][]string, skip map[string]bool) map[string]map[string][]string {
	out := make(map[string]map[string][]string, len(m))
	for sha, files := range m {
		kept := make(map[string][]string, len(files))
		for p, lines := range files {
			if !skip[p] {
				kept[p] = lines
			}
		}
		if len(kept) > 0 {
			out[sha] = kept
		}
	}
	return out
}
