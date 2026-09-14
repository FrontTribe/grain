package deps

import "testing"

func TestParseManifestLines(t *testing.T) {
	cases := []struct{ path, line, name, eco string }{
		{"package.json", `    "gsap": "^3.15.0",`, "gsap", "npm"},
		{"web/package.json", `    "@supabase/ssr": "^0.12.5",`, "@supabase/ssr", "npm"},
		{"package.json", `    "next": "16.3.4",`, "next", "npm"},
		{"package.json", `  "name": "web",`, "", ""},
		{"package.json", `  "version": "0.1.0",`, "", ""},
		{"package.json", `    "build": "next build",`, "", ""},
		{"package.json", `    "node": ">=18"`, "", ""},
		{"package.json", `  "url": "https://github.com/FrontTribe/grain/issues",`, "", ""},
		{"package.json", `  "bugs": "https://github.com/FrontTribe/grain/issues"`, "", ""},
		{"go.mod", `	github.com/lib/pq v1.10.9`, "github.com/lib/pq", "go"},
		{"go.mod", `	golang.org/x/net v0.30.0 // indirect`, "", ""},
		{"go.mod", `module github.com/FrontTribe/grain`, "", ""},
		{"requirements.txt", `requests==2.32.0`, "requests", "pypi"},
		{"requirements.txt", `Flask>=3.0`, "flask", "pypi"},
		{"requirements-dev.txt", `pytest`, "pytest", "pypi"},
		{"requirements.txt", `-r base.txt`, "", ""},
		{"requirements.txt", `# comment`, "", ""},
		{"pyproject.toml", `    "httpx>=0.27",`, "httpx", "pypi"},
		{"pyproject.toml", `fastapi = "^0.115"`, "fastapi", "pypi"},
		{"pyproject.toml", `python = "^3.12"`, "", ""},
		{"pyproject.toml", `name = "myproj"`, "", ""},
		{"Cargo.toml", `serde = { version = "1", features = ["derive"] }`, "serde", "cargo"},
		{"Cargo.toml", `tokio = "1.40"`, "tokio", "cargo"},
		{"Cargo.toml", `edition = "2021"`, "", ""},
		{"Gemfile", `gem 'rails', '~> 7.1'`, "rails", "rubygems"},
		{"src/main.go", `	"net/http"`, "", ""},
	}
	for _, c := range cases {
		name, eco, ok := Parse(c.path, c.line)
		if c.name == "" {
			if ok {
				t.Errorf("%s: %q: want no dep, got %s (%s)", c.path, c.line, name, eco)
			}
			continue
		}
		if !ok || name != c.name || eco != c.eco {
			t.Errorf("%s: %q: want %s (%s), got %s (%s) ok=%v", c.path, c.line, c.name, c.eco, name, eco, ok)
		}
	}
}

func TestGoProxyEscaping(t *testing.T) {
	if got := escapeGoModule("github.com/FrontTribe/grain"); got != "github.com/!front!tribe/grain" {
		t.Fatal(got)
	}
}
