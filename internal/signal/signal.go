// Package signal extracts authorship signals from a commit. It is the honest
// core of grain: declared signals (machine evidence) are separated from
// inferred ones (behavioral tells), and the two are never conflated.
package signal

import (
	"strconv"
	"strings"

	"github.com/FrontTribe/grain/internal/config"
	"github.com/FrontTribe/grain/internal/gitlog"
)

// Set is the result of reading one commit's signals.
type Set struct {
	Declared      []string // human-readable declared signals found (may be empty)
	DeclaredAI    bool     // a machine-declared AI signal is present
	DeclaredHuman bool     // an explicit human attestation is present (git note)
	AttestedClass string   // "" | "ai" | "human": authoritative provenance from a git note
	HumanCoauth   bool     // a human (non-agent) co-author trailer is present
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

	// 3) Attested provenance from a git note (authoritative). A tool or a human
	// records provenance on refs/notes/grain; grain treats it as ground truth.
	for _, raw := range strings.Split(c.Note, "\n") {
		line := strings.TrimSpace(raw)
		key, val, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		k := strings.ToLower(strings.TrimSpace(key))
		v := strings.TrimSpace(val)
		lv := lower(v)
		switch k {
		case "provenance":
			switch lv {
			case "ai", "ai-authored", "ai_authored", "assisted", "ai-assisted":
				s.attestAI("note: Provenance " + v)
			case "human", "human-authored", "manual":
				s.attestHuman("note: Provenance " + v)
			}
		case "ai-authored":
			if truthy(v) {
				s.attestAI("note: AI-Authored " + v)
			} else if f, err := strconv.ParseFloat(v, 64); err == nil {
				if f > 0.5 {
					s.attestAI("note: AI-Authored " + v)
				} else {
					s.attestHuman("note: AI-Authored " + v)
				}
			}
		case "human-authored":
			if truthy(v) {
				s.attestHuman("note: Human-Authored " + v)
			}
		case "co-authored-by", "generated-by", "assisted-by":
			if _, ok := isAgent(v); ok || truthy(v) {
				s.attestAI("note: " + strings.TrimSpace(key) + " " + v)
			}
		case "ai-assisted":
			if truthy(v) {
				s.attestAI("note: AI-Assisted " + v)
			}
		}
	}

	return s
}

func (s *Set) attestAI(label string) {
	s.DeclaredAI = true
	s.AttestedClass = "ai"
	s.Declared = append(s.Declared, label)
}

func (s *Set) attestHuman(label string) {
	s.DeclaredHuman = true
	s.AttestedClass = "human"
	s.Declared = append(s.Declared, label)
}

func truthy(v string) bool {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "true", "yes", "1", "on":
		return true
	}
	return false
}
