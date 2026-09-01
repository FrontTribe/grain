// Package score turns a commit's signals into a classification. It enforces
// grain's core rule: declared signals may reach high confidence; inferred
// signals are capped, so grain never sounds certain when it is guessing.
package score

import (
	"math"
	"regexp"
	"strings"

	"github.com/FrontTribe/grain/internal/config"
	"github.com/FrontTribe/grain/internal/gitlog"
	"github.com/FrontTribe/grain/internal/signal"
)

// InferredConfidenceCap is the hard ceiling on confidence for behavioral
// inference. It is a product principle, not a tuning constant.
const InferredConfidenceCap = 0.70

// Class buckets for display.
const (
	Human        = "human"
	AIAssisted   = "ai_assisted"
	AIAuthored   = "ai_authored"
	Unclassified = "unclassified"
)

// Result is the classification of one commit.
type Result struct {
	SHA          string
	AILikelihood float64
	Confidence   float64
	Basis        string // "declared" | "inferred"
	Class        string
	Signals      []string
	Lines        int
}

// IsAI reports whether the class counts as AI for aggregation.
func (r Result) IsAI() bool { return r.Class == AIAssisted || r.Class == AIAuthored }

var conventional = regexp.MustCompile(`^(feat|fix|chore|docs|refactor|test|build|ci|perf|style)(\([^)]+\))?!?: .+`)

// Classify scores a single commit.
func Classify(c gitlog.Commit, s signal.Set, cfg config.Config) Result {
	r := Result{SHA: c.SHA, Lines: c.Lines(), Signals: s.Declared}

	if s.DeclaredAI {
		r.AILikelihood = 0.98
		r.Confidence = 0.95
		r.Basis = "declared"
		r.Class = bucket(r.AILikelihood, r.Confidence)
		return r
	}

	if !cfg.Inference {
		// No declared AI signal and inference disabled: treat as human, low confidence.
		r.AILikelihood = 0.15
		r.Confidence = 0.5
		r.Basis = "declared"
		r.Class = Human
		return r
	}

	// Behavioral inference — deliberately weak, and capped.
	f := inferFeatures(c)
	r.AILikelihood = logistic(f - 1.0) // small commits land well below 0.5
	r.Confidence = math.Min(InferredConfidenceCap, 0.40+0.20*f)
	r.Basis = "inferred"
	r.Class = bucket(r.AILikelihood, r.Confidence)
	return r
}

// inferFeatures returns a small positive score; larger = more AI-like.
func inferFeatures(c gitlog.Commit) float64 {
	added, deleted := 0, 0
	for _, ff := range c.Files {
		added += ff.Added
		deleted += ff.Deleted
	}
	total := added + deleted
	f := 0.0

	switch {
	case total > 400:
		f += 0.6
	case total > 150:
		f += 0.3
	}
	// greenfield: lots of additions, almost no deletions
	if added > 120 && float64(deleted)/float64(added+1) < 0.05 {
		f += 0.4
	}
	// a perfectly-formed conventional subject with an empty body on a large change
	if conventional.MatchString(c.Subject) && strings.TrimSpace(c.Body) == "" && total > 150 {
		f += 0.2
	}
	return f
}

func bucket(ai, conf float64) string {
	if conf < 0.35 {
		return Unclassified
	}
	switch {
	case ai >= 0.85:
		return AIAuthored
	case ai >= 0.50:
		return AIAssisted
	default:
		return Human
	}
}

func logistic(x float64) float64 { return 1.0 / (1.0 + math.Exp(-x)) }
