package report

import (
	"testing"

	"github.com/FrontTribe/grain/internal/deps"
	"github.com/FrontTribe/grain/internal/security"
)

func TestGates(t *testing.T) {
	sec := &security.Summary{Total: 3, AI: 2, AICriticalUnrev: 1}
	d := &deps.Summary{Total: 3, Checked: true, Missing: 1, Deps: []deps.Dep{
		{Name: "leftpadd", AI: true, Checked: true, Exists: false, AgeDays: -1},
		{Name: "fresh", AI: true, Checked: true, Exists: true, AgeDays: 3},
		{Name: "fresh-human", AI: false, Checked: true, Exists: true, AgeDays: 3}, // young but human-added: not a gate
	}}
	r := Report{Security: sec, Deps: d}

	g := r.Gates("block", "warn")
	if len(g) != 2 || !g[0].Block || g[1].Block || !g.Blocked() {
		t.Fatalf("block/warn: %+v", g)
	}
	if g[0].Reason != "2 security findings in AI-written lines, 1 in a critical path" {
		t.Errorf("security reason: %q", g[0].Reason)
	}
	if g[1].Reason != "1 added dependency not on the registry, 1 AI-added package younger than 30 days" {
		t.Errorf("deps reason: %q", g[1].Reason)
	}

	if g := r.Gates("off", "off"); len(g) != 0 {
		t.Errorf("off: %+v", g)
	}
	if g := r.Gates("warn", "warn"); g.Blocked() {
		t.Errorf("warn must not block: %+v", g)
	}
	// Unchecked registries: the deps gate has nothing to say.
	r.Deps = &deps.Summary{Total: 1, Checked: false, Deps: []deps.Dep{{Name: "x", AI: true}}}
	if g := r.Gates("off", "block"); len(g) != 0 {
		t.Errorf("unchecked: %+v", g)
	}
	// Clean report: nothing fires.
	r = Report{Security: &security.Summary{}, Deps: &deps.Summary{Checked: true}}
	if g := r.Gates("block", "block"); len(g) != 0 {
		t.Errorf("clean: %+v", g)
	}
}
