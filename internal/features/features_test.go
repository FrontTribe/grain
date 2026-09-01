package features

import (
	"reflect"
	"testing"
)

func lines(s string) []string {
	// split without a trailing empty element the way a diff hunk would give us
	var out []string
	cur := ""
	for _, r := range s {
		if r == '\n' {
			out = append(out, cur)
			cur = ""
			continue
		}
		cur += string(r)
	}
	if cur != "" {
		out = append(out, cur)
	}
	return out
}

func TestDetectLanguage(t *testing.T) {
	cases := map[string]Language{
		"main.go": LangGo, "app.ts": LangJS, "a.tsx": LangJS, "x.mjs": LangJS,
		"m.py": LangPython, "README.md": LangGeneric, "Makefile": LangGeneric,
	}
	for path, want := range cases {
		if got := DetectLanguage(path); got != want {
			t.Errorf("DetectLanguage(%q) = %v, want %v", path, got, want)
		}
	}
}

func TestVectorMatchesKeys(t *testing.T) {
	f := Extract("x.go", lines("func f() {}\n"))
	if len(f.Vector()) != len(Keys) {
		t.Fatalf("Vector len %d != Keys len %d", len(f.Vector()), len(Keys))
	}
	if len(f.Named()) != len(Keys) {
		t.Fatalf("Named len %d != Keys len %d", len(f.Named()), len(Keys))
	}
}

func TestRangesAndDeterminism(t *testing.T) {
	src := "// Increment returns the successor.\n" +
		"func Increment(value int) (int, error) {\n" +
		"\tif value < 0 {\n" +
		"\t\treturn 0, fmt.Errorf(\"negative value\")\n" +
		"\t}\n" +
		"\treturn value + 1, nil\n" +
		"}\n"
	a := Extract("x.go", lines(src))
	b := Extract("x.go", lines(src))
	if !reflect.DeepEqual(a, b) {
		t.Fatal("Extract is not deterministic")
	}
	for k, v := range a.Named() {
		if v < 0 || v > 1 {
			t.Errorf("feature %q = %v out of [0,1]", k, v)
		}
	}
}

func TestEmptyIsNeutralNoPanic(t *testing.T) {
	f := Extract("x.go", nil)
	if f.TodoAbsence != 1 {
		t.Errorf("empty TodoAbsence = %v, want 1", f.TodoAbsence)
	}
	for k, v := range f.Named() {
		if v < 0 || v > 1 {
			t.Errorf("feature %q = %v out of [0,1]", k, v)
		}
	}
}

// The core signal: an AI-styled snippet should read as more AI-like than a terse,
// human snippet on the features that discriminate them.
func TestDiscriminatesAiVsHuman(t *testing.T) {
	human := Extract("h.go", lines(
		"func f(x int) int {\n"+
			"\t// TODO fix later\n"+
			"\treturn x+1\n"+
			"}\n"))

	ai := Extract("a.go", lines(
		"// Increment returns the successor of the given value.\n"+
			"func Increment(value int) (int, error) {\n"+
			"\tif value < 0 {\n"+
			"\t\treturn 0, fmt.Errorf(\"value must be non-negative\")\n"+
			"\t}\n"+
			"\treturn value + 1, nil\n"+
			"}\n"))

	if !(ai.TodoAbsence > human.TodoAbsence) {
		t.Errorf("TodoAbsence: ai=%v human=%v (want ai>human)", ai.TodoAbsence, human.TodoAbsence)
	}
	if !(ai.DocstringCompleteness > human.DocstringCompleteness) {
		t.Errorf("DocstringCompleteness: ai=%v human=%v (want ai>human)", ai.DocstringCompleteness, human.DocstringCompleteness)
	}
	if !(ai.ErrorHandlingDensity > human.ErrorHandlingDensity) {
		t.Errorf("ErrorHandlingDensity: ai=%v human=%v (want ai>human)", ai.ErrorHandlingDensity, human.ErrorHandlingDensity)
	}
	if !(ai.NamingDescriptiveness >= human.NamingDescriptiveness) {
		t.Errorf("NamingDescriptiveness: ai=%v human=%v (want ai>=human)", ai.NamingDescriptiveness, human.NamingDescriptiveness)
	}
}

func TestPythonDocstring(t *testing.T) {
	f := Extract("m.py", lines(
		"def add(a, b):\n"+
			"    \"\"\"Return the sum of a and b.\"\"\"\n"+
			"    return a + b\n"))
	if f.DocstringCompleteness != 1 {
		t.Errorf("python DocstringCompleteness = %v, want 1", f.DocstringCompleteness)
	}
}

func TestBoilerplateRatio(t *testing.T) {
	// three identical substantive lines → high duplicate ratio
	f := Extract("x.go", lines(
		"result := compute(input)\n"+
			"result := compute(input)\n"+
			"result := compute(input)\n"))
	if f.BoilerplateRatio <= 0 {
		t.Errorf("BoilerplateRatio = %v, want > 0 for repeated lines", f.BoilerplateRatio)
	}
}
