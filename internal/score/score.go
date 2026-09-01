// Package score turns a commit's signals into a classification. It enforces
// grain's core rule: declared signals may reach high confidence; inferred
// signals are capped, so grain never sounds certain when it is guessing.
package score

import (
	"fmt"
	"math"
	"regexp"
	"sort"
	"strings"

	"github.com/FrontTribe/grain/internal/classify"
	"github.com/FrontTribe/grain/internal/config"
	"github.com/FrontTribe/grain/internal/features"
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

// EngineWeightsID identifies the weights used, so grain.json stays reproducible:
// the content classifier's id when enabled, else the behavioral baseline "w1".
func EngineWeightsID(cfg config.Config) string {
	if cfg.ContentClassifier {
		return classify.DefaultModel().WeightsID()
	}
	return "w1"
}

var conventional = regexp.MustCompile(`^(feat|fix|chore|docs|refactor|test|build|ci|perf|style)(\([^)]+\))?!?: .+`)

// Classify scores a single commit. `added` is the commit's added lines by file
// path (nil unless the content classifier is enabled), used by the inferred path.
func Classify(c gitlog.Commit, s signal.Set, cfg config.Config, added map[string][]string) Result {
	r := Result{SHA: c.SHA, Lines: c.Lines(), Signals: s.Declared}

	// Attested: an authoritative git-note declaration overrides everything else.
	switch s.AttestedClass {
	case "ai":
		r.AILikelihood = 0.98
		r.Confidence = 0.95
		r.Basis = "attested"
		r.Class = bucket(r.AILikelihood, r.Confidence)
		return r
	case "human":
		r.AILikelihood = 0.05
		r.Confidence = 0.95
		r.Basis = "attested"
		r.Class = Human
		return r
	}

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

	// Content classifier (opt-in): score the actual added code. Confidence is
	// already capped at the inferred ceiling by classify.
	if cfg.ContentClassifier {
		if fv, ok := features.Aggregate(added); ok {
			res := classify.DefaultModel().Score(fv)
			r.AILikelihood = res.AILikelihood
			r.Confidence = res.Confidence
			r.Basis = "inferred"
			r.Signals = topContribs(res, 3)
			r.Class = bucket(r.AILikelihood, r.Confidence)
			return r
		}
	}

	// Behavioral inference — deliberately weak, and capped.
	f := inferFeatures(c)
	r.AILikelihood = logistic(f - 1.0) // small commits land well below 0.5
	r.Confidence = math.Min(InferredConfidenceCap, 0.40+0.20*f)
	r.Basis = "inferred"
	r.Class = bucket(r.AILikelihood, r.Confidence)
	return r
}

// topContribs renders the n most influential feature contributions as signals,
// e.g. "docstring_completeness +0.31" (toward AI) / "-0.12" (toward human).
func topContribs(res classify.Result, n int) []string {
	cs := make([]classify.Contribution, len(res.Contributions))
	copy(cs, res.Contributions)
	sort.SliceStable(cs, func(i, j int) bool { return math.Abs(cs[i].Effect) > math.Abs(cs[j].Effect) })
	var out []string
	for _, c := range cs {
		if len(out) >= n || math.Abs(c.Effect) < 0.02 {
			break
		}
		out = append(out, fmt.Sprintf("%s %+.2f", c.Feature, c.Effect))
	}
	return out
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
