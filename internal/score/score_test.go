package score

import (
	"testing"

	"github.com/FrontTribe/grain/internal/config"
	"github.com/FrontTribe/grain/internal/gitlog"
	"github.com/FrontTribe/grain/internal/signal"
)

func scoreCommit(c gitlog.Commit) Result {
	cfg := config.Default()
	return Classify(c, signal.Extract(c, cfg), cfg, nil)
}

func TestDeclaredAI(t *testing.T) {
	c := gitlog.Commit{
		SHA:     "aaaaaaa",
		Subject: "feat: add retry",
		Body:    "Some body.\n\nCo-Authored-By: Claude <noreply@anthropic.com>",
		Files:   []gitlog.FileChange{{Path: "src/a.go", Added: 40, Deleted: 2}},
	}
	r := scoreCommit(c)
	if r.Basis != "declared" {
		t.Fatalf("basis = %q, want declared", r.Basis)
	}
	if !r.IsAI() {
		t.Fatalf("class = %q, want an AI class", r.Class)
	}
	if r.Confidence < 0.9 {
		t.Fatalf("confidence = %.2f, want >= 0.9 for declared", r.Confidence)
	}
}

func TestBotAuthorDeclared(t *testing.T) {
	c := gitlog.Commit{
		SHA:         "bbbbbbb",
		AuthorName:  "dependabot[bot]",
		AuthorEmail: "support@dependabot.com",
		Subject:     "chore: bump deps",
		Files:       []gitlog.FileChange{{Path: "go.mod", Added: 3, Deleted: 3}},
	}
	if r := scoreCommit(c); !r.IsAI() || r.Basis != "declared" {
		t.Fatalf("bot author not detected: class=%q basis=%q", r.Class, r.Basis)
	}
}

func TestSmallHumanCommitInferred(t *testing.T) {
	c := gitlog.Commit{
		SHA:     "ccccccc",
		Subject: "tweak copy",
		Files:   []gitlog.FileChange{{Path: "README.md", Added: 4, Deleted: 1}},
	}
	r := scoreCommit(c)
	if r.Class != Human {
		t.Fatalf("small no-signal commit class = %q, want human", r.Class)
	}
	if r.Confidence > InferredConfidenceCap {
		t.Fatalf("inferred confidence %.2f exceeds cap %.2f", r.Confidence, InferredConfidenceCap)
	}
}

func TestHumanCoauthorIsNotAI(t *testing.T) {
	c := gitlog.Commit{
		SHA:     "ddddddd",
		Subject: "pair session",
		Body:    "Co-Authored-By: Maya Dev <maya@example.com>",
		Files:   []gitlog.FileChange{{Path: "src/a.go", Added: 10, Deleted: 4}},
	}
	if r := scoreCommit(c); r.IsAI() {
		t.Fatalf("human co-author misclassified as AI: %q", r.Class)
	}
}
