// Package signal extracts authorship signals from a commit. It is the honest
// core of grain: declared signals (machine evidence) are separated from
// inferred ones (behavioral tells), and the two are never conflated.
package signal

import (
	"strings"

	"github.com/FrontTribe/grain/internal/config"
	"github.com/FrontTribe/grain/internal/gitlog"
)

// Set is the result of reading one commit's signals.
type Set struct {
	Declared    []string // human-readable declared signals found (may be empty)
	DeclaredAI  bool     // a machine-declared AI signal is present
	HumanCoauth bool     // a human (non-agent) co-author trailer is present
}

// Extract reads declared signals from a commit against the configured agents.
func Extract(c gitlog.Commit, cfg config.Config) Set {
	var s Set
	lower := func(v string) string { return strings.ToLower(v) }

	isAgent := func(v string) (string, bool) {
		lv := lower(v)
		for _, a := range cfg.Agents {
			if a != "" && strings.Contains(lv, strings.ToLower(a)) {
				return a, true
			}
		}
		return "", false
	}

	// 1) Trailers in the commit body.
	for _, raw := range strings.Split(c.Body, "\n") {
		line := strings.TrimSpace(raw)
		if line == "" {
			continue
		}
		key, val, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		k := strings.ToLower(strings.TrimSpace(key))
		v := strings.TrimSpace(val)
		switch k {
		case "co-authored-by":
			if agent, ok := isAgent(v); ok {
				s.DeclaredAI = true
				s.Declared = append(s.Declared, "Co-Authored-By: "+agent)
			} else {
				s.HumanCoauth = true
			}
		case "generated-by", "assisted-by":
			if _, ok := isAgent(v); ok || truthy(v) {
				s.DeclaredAI = true
				s.Declared = append(s.Declared, strings.TrimSpace(key)+": "+v)
			}
		case "ai-assisted":
			if truthy(v) {
				s.DeclaredAI = true
				s.Declared = append(s.Declared, "AI-Assisted: "+v)
			}
		}
	}

	// 2) Author / committer identity looks like a bot or a known agent.
	for _, id := range []string{c.AuthorName, c.AuthorEmail, c.CommitterName, c.CommitterEmail} {
		li := lower(id)
		for _, m := range cfg.BotAuthors {
			// Patterns may be globs like "*[bot]"; treat '*' as a wildcard so a
			// bare-substring match works (the '*' was previously matched literally,
			// so "*[bot]" never matched "dependabot[bot]").
			pat := strings.ToLower(strings.Trim(m, "*"))
			if pat != "" && strings.Contains(li, pat) {
				s.DeclaredAI = true
				s.Declared = append(s.Declared, "bot identity: "+id)
				break
			}
		}
		if agent, ok := isAgent(id); ok {
			s.DeclaredAI = true
			s.Declared = append(s.Declared, "agent identity: "+agent)
		}
	}

	return s
}

func truthy(v string) bool {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "true", "yes", "1", "on":
		return true
	}
	return false
}
