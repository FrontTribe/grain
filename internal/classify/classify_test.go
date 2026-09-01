package classify

import (
	"math"
	"testing"

	"github.com/FrontTribe/grain/internal/features"
)

// uniform builds a feature vector with every feature set to v.
func uniform(v float64) features.Features {
	return features.Features{
		CommentDensity: v, DocstringCompleteness: v, NamingDescriptiveness: v,
		NamingConsistency: v, FuncLengthUniformity: v, LineLengthRegularity: v,
		BlankLineRegularity: v, BoilerplateRatio: v, ErrorHandlingDensity: v,
		TodoAbsence: v,
	}
}

func TestNeutralIsHalf(t *testing.T) {
	r := DefaultModel().Score(uniform(0.5))
	if math.Abs(r.AILikelihood-0.5) > 1e-9 {
		t.Errorf("neutral AILikelihood = %v, want 0.5", r.AILikelihood)
	}
	if math.Abs(r.Confidence-0.40) > 1e-9 {
		t.Errorf("neutral Confidence = %v, want 0.40", r.Confidence)
	}
}

func TestAiHighHumanLow(t *testing.T) {
	m := DefaultModel()
	ai := m.Score(uniform(1)).AILikelihood
	human := m.Score(uniform(0)).AILikelihood
	if ai <= 0.9 {
		t.Errorf("all-AI AILikelihood = %v, want > 0.9", ai)
	}
	if human >= 0.1 {
		t.Errorf("all-human AILikelihood = %v, want < 0.1", human)
	}
	if !(ai > human) {
		t.Errorf("expected ai(%v) > human(%v)", ai, human)
	}
}

func TestConfidenceCapped(t *testing.T) {
	m := DefaultModel()
	for _, v := range []float64{0, 0.25, 0.5, 0.75, 1} {
		c := m.Score(uniform(v)).Confidence
		if c > ConfidenceCap+1e-12 {
			t.Errorf("confidence %v exceeds cap %v at v=%v", c, ConfidenceCap, v)
		}
		if c < 0 {
			t.Errorf("confidence %v negative at v=%v", c, v)
		}
	}
}

func TestContributionsRankedAndComplete(t *testing.T) {
	r := DefaultModel().Score(uniform(0.9))
	if len(r.Contributions) != len(features.Keys) {
		t.Fatalf("contributions len %d != keys len %d", len(r.Contributions), len(features.Keys))
	}
	for i := 1; i < len(r.Contributions); i++ {
		if math.Abs(r.Contributions[i-1].Effect) < math.Abs(r.Contributions[i].Effect) {
			t.Errorf("contributions not sorted by |effect| desc at %d", i)
		}
	}
	// docstring_completeness carries the largest weight, so at an all-high vector
	// it should be the top contributor.
	if r.Contributions[0].Feature != "docstring_completeness" {
		t.Errorf("top contributor = %q, want docstring_completeness", r.Contributions[0].Feature)
	}
}

func TestWeightsID(t *testing.T) {
	if got, want := DefaultModel().WeightsID(), "w2-content/"+features.SetID; got != want {
		t.Errorf("WeightsID = %q, want %q", got, want)
	}
}

func TestLikelihoodInRange(t *testing.T) {
	m := DefaultModel()
	for _, v := range []float64{0, 0.3, 0.5, 0.7, 1} {
		p := m.Score(uniform(v)).AILikelihood
		if p < 0 || p > 1 {
			t.Errorf("AILikelihood %v out of [0,1] at v=%v", p, v)
		}
	}
}

// End-to-end with the real extractor: an AI-styled snippet should out-score a
// terse human one.
func TestIntegrationAiVsHuman(t *testing.T) {
	human := features.Extract("h.go",
		[]string{"func f(x int) int {", "\t// TODO fix later", "\treturn x+1", "}"})
	ai := features.Extract("a.go", []string{
		"// Increment returns the successor of the given value.",
		"func Increment(value int) (int, error) {",
		"\tif value < 0 {",
		"\t\treturn 0, fmt.Errorf(\"value must be non-negative\")",
		"\t}",
		"\treturn value + 1, nil",
		"}",
	})
	m := DefaultModel()
	if !(m.Score(ai).AILikelihood > m.Score(human).AILikelihood) {
		t.Errorf("expected ai score > human score (ai=%v human=%v)",
			m.Score(ai).AILikelihood, m.Score(human).AILikelihood)
	}
}
