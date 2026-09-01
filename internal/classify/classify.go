// Package classify turns a feature vector (internal/features) into a calibrated
// AI-likelihood on the inferred detection path. It is a small, transparent
// logistic model — no ML runtime, stdlib-only — whose confidence is always
// capped, and which reports per-feature contributions so a classification can
// explain itself.
package classify

import (
	"math"
	"sort"

	"github.com/FrontTribe/grain/internal/features"
)

// ConfidenceCap is the hard ceiling for the inferred path. A product principle,
// mirrored from internal/score: grain never sounds certain when it is guessing.
const ConfidenceCap = 0.70

// Model is a logistic classifier over the feature vector plus Platt calibration.
// Features are centered at 0.5 (neutral), so a weight is the pull a fully-AI-like
// feature (1.0) exerts on the logit. Cal{A,B} calibrate the logit (identity by
// default); a per-repo fit (M3) writes them from declared ground truth.
type Model struct {
	ID      string    `json:"id"`
	Weights []float64 `json:"weights"` // in features.Keys order
	Bias    float64   `json:"bias"`
	CalA    float64   `json:"cal_a"`
	CalB    float64   `json:"cal_b"`
}

// Contribution is one feature's signed pull on the logit (for `grain explain`).
type Contribution struct {
	Feature string
	Weight  float64
	Value   float64
	Effect  float64 // Weight * (Value - 0.5); >0 pulls toward AI
}

// Result is a classification: a calibrated probability, a capped confidence, and
// the ranked feature contributions behind it.
type Result struct {
	AILikelihood  float64
	Confidence    float64
	Contributions []Contribution
}

// WeightsID identifies the model + feature set for grain.json reproducibility,
// e.g. "w2-content/f1".
func (m Model) WeightsID() string {
	return m.ID + "/" + features.SetID
}

// Score classifies a feature vector.
func (m Model) Score(f features.Features) Result {
	vec := f.Vector()
	z := m.Bias
	contribs := make([]Contribution, len(features.Keys))
	for i := range features.Keys {
		w := 0.0
		if i < len(m.Weights) {
			w = m.Weights[i]
		}
		eff := w * (vec[i] - 0.5)
		z += eff
		contribs[i] = Contribution{Feature: features.Keys[i], Weight: w, Value: vec[i], Effect: eff}
	}

	p := sigmoid(m.CalA*z + m.CalB)
	// Confidence scales with decisiveness (distance of p from 0.5), capped.
	conf := math.Min(ConfidenceCap, 0.40+0.30*math.Abs(2*p-1))

	sort.SliceStable(contribs, func(i, j int) bool {
		return math.Abs(contribs[i].Effect) > math.Abs(contribs[j].Effect)
	})
	return Result{AILikelihood: p, Confidence: conf, Contributions: contribs}
}

// DefaultModel returns the shipped v1 weights ("w2-content"). They encode the
// intuition that AI code over-comments, over-documents, uses descriptive and
// consistent names, is uniform, exhaustive in error handling, and leaves no
// TODOs. They are a starting point — `grain eval --fit` (M3) refines them per
// repo against declared ground truth.
func DefaultModel() Model {
	return Model{
		ID: "w2-content",
		// order: comment_density, docstring_completeness, naming_descriptiveness,
		// naming_consistency, func_length_uniformity, line_length_regularity,
		// blank_line_regularity, boilerplate_ratio, error_handling_density, todo_absence
		Weights: []float64{1.2, 1.6, 1.2, 0.6, 0.5, 0.5, 0.4, 1.0, 1.2, 1.4},
		Bias:    0,
		CalA:    1,
		CalB:    0,
	}
}

// Fit trains weights + bias by L2-regularized logistic regression (batch gradient
// descent) on centered features, matching Score's representation. X rows are
// feature vectors in features.Keys order; y is 0/1 labels. Returns a fitted model
// ("w2-content-fit"); the caller decides whether to persist it. Deterministic.
func Fit(X [][]float64, y []float64) Model {
	d := len(features.Keys)
	w := make([]float64, d)
	b := 0.0
	n := len(X)
	if n == 0 {
		return Model{ID: "w2-content-fit", Weights: w, Bias: b, CalA: 1, CalB: 0}
	}
	const lr, l2, epochs = 0.3, 0.001, 500
	for e := 0; e < epochs; e++ {
		gw := make([]float64, d)
		gb := 0.0
		for i := 0; i < n; i++ {
			z := b
			for j := 0; j < d && j < len(X[i]); j++ {
				z += w[j] * (X[i][j] - 0.5)
			}
			err := sigmoid(z) - y[i]
			for j := 0; j < d && j < len(X[i]); j++ {
				gw[j] += err * (X[i][j] - 0.5)
			}
			gb += err
		}
		for j := 0; j < d; j++ {
			w[j] -= lr * (gw[j]/float64(n) + l2*w[j])
		}
		b -= lr * (gb / float64(n))
	}
	return Model{ID: "w2-content-fit", Weights: w, Bias: b, CalA: 1, CalB: 0}
}

func sigmoid(x float64) float64 { return 1 / (1 + math.Exp(-x)) }
