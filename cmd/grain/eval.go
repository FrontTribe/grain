package main

import (
	"flag"
	"fmt"
	"math"

	"github.com/FrontTribe/grain/internal/classify"
	"github.com/FrontTribe/grain/internal/features"
	"github.com/FrontTribe/grain/internal/gitlog"
	"github.com/FrontTribe/grain/internal/signal"
)

// cmdEval measures the content classifier against a repo's DECLARED commits as
// ground truth (Co-Authored-By agent = AI, otherwise human), and optionally
// refits weights locally — the seed of the self-improving loop.
func cmdEval(args []string) error {
	fs := flag.NewFlagSet("eval", flag.ExitOnError)
	dir := fs.String("C", ".", "run in this directory")
	max := fs.Int("max", 0, "limit to the most recent N commits (0 = all)")
	fit := fs.Bool("fit", false, "refit weights on a train split and evaluate held-out")
	minN := fs.Int("min", 20, "minimum labeled commits required to report")
	fs.Parse(args)

	root, cfg, err := setup(*dir)
	if err != nil {
		return err
	}
	commits, err := gitlog.ReadCommits(root, "", *max)
	if err != nil {
		return err
	}
	added, err := gitlog.ReadAddedLines(root, "", *max)
	if err != nil {
		return err
	}

	// Build labeled samples: aggregate per-commit features (line-weighted across
	// files), label from the declared signal.
	var vecs [][]float64
	var labels []float64
	var churns []float64
	var pos, neg int
	for _, c := range commits {
		byFile := added[c.SHA]
		if len(byFile) == 0 {
			continue
		}
		agg := make([]float64, len(features.Keys))
		wsum := 0
		for path, lns := range byFile {
			fv := features.Extract(path, lns).Vector()
			w := len(lns)
			for j := range agg {
				agg[j] += fv[j] * float64(w)
			}
			wsum += w
		}
		if wsum == 0 {
			continue
		}
		for j := range agg {
			agg[j] /= float64(wsum)
		}
		label := 0.0
		if signal.Extract(c, cfg).DeclaredAI {
			label = 1
			pos++
		} else {
			neg++
		}
		vecs = append(vecs, agg)
		labels = append(labels, label)
		churns = append(churns, float64(wsum))
	}

	n := len(vecs)
	fmt.Printf("grain eval — %s\n", repoName(root))
	fmt.Printf("  labeled commits: %d  (AI-declared %d · human %d)\n", n, pos, neg)
	if n < *minN {
		fmt.Printf("  ⚠ need at least %d labeled commits to report (have %d)\n", *minN, n)
		return nil
	}
	if pos == 0 || neg == 0 {
		fmt.Println("  ⚠ need both AI-declared and human commits to evaluate (AUC undefined)")
		return nil
	}
	if minority := min(pos, neg); minority < 8 || float64(minority)/float64(n) < 0.15 {
		fmt.Printf("  ⚠ heavy class imbalance (minority class = %d) — metrics below are unreliable;\n"+
			"    a fit will overfit. Signals, not verdicts: trust these numbers only on a balanced repo.\n", minority)
	}

	model := classify.DefaultModel()
	preds := predict(model, vecs)
	base := baselineChurn(churns)

	fmt.Printf("\n  classifier %s\n", model.WeightsID())
	reportMetrics("    ", preds, labels)
	fmt.Printf("    baseline (churn)   AUC %.3f\n", auc(base, labels))

	if *fit {
		trainX, trainY, testX, testY := split(vecs, labels)
		if len(trainX) == 0 || len(testX) == 0 {
			fmt.Println("\n  ⚠ not enough data to fit + hold out")
			return nil
		}
		fitted := classify.Fit(trainX, trainY)
		fmt.Printf("\n  fitted %s (train %d → held-out %d)\n", fitted.WeightsID(), len(trainX), len(testX))
		reportMetrics("    ", predict(fitted, testX), testY)
		fmt.Println("\n  fitted weights (persist to .grain.toml to make it per-repo):")
		for i, k := range features.Keys {
			fmt.Printf("    %-24s % .3f\n", k, fitted.Weights[i])
		}
		fmt.Printf("    %-24s % .3f\n", "(bias)", fitted.Bias)
	}
	return nil
}

func predict(m classify.Model, vecs [][]float64) []float64 {
	out := make([]float64, len(vecs))
	for i, v := range vecs {
		out[i] = m.Score(features.FromVector(v)).AILikelihood
	}
	return out
}

func reportMetrics(indent string, preds, labels []float64) {
	p, r, f := prf(preds, labels, 0.5)
	fmt.Printf("%sAUC %.3f · ECE %.3f · P %.2f · R %.2f · F1 %.2f\n",
		indent, auc(preds, labels), ece(preds, labels, 10), p, r, f)
}

// split is a deterministic ~2/3 train, 1/3 held-out partition by index.
func split(vecs [][]float64, labels []float64) (trX [][]float64, trY []float64, teX [][]float64, teY []float64) {
	for i := range vecs {
		if i%3 == 0 {
			teX = append(teX, vecs[i])
			teY = append(teY, labels[i])
		} else {
			trX = append(trX, vecs[i])
			trY = append(trY, labels[i])
		}
	}
	return
}

// baselineChurn is the "bigger commit → more AI" heuristic, standardized.
func baselineChurn(churns []float64) []float64 {
	logs := make([]float64, len(churns))
	var mean float64
	for i, c := range churns {
		logs[i] = math.Log(c + 1)
		mean += logs[i]
	}
	mean /= float64(len(logs))
	var v float64
	for _, l := range logs {
		v += (l - mean) * (l - mean)
	}
	std := math.Sqrt(v/float64(len(logs))) + 1e-9
	out := make([]float64, len(logs))
	for i, l := range logs {
		out[i] = 1 / (1 + math.Exp(-(l-mean)/std))
	}
	return out
}

// auc is the Mann-Whitney rank statistic (probability a random AI commit scores
// above a random human one).
func auc(pred, label []float64) float64 {
	var pos, neg []float64
	for i := range pred {
		if label[i] == 1 {
			pos = append(pos, pred[i])
		} else {
			neg = append(neg, pred[i])
		}
	}
	if len(pos) == 0 || len(neg) == 0 {
		return math.NaN()
	}
	var c float64
	for _, p := range pos {
		for _, ng := range neg {
			if p > ng {
				c++
			} else if p == ng {
				c += 0.5
			}
		}
	}
	return c / float64(len(pos)*len(neg))
}

// ece is the expected calibration error over `bins` equal-width bins.
func ece(pred, label []float64, bins int) float64 {
	sp := make([]float64, bins)
	sl := make([]float64, bins)
	cnt := make([]int, bins)
	for i := range pred {
		k := int(pred[i] * float64(bins))
		if k >= bins {
			k = bins - 1
		}
		if k < 0 {
			k = 0
		}
		sp[k] += pred[i]
		sl[k] += label[i]
		cnt[k]++
	}
	var e float64
	N := float64(len(pred))
	for b := 0; b < bins; b++ {
		if cnt[b] == 0 {
			continue
		}
		e += float64(cnt[b]) / N * math.Abs(sp[b]/float64(cnt[b])-sl[b]/float64(cnt[b]))
	}
	return e
}

func prf(pred, label []float64, thr float64) (precision, recall, f1 float64) {
	var tp, fp, fn float64
	for i := range pred {
		switch {
		case pred[i] >= thr && label[i] == 1:
			tp++
		case pred[i] >= thr && label[i] == 0:
			fp++
		case pred[i] < thr && label[i] == 1:
			fn++
		}
	}
	if tp+fp > 0 {
		precision = tp / (tp + fp)
	}
	if tp+fn > 0 {
		recall = tp / (tp + fn)
	}
	if precision+recall > 0 {
		f1 = 2 * precision * recall / (precision + recall)
	}
	return
}
