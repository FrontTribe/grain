package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"github.com/FrontTribe/grain/internal/classify"
	"github.com/FrontTribe/grain/internal/features"
	"github.com/FrontTribe/grain/internal/gitlog"
	"github.com/FrontTribe/grain/internal/signal"
)

// cmdCalibrate fits per-repo classifier weights from the repo's own DECLARED
// commits (Co-Authored-By agent = AI, else human) and writes them to
// .grain/model.json, which the scorer then uses instead of the global default.
// Per-repo is where the content signal generalizes: a global fit is confounded
// by codebase style (see docs/detection/calibration-study.md), but within one
// repo — style held constant — declared labels are a usable target.
func cmdCalibrate(args []string) error {
	fs := flag.NewFlagSet("calibrate", flag.ExitOnError)
	dir := fs.String("C", ".", "run in this directory")
	max := fs.Int("max", 0, "limit to the most recent N commits (0 = all)")
	minN := fs.Int("min", 40, "minimum labeled commits required")
	dry := fs.Bool("dry-run", false, "report metrics without writing .grain/model.json")
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

	var vecs [][]float64
	var labels []float64
	var pos, neg int
	for _, c := range commits {
		byFile := added[c.SHA]
		if len(byFile) == 0 {
			continue
		}
		agg, ok := features.Aggregate(byFile)
		if !ok {
			continue
		}
		label := 0.0
		if signal.Extract(c, cfg).DeclaredAI {
			label = 1
			pos++
		} else {
			neg++
		}
		vecs = append(vecs, agg.Vector())
		labels = append(labels, label)
	}

	n := len(vecs)
	fmt.Printf("grain calibrate — %s\n  labeled commits: %d  (AI-declared %d · human %d)\n", repoName(root), n, pos, neg)
	if n < *minN {
		return fmt.Errorf("need at least %d labeled commits to calibrate (have %d)", *minN, n)
	}
	if pos < 8 || neg < 8 {
		return fmt.Errorf("need at least 8 commits of each class (have AI %d · human %d) — calibration would overfit", pos, neg)
	}

	// Balance classes so the fit isn't dominated by whichever is more common.
	bx, by := balanceXY(vecs, labels)

	// Transparency: fit on 2/3, report held-out vs the default model.
	trX, trY, teX, teY := split(bx, by)
	fmt.Printf("\n  held-out check (balanced: train %d → test %d)\n", len(trX), len(teX))
	fmt.Printf("    default model  ")
	reportMetrics("", predict(classify.DefaultModel(), teX), teY)
	fmt.Printf("    fitted         ")
	reportMetrics("", predict(classify.Fit(trX, trY), teX), teY)

	if *dry {
		fmt.Println("\n  dry run — nothing written")
		return nil
	}

	// Ship: refit on all balanced data and persist.
	ship := classify.Fit(bx, by)
	outDir := filepath.Join(root, ".grain")
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		return err
	}
	out := filepath.Join(outDir, "model.json")
	blob, err := json.MarshalIndent(struct {
		ID         string    `json:"id"`
		FeatureSet string    `json:"feature_set"`
		Weights    []float64 `json:"weights"`
		Bias       float64   `json:"bias"`
	}{ID: "w2-content-fit", FeatureSet: features.SetID, Weights: ship.Weights, Bias: ship.Bias}, "", "  ")
	if err != nil {
		return err
	}
	if err := os.WriteFile(out, append(blob, '\n'), 0o644); err != nil {
		return err
	}
	fmt.Printf("\n  ✓ wrote %s\n  grain now scores this repo's inferred provenance with its own weights.\n", out)
	return nil
}

// balanceXY subsamples the majority class to match the minority (order-preserving).
func balanceXY(vecs [][]float64, labels []float64) ([][]float64, []float64) {
	var px, nx [][]float64
	for i := range vecs {
		if labels[i] == 1 {
			px = append(px, vecs[i])
		} else {
			nx = append(nx, vecs[i])
		}
	}
	m := len(px)
	if len(nx) < m {
		m = len(nx)
	}
	X := make([][]float64, 0, 2*m)
	Y := make([]float64, 0, 2*m)
	for i := 0; i < m; i++ {
		X = append(X, px[i])
		Y = append(Y, 1)
	}
	for i := 0; i < m; i++ {
		X = append(X, nx[i])
		Y = append(Y, 0)
	}
	return X, Y
}
