package signal

import (
	"testing"

	"github.com/FrontTribe/grain/internal/config"
	"github.com/FrontTribe/grain/internal/gitlog"
)

func TestCoAuthoredByAgent(t *testing.T) {
	c := gitlog.Commit{Body: "Body.\n\nCo-Authored-By: Claude <noreply@anthropic.com>"}
	s := Extract(c, config.Default())
	if !s.DeclaredAI {
		t.Error("expected DeclaredAI for a Claude co-author trailer")
	}
}

func TestHumanCoAuthorIsNotAI(t *testing.T) {
	c := gitlog.Commit{Body: "Body.\n\nCo-Authored-By: Jane Dev <jane@example.com>"}
	s := Extract(c, config.Default())
	if s.DeclaredAI {
		t.Error("a human co-author must not be DeclaredAI")
	}
	if !s.HumanCoauth {
		t.Error("expected HumanCoauth for a human co-author trailer")
	}
}

// The regression: a "*[bot]" glob pattern must match "dependabot[bot]".
func TestBotGlobMatches(t *testing.T) {
	cfg := config.Default()
	cfg.BotAuthors = []string{"*[bot]"}
	c := gitlog.Commit{AuthorName: "dependabot[bot]", AuthorEmail: "49699333+dependabot[bot]@users.noreply.github.com"}
	s := Extract(c, cfg)
	if !s.DeclaredAI {
		t.Error(`"*[bot]" pattern should match "dependabot[bot]"`)
	}
}

func TestAgentIdentity(t *testing.T) {
	c := gitlog.Commit{AuthorName: "Cursor Agent", AuthorEmail: "agent@cursor.sh"}
	s := Extract(c, config.Default())
	if !s.DeclaredAI {
		t.Error("expected DeclaredAI for a cursor agent identity")
	}
}

func TestAIAssistedTrailer(t *testing.T) {
	c := gitlog.Commit{Body: "AI-Assisted: true"}
	s := Extract(c, config.Default())
	if !s.DeclaredAI {
		t.Error("expected DeclaredAI for an AI-Assisted: true trailer")
	}
}

func TestPlainHumanCommit(t *testing.T) {
	c := gitlog.Commit{AuthorName: "Jane Dev", AuthorEmail: "jane@example.com", Subject: "fix: off-by-one", Body: "Manual fix."}
	s := Extract(c, config.Default())
	if s.DeclaredAI {
		t.Error("a plain human commit must not be DeclaredAI")
	}
}
