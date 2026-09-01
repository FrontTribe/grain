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

func TestNoteAttestsAI(t *testing.T) {
	c := gitlog.Commit{Note: "Provenance: ai"}
	s := Extract(c, config.Default())
	if s.AttestedClass != "ai" || !s.DeclaredAI {
		t.Errorf("note 'Provenance: ai' → AttestedClass=%q DeclaredAI=%v", s.AttestedClass, s.DeclaredAI)
	}
}

func TestNoteAttestsHuman(t *testing.T) {
	c := gitlog.Commit{Note: "Provenance: human"}
	s := Extract(c, config.Default())
	if s.AttestedClass != "human" || !s.DeclaredHuman {
		t.Errorf("note 'Provenance: human' → AttestedClass=%q DeclaredHuman=%v", s.AttestedClass, s.DeclaredHuman)
	}
}

func TestNoteAIAuthoredFraction(t *testing.T) {
	if s := Extract(gitlog.Commit{Note: "AI-Authored: 0.9"}, config.Default()); s.AttestedClass != "ai" {
		t.Errorf("AI-Authored 0.9 → %q, want ai", s.AttestedClass)
	}
	if s := Extract(gitlog.Commit{Note: "AI-Authored: 0.1"}, config.Default()); s.AttestedClass != "human" {
		t.Errorf("AI-Authored 0.1 → %q, want human", s.AttestedClass)
	}
}

// A note is authoritative: it overrides an AI trailer in the commit message.
func TestNoteOverridesMessage(t *testing.T) {
	c := gitlog.Commit{
		Body: "Co-Authored-By: Claude <noreply@anthropic.com>",
		Note: "Provenance: human",
	}
	s := Extract(c, config.Default())
	if s.AttestedClass != "human" {
		t.Errorf("note should override message: AttestedClass=%q, want human", s.AttestedClass)
	}
}

func TestPlainHumanCommit(t *testing.T) {
	c := gitlog.Commit{AuthorName: "Jane Dev", AuthorEmail: "jane@example.com", Subject: "fix: off-by-one", Body: "Manual fix."}
	s := Extract(c, config.Default())
	if s.DeclaredAI {
		t.Error("a plain human commit must not be DeclaredAI")
	}
}
