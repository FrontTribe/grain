// Package features extracts interpretable, language-aware signals from the code
// a commit adds. It is the input to the inferred content classifier
// (internal/classify) and is deliberately lexical (regex/token scans, no full
// parse) so it stays stdlib-only, fast, and dependency-free.
//
// Every feature is normalized to [0,1] where *higher means more AI-like*, and
// the set is versioned by SetID so grain.json stays reproducible. Features are a
// floor, not proof: they feed a confidence that is always capped on the inferred
// path.
package features

import (
	"math"
	"path/filepath"
	"regexp"
	"strings"
)

// SetID versions the feature set; bump it on any change to keys or extraction.
const SetID = "f1"

// Keys is the stable, ordered list of feature names. Vector() returns values in
// this order; Named() maps them for explanation.
var Keys = []string{
	"comment_density",
	"docstring_completeness",
	"naming_descriptiveness",
	"naming_consistency",
	"func_length_uniformity",
	"line_length_regularity",
	"blank_line_regularity",
	"boilerplate_ratio",
	"error_handling_density",
	"todo_absence",
}

// Features holds one normalized value per key in Keys.
type Features struct {
	CommentDensity        float64
	DocstringCompleteness float64
	NamingDescriptiveness float64
	NamingConsistency     float64
	FuncLengthUniformity  float64
	LineLengthRegularity  float64
	BlankLineRegularity   float64
	BoilerplateRatio      float64
	ErrorHandlingDensity  float64
	TodoAbsence           float64
}

// Vector returns the feature values in Keys order.
func (f Features) Vector() []float64 {
	return []float64{
		f.CommentDensity, f.DocstringCompleteness, f.NamingDescriptiveness,
		f.NamingConsistency, f.FuncLengthUniformity, f.LineLengthRegularity,
		f.BlankLineRegularity, f.BoilerplateRatio, f.ErrorHandlingDensity,
		f.TodoAbsence,
	}
}

// FromVector rebuilds Features from values in Keys order (inverse of Vector).
func FromVector(v []float64) Features {
	get := func(i int) float64 {
		if i < len(v) {
			return v[i]
		}
		return 0
	}
	return Features{
		CommentDensity: get(0), DocstringCompleteness: get(1), NamingDescriptiveness: get(2),
		NamingConsistency: get(3), FuncLengthUniformity: get(4), LineLengthRegularity: get(5),
		BlankLineRegularity: get(6), BoilerplateRatio: get(7), ErrorHandlingDensity: get(8),
		TodoAbsence: get(9),
	}
}

// Named returns the features as a key→value map (for `grain explain`).
func (f Features) Named() map[string]float64 {
	v := f.Vector()
	m := make(map[string]float64, len(Keys))
	for i, k := range Keys {
		m[k] = v[i]
	}
	return m
}

// Language is the detected source language of a file.
type Language int

const (
	LangGeneric Language = iota
	LangGo
	LangJS
	LangPython
)

type langSpec struct {
	lineComment []string
	funcRe      *regexp.Regexp
	errRe       *regexp.Regexp
	pyDoc       bool // docstring is a triple-quote on the line after a def
}

var (
	identRe = regexp.MustCompile(`[A-Za-z_][A-Za-z0-9_]*`)
	todoRe  = regexp.MustCompile(`(?i)\b(todo|fixme|hack|xxx)\b`)

	specs = map[Language]langSpec{
		LangGo: {
			lineComment: []string{"//"},
			funcRe:      regexp.MustCompile(`^\s*func\b`),
			errRe:       regexp.MustCompile(`if\s+err\s*!=\s*nil|errors\.|fmt\.Errorf|panic\(`),
		},
		LangJS: {
			lineComment: []string{"//"},
			funcRe:      regexp.MustCompile(`\bfunction\b|=>|^\s*(async\s+)?[A-Za-z_$][\w$]*\s*\([^)]*\)\s*\{`),
			errRe:       regexp.MustCompile(`\b(try|catch|throw|finally)\b`),
		},
		LangPython: {
			lineComment: []string{"#"},
			funcRe:      regexp.MustCompile(`^\s*(async\s+)?def\b`),
			errRe:       regexp.MustCompile(`\b(try|except|raise|finally)\b`),
			pyDoc:       true,
		},
		LangGeneric: {
			lineComment: []string{"//", "#"},
			funcRe:      nil,
			errRe:       regexp.MustCompile(`\b(try|catch|except|throw|raise)\b`),
		},
	}
)

// DetectLanguage maps a file path to a Language by extension.
func DetectLanguage(path string) Language {
	switch strings.ToLower(filepath.Ext(path)) {
	case ".go":
		return LangGo
	case ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs":
		return LangJS
	case ".py", ".pyi":
		return LangPython
	default:
		return LangGeneric
	}
}

// Extract computes the feature vector for a file's added lines. `added` is the
// raw text of the lines a commit introduced (without the leading '+').
func Extract(path string, added []string) Features {
	spec := specs[DetectLanguage(path)]

	var code, comments []string // non-blank code vs comment lines
	blank := 0
	for _, raw := range added {
		t := strings.TrimSpace(raw)
		if t == "" {
			blank++
			continue
		}
		if isComment(t, spec.lineComment) {
			comments = append(comments, t)
		} else {
			code = append(code, raw)
		}
	}
	nCode := len(code)

	f := Features{
		// neutral defaults for signals that need enough structure to be meaningful
		DocstringCompleteness: 0.5,
		NamingConsistency:     0.5,
		FuncLengthUniformity:  0.5,
		LineLengthRegularity:  0.5,
		BlankLineRegularity:   0.5,
		TodoAbsence:           1.0,
	}
	if nCode == 0 {
		return f
	}

	// comment_density: comments over all substantive lines, AI over-comments.
	f.CommentDensity = clamp01(float64(len(comments)) / float64(nCode+len(comments)) / 0.35)

	// error_handling_density: fraction of code lines with error-handling.
	if spec.errRe != nil {
		errLines := 0
		for _, l := range code {
			if spec.errRe.MatchString(l) {
				errLines++
			}
		}
		f.ErrorHandlingDensity = clamp01(float64(errLines) / float64(nCode) * 5)
	}

	// todo_absence: humans leave TODO/FIXME/HACK; absence reads as AI-like.
	for _, l := range append(append([]string{}, code...), comments...) {
		if todoRe.MatchString(l) {
			f.TodoAbsence = 0
			break
		}
	}

	// naming: descriptiveness (avg identifier length) + snake/camel consistency.
	var idents []string
	for _, l := range code {
		idents = append(idents, identRe.FindAllString(l, -1)...)
	}
	if len(idents) > 0 {
		total := 0
		var snake, camel int
		for _, id := range idents {
			total += len(id)
			if strings.Contains(id, "_") && strings.ToLower(id) == id {
				snake++
			} else if hasInternalUpper(id) {
				camel++
			}
		}
		avgLen := float64(total) / float64(len(idents))
		f.NamingDescriptiveness = clamp01((avgLen - 3) / 12)
		if snake+camel > 0 {
			f.NamingConsistency = float64(max(snake, camel)) / float64(snake+camel)
		}
	}

	// line_length_regularity: consistent line lengths read as AI-like.
	lens := make([]float64, 0, nCode)
	for _, l := range code {
		lens = append(lens, float64(len(strings.TrimRight(l, " \t"))))
	}
	f.LineLengthRegularity = regularity(lens)

	// blank_line_regularity: uniform spacing between code runs.
	if runs := codeRunLengths(added, spec.lineComment); len(runs) >= 2 {
		f.BlankLineRegularity = regularity(runs)
	}

	// boilerplate_ratio: near-duplicate substantive lines (AI repeats canon).
	f.BoilerplateRatio = duplicateRatio(code)

	// func_length_uniformity + docstring_completeness need function boundaries.
	if spec.funcRe != nil {
		uniform, docFrac := funcStats(added, spec)
		if uniform >= 0 {
			f.FuncLengthUniformity = uniform
		}
		if docFrac >= 0 {
			f.DocstringCompleteness = docFrac
		}
	}

	return f
}

func isComment(trimmed string, prefixes []string) bool {
	if strings.HasPrefix(trimmed, "/*") || strings.HasPrefix(trimmed, "*") {
		return true
	}
	for _, p := range prefixes {
		if strings.HasPrefix(trimmed, p) {
			return true
		}
	}
	return false
}

func hasInternalUpper(id string) bool {
	for i := 1; i < len(id); i++ {
		if id[i] >= 'A' && id[i] <= 'Z' {
			return true
		}
	}
	return false
}

// regularity = 1 - coefficient of variation, clamped. Uniform values → ~1.
func regularity(xs []float64) float64 {
	if len(xs) < 2 {
		return 0.5
	}
	var sum float64
	for _, x := range xs {
		sum += x
	}
	mean := sum / float64(len(xs))
	if mean == 0 {
		return 0.5
	}
	var v float64
	for _, x := range xs {
		v += (x - mean) * (x - mean)
	}
	cv := math.Sqrt(v/float64(len(xs))) / mean
	return clamp01(1 - cv)
}

// codeRunLengths returns the lengths of consecutive non-blank runs.
func codeRunLengths(added []string, _ []string) []float64 {
	var runs []float64
	cur := 0
	for _, raw := range added {
		if strings.TrimSpace(raw) == "" {
			if cur > 0 {
				runs = append(runs, float64(cur))
				cur = 0
			}
			continue
		}
		cur++
	}
	if cur > 0 {
		runs = append(runs, float64(cur))
	}
	return runs
}

// duplicateRatio is the fraction of substantive code lines that repeat.
func duplicateRatio(code []string) float64 {
	seen := map[string]int{}
	substantive := 0
	for _, l := range code {
		t := strings.TrimSpace(l)
		if len(t) <= 3 { // skip "}", ")", "],", etc.
			continue
		}
		substantive++
		seen[t]++
	}
	if substantive == 0 {
		return 0
	}
	dupes := 0
	for _, n := range seen {
		if n > 1 {
			dupes += n - 1
		}
	}
	return clamp01(float64(dupes) / float64(substantive))
}

// funcStats returns (func-length uniformity, docstring completeness). Either is
// -1 when there aren't enough functions to be meaningful.
func funcStats(added []string, spec langSpec) (float64, float64) {
	var starts []int
	for i, raw := range added {
		if spec.funcRe.MatchString(raw) {
			starts = append(starts, i)
		}
	}
	if len(starts) == 0 {
		return -1, -1
	}

	// docstring completeness: a comment just above (Go/JS) or a triple-quote just
	// below (Python) the declaration.
	documented := 0
	for _, s := range starts {
		if spec.pyDoc {
			if s+1 < len(added) {
				n := strings.TrimSpace(added[s+1])
				if strings.HasPrefix(n, `"""`) || strings.HasPrefix(n, "'''") {
					documented++
				}
			}
		} else if s-1 >= 0 && isComment(strings.TrimSpace(added[s-1]), spec.lineComment) {
			documented++
		}
	}
	docFrac := float64(documented) / float64(len(starts))

	uniform := -1.0
	if len(starts) >= 2 {
		lengths := make([]float64, 0, len(starts))
		for i, s := range starts {
			end := len(added)
			if i+1 < len(starts) {
				end = starts[i+1]
			}
			lengths = append(lengths, float64(end-s))
		}
		uniform = regularity(lengths)
	}
	return uniform, docFrac
}

func clamp01(x float64) float64 {
	if x < 0 {
		return 0
	}
	if x > 1 {
		return 1
	}
	return x
}
