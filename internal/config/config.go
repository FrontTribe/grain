// Package config loads .grain.toml. It intentionally parses only the small,
// flat subset grain uses, with a tolerant hand-written reader, so grain stays
// dependency-free. Unknown keys and [sections] are ignored.
package config

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

type Config struct {
	AIThreshold float64  // policy: attention when AI share exceeds this
	HumanOwned  []string // glob-ish paths that should stay human-authored
	Agents      []string // AI agent names recognized in trailers/authors
	BotAuthors  []string // author patterns treated as bots
	Inference        bool   // whether behavioral inference runs
	ContentClassifier bool  // use the content classifier for the inferred path
	Output           string // human-readable report filename
}

// Default returns grain's built-in defaults, used when no .grain.toml is found.
func Default() Config {
	return Config{
		AIThreshold: 0.40,
		HumanOwned:  nil,
		Agents:      []string{"claude", "copilot", "cursor", "codex", "devin", "aider", "cody", "chatgpt", "gpt", "gemini", "tabnine"},
		BotAuthors:  []string{"[bot]", "bot@"},
		Inference:   true,
		Output:      "PROVENANCE.md",
	}
}

// Load reads <root>/.grain.toml over the defaults. A missing file is not an error.
func Load(root string) (Config, error) {
	cfg := Default()
	path := filepath.Join(root, ".grain.toml")
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return cfg, nil
		}
		return cfg, err
	}
	for _, raw := range strings.Split(string(data), "\n") {
		line := strings.TrimSpace(raw)
		if line == "" || strings.HasPrefix(line, "#") || strings.HasPrefix(line, "[") {
			continue
		}
		key, val, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		val = trimComment(strings.TrimSpace(val))
		switch key {
		case "ai_threshold", "require_review_over":
			if f, err := strconv.ParseFloat(val, 64); err == nil {
				cfg.AIThreshold = f
			}
		case "human_owned":
			cfg.HumanOwned = parseList(val)
		case "agents":
			if l := parseList(val); len(l) > 0 {
				cfg.Agents = l
			}
		case "bot_authors":
			if l := parseList(val); len(l) > 0 {
				cfg.BotAuthors = l
			}
		case "inference":
			cfg.Inference = val == "true"
		case "content_classifier":
			cfg.ContentClassifier = val == "true"
		case "output":
			cfg.Output = unquote(val)
		}
	}
	return cfg, nil
}

func parseList(val string) []string {
	val = strings.TrimSpace(val)
	val = strings.TrimPrefix(val, "[")
	val = strings.TrimSuffix(val, "]")
	var out []string
	for _, part := range strings.Split(val, ",") {
		if s := unquote(strings.TrimSpace(part)); s != "" {
			out = append(out, s)
		}
	}
	return out
}

func unquote(s string) string {
	s = strings.TrimSpace(s)
	s = strings.Trim(s, `"'`)
	return s
}

func trimComment(s string) string {
	// strip a trailing " # comment" that is not inside quotes/brackets
	if strings.HasPrefix(s, "[") || strings.HasPrefix(s, `"`) {
		return s
	}
	if i := strings.Index(s, "#"); i >= 0 {
		return strings.TrimSpace(s[:i])
	}
	return s
}
