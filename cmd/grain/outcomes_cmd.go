package main

import (
	"github.com/FrontTribe/grain/internal/config"
	"github.com/FrontTribe/grain/internal/gitlog"
	"github.com/FrontTribe/grain/internal/outcomes"
	"github.com/FrontTribe/grain/internal/report"
)

// attachOutcomes adds the rework analysis to a report. It needs both sides of
// every diff regardless of whether the content classifier is on, so it reads
// the removed lines itself and reuses the added lines when scan already has
// them. Best-effort: a git failure just leaves the block out.
func attachOutcomes(rep *report.Report, root string, max int, commits []gitlog.Commit, added map[string]map[string][]string, cfg config.Config) {
	if added == nil {
		var err error
		if added, err = gitlog.ReadAddedLines(root, "", max); err != nil {
			return
		}
	}
	removed, err := gitlog.ReadRemovedLines(root, "", max)
	if err != nil {
		return
	}
	o := outcomes.Compute(commits, added, removed, cfg)
	rep.Outcomes = &o
}
