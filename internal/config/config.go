// Package config loads .grain.toml. It intentionally parses only the small,
// flat subset grain uses, with a tolerant hand-written reader, so grain stays
// dependency-free. Unknown keys and [sections] are ignored.
package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

type Config struct {
	AIThreshold float64  // policy: attention when AI share exceeds this
	HumanOwned  []string // glob-ish paths that should stay human-authored
	Critical    []string // paths where unreviewed AI code is a risk (empty → built-in list + HumanOwned)
	Agents      []string // AI agent names recognized in trailers/authors
	BotAuthors  []string // author patterns treated as bots
	Inference        bool   // whether behavioral inference runs
	ContentClassifier bool  // use the content classifier for the inferred path
	Output           string // human-readable report filename

	// Per-repo calibrated classifier weights, loaded from .grain/model.json when
	// present (written by `grain calibrate`). Empty → the built-in default model.
	ModelWeights []float64
	ModelBias    float64
	HasModel     bool
}

// Default returns grain's built-in defaults, used when no .grain.toml is found.
func Default() Config {
	return Config{
		AIThreshold: 0.40,
		HumanOwned:  nil,
		Agents:      []string{"claude", "copilot", "cursor", "codex", "devin", "aider", "cody", "chatgpt", "gpt", "gemini", "tabnine"},
		BotAuthors:  []string{"[bot]", "bot@"},
		Inference:   true,
		// On by default so the CLI and Grain Cloud agree: the inferred tier runs
		// the content classifier (a conservative global prior, capped at 0.70 and
		// labelled a guess; `grain calibrate` refines it per repo). Set
		// content_classifier = false in .grain.toml for declared-only scans.
		ContentClassifier: true,
		Output:            "PROVENANCE.md",
	}
}

// Load reads <root>/.grain.toml over the defaults. A missing file is not an error.
func Load(root string) (Config, error) {
	cfg := Default()
	path := filepath.Join(root, ".grain.toml")
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			loadModel(root, &cfg) // calibrated weights can exist without a .grain.toml
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
		case "critical":
			cfg.Critical = parseList(val)
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
	loadModel(root, &cfg)
	return cfg, nil
}

// loadModel reads per-repo calibrated weights from <root>/.grain/model.json,
// written by `grain calibrate`. A missing/invalid file leaves the default model.
func loadModel(root string, cfg *Config) {
	data, err := os.ReadFile(filepath.Join(root, ".grain", "model.json"))
	if err != nil {
		return
	}
	var m struct {
		Weights []float64 `json:"weights"`
		Bias    float64   `json:"bias"`
	}
	if json.Unmarshal(data, &m) != nil || len(m.Weights) == 0 {
		return
	}
	cfg.ModelWeights = m.Weights
	cfg.ModelBias = m.Bias
	cfg.HasModel = true
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
