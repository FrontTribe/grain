// Package deps answers "which dependencies did AI-written code pull in, and do
// they even exist?" Agents hallucinate package names; attackers register
// them (slopsquatting). grain already knows which added lines an agent wrote,
// so it can list the dependencies those lines introduced, whether anyone
// reviewed them, and, when asked to consult the registries, whether each
// package exists and how old it is. Signals, not verdicts.
package deps

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/FrontTribe/grain/internal/config"
	"github.com/FrontTribe/grain/internal/gitlog"
	"github.com/FrontTribe/grain/internal/outcomes"
	"github.com/FrontTribe/grain/internal/risk"
	"github.com/FrontTribe/grain/internal/signal"
)

// Dep is one dependency an added line introduced.
type Dep struct {
	Name      string `json:"name"`
	Ecosystem string `json:"ecosystem"` // npm | go | pypi | cargo | rubygems
	Manifest  string `json:"manifest"`
	SHA       string `json:"sha"`
	Subject   string `json:"subject"`
	AI        bool   `json:"ai"`
	Reviewed  bool   `json:"reviewed"`
	// Registry answer, when checked: exists, and age in days at scan time.
	Checked bool   `json:"checked"`
	Exists  bool   `json:"exists"`
	AgeDays int    `json:"age_days"` // -1 when unknown
	URL     string `json:"url"`
}

// Summary is the dependencies block of a report.
type Summary struct {
	Total        int    `json:"total"`
	AI           int    `json:"ai"`
	AIUnreviewed int    `json:"ai_unreviewed"`
	Checked      bool   `json:"checked"` // whether registries were consulted
	Missing      int    `json:"missing"` // checked and not found
	Young        int    `json:"young"`   // checked and younger than YoungDays
	Deps         []Dep  `json:"deps"`    // worst first, capped
	Commits      int    `json:"commits"`
	Source       string `json:"source"`
}

// YoungDays is the age under which a package counts as "young": typical of a
// name registered after an agent started hallucinating it.
const YoungDays = 30

const maxDeps = 60

var manifestRe = regexp.MustCompile(`(?i)(^|/)(package\.json|go\.mod|requirements[\w.-]*\.txt|pyproject\.toml|Cargo\.toml|Gemfile)$`)

// IsManifest reports whether a path is a dependency manifest grain reads.
func IsManifest(path string) bool { return manifestRe.MatchString(path) }

var (
	// package.json: "name": "<version range>" lines. Top-level fields and
	// engines are excluded by key; scripts by value shape.
	npmLine   = regexp.MustCompile(`^\s*"(@?[a-z0-9][a-z0-9._-]*(?:/[a-z0-9._-]+)?)"\s*:\s*"([^"]*)"\s*,?\s*$`)
	npmRange  = regexp.MustCompile(`^(\^|~|>=?|<=?|=|\*$|latest$|next$|\d|workspace:|npm:|file:|link:|git\+|github:|https?://)`)
	npmNotDep = map[string]bool{
		"name": true, "version": true, "description": true, "main": true, "module": true, "types": true, "typings": true,
		"license": true, "author": true, "homepage": true, "type": true, "packageManager": true, "node": true, "npm": true,
		"yarn": true, "pnpm": true, "bun": true, "engine-strict": true, "browser": true, "exports": true, "files": true,
		"url": true, "bugs": true, "funding": true, "repository": true, "keywords": true, "private": true, "sideEffects": true,
		"publishConfig": true, "bin": true, "directories": true, "os": true, "cpu": true, "email": true, "scripts": true,
	}
	goLine   = regexp.MustCompile(`^\s*([a-z0-9][a-z0-9.-]*\.[a-z]{2,}/[\w./~-]+)\s+v\d[\w.+-]*\s*$`)
	pyReqRe  = regexp.MustCompile(`^\s*([A-Za-z0-9][A-Za-z0-9._-]*)\s*(\[[^\]]*\])?\s*(==|>=|<=|~=|!=|>|<|===|;|$)`)
	pyArrRe  = regexp.MustCompile(`^\s*"([A-Za-z0-9][A-Za-z0-9._-]*)(\[[^\]]*\])?\s*[^"]*",?\s*$`)
	poetryRe = regexp.MustCompile(`^\s*([A-Za-z0-9][A-Za-z0-9._-]*)\s*=\s*("[^"]*"|\{)`)
	cargoRe  = regexp.MustCompile(`^\s*([A-Za-z0-9][A-Za-z0-9_-]*)\s*=\s*("[^"]*"|\{)`)
	cargoNot = map[string]bool{"name": true, "version": true, "edition": true, "authors": true, "description": true, "license": true,
		"repository": true, "readme": true, "keywords": true, "categories": true, "build": true, "rust-version": true, "default-run": true,
		"publish": true, "homepage": true, "documentation": true, "exclude": true, "include": true, "workspace": true, "resolver": true,
		"members": true, "path": true, "features": true, "default": true, "opt-level": true, "lto": true, "codegen-units": true, "panic": true}
	gemRe = regexp.MustCompile(`^\s*gem\s+['"]([^'"]+)['"]`)
	pyNot = map[string]bool{"python": true, "pip": true, "setuptools": true, "wheel": true,
		"name": true, "version": true, "description": true, "readme": true, "license": true, "authors": true, "maintainers": true,
		"requires-python": true, "dependencies": true, "keywords": true, "classifiers": true, "urls": true, "homepage": true, "repository": true, "documentation": true, "packages": true, "include": true, "exclude": true}
)

// Parse extracts the dependency names an added line of a manifest introduces.
func Parse(path, line string) (name, ecosystem string, ok bool) {
	base := path
	if i := strings.LastIndexByte(path, '/'); i >= 0 {
		base = path[i+1:]
	}
	lower := strings.ToLower(base)
	t := strings.TrimSpace(line)
	if t == "" || strings.HasPrefix(t, "#") || strings.HasPrefix(t, "//") {
		return "", "", false
	}
	switch {
	case lower == "package.json":
		m := npmLine.FindStringSubmatch(line)
		if m == nil || npmNotDep[m[1]] || !npmRange.MatchString(m[2]) {
			return "", "", false
		}
		return m[1], "npm", true
	case lower == "go.mod":
		if strings.Contains(line, "// indirect") {
			return "", "", false
		}
		m := goLine.FindStringSubmatch(line)
		if m == nil {
			return "", "", false
		}
		return m[1], "go", true
	case strings.HasPrefix(lower, "requirements") && strings.HasSuffix(lower, ".txt"):
		if strings.HasPrefix(t, "-") || strings.Contains(t, "://") {
			return "", "", false
		}
		m := pyReqRe.FindStringSubmatch(t)
		if m == nil || pyNot[strings.ToLower(m[1])] {
			return "", "", false
		}
		return strings.ToLower(m[1]), "pypi", true
	case lower == "pyproject.toml":
		if m := pyArrRe.FindStringSubmatch(line); m != nil && !pyNot[strings.ToLower(m[1])] {
			return strings.ToLower(m[1]), "pypi", true
		}
		if m := poetryRe.FindStringSubmatch(line); m != nil && !pyNot[strings.ToLower(m[1])] && !strings.Contains(m[1], ".") {
			return strings.ToLower(m[1]), "pypi", true
		}
		return "", "", false
	case lower == "cargo.toml":
		m := cargoRe.FindStringSubmatch(line)
		if m == nil || cargoNot[m[1]] {
			return "", "", false
		}
		return m[1], "cargo", true
	case lower == "gemfile":
		m := gemRe.FindStringSubmatch(line)
		if m == nil {
			return "", "", false
		}
		return m[1], "rubygems", true
	}
	return "", "", false
}

// Lookup asks a public registry whether a package exists and when it was
// created. Only the package name leaves the machine. ok=false when the
// registry couldn't be reached or answered unexpectedly.
func Lookup(ctx context.Context, ecosystem, name string) (exists bool, ageDays int, ok bool) {
	client := &http.Client{Timeout: 6 * time.Second}
	get := func(u string) (int, map[string]any) {
		req, _ := http.NewRequestWithContext(ctx, "GET", u, nil)
		req.Header.Set("User-Agent", "grain (https://github.com/FrontTribe/grain)")
		req.Header.Set("Accept", "application/json")
		res, err := client.Do(req)
		if err != nil {
			return 0, nil
		}
		defer res.Body.Close()
		var body map[string]any
		_ = json.NewDecoder(res.Body).Decode(&body)
		return res.StatusCode, body
	}
	age := func(iso string) int {
		t, err := time.Parse(time.RFC3339Nano, iso)
		if err != nil {
			if t, err = time.Parse("2006-01-02T15:04:05", iso); err != nil {
				return -1
			}
		}
		return int(time.Since(t).Hours() / 24)
	}
	switch ecosystem {
	case "npm":
		code, body := get("https://registry.npmjs.org/" + url.PathEscape(name))
		if code == 404 {
			return false, -1, true
		}
		if code != 200 {
			return false, -1, false
		}
		if tm, _ := body["time"].(map[string]any); tm != nil {
			if c, _ := tm["created"].(string); c != "" {
				return true, age(c), true
			}
		}
		return true, -1, true
	case "pypi":
		code, body := get("https://pypi.org/pypi/" + url.PathEscape(name) + "/json")
		if code == 404 {
			return false, -1, true
		}
		if code != 200 {
			return false, -1, false
		}
		// Age: the earliest upload across releases.
		earliest := -1
		if rel, _ := body["releases"].(map[string]any); rel != nil {
			for _, files := range rel {
				for _, f := range asSlice(files) {
					if fm, _ := f.(map[string]any); fm != nil {
						if up, _ := fm["upload_time_iso_8601"].(string); up != "" {
							if a := age(up); a > earliest {
								earliest = a
							}
						}
					}
				}
			}
		}
		return true, earliest, true
	case "go":
		code, _ := get("https://proxy.golang.org/" + escapeGoModule(name) + "/@latest")
		if code == 404 || code == 410 {
			return false, -1, true
		}
		if code != 200 {
			return false, -1, false
		}
		return true, -1, true
	case "cargo":
		code, body := get("https://crates.io/api/v1/crates/" + url.PathEscape(name))
		if code == 404 {
			return false, -1, true
		}
		if code != 200 {
			return false, -1, false
		}
		if c, _ := body["crate"].(map[string]any); c != nil {
			if created, _ := c["created_at"].(string); created != "" {
				return true, age(created), true
			}
		}
		return true, -1, true
	case "rubygems":
		code, body := get("https://rubygems.org/api/v1/gems/" + url.PathEscape(name) + ".json")
		if code == 404 {
			return false, -1, true
		}
		if code != 200 {
			return false, -1, false
		}
		if created, _ := body["created_at"].(string); created != "" {
			return true, age(created), true
		}
		return true, -1, true
	}
	return false, -1, false
}

func asSlice(v any) []any {
	s, _ := v.([]any)
	return s
}

// escapeGoModule applies the Go proxy's case encoding (upper → !lower).
func escapeGoModule(m string) string {
	var b strings.Builder
	for _, r := range m {
		if r >= 'A' && r <= 'Z' {
			b.WriteByte('!')
			b.WriteRune(r + ('a' - 'A'))
		} else {
			b.WriteRune(r)
		}
	}
	return b.String()
}

// RegistryURL is where a human would look the package up.
func RegistryURL(ecosystem, name string) string {
	switch ecosystem {
	case "npm":
		return "https://www.npmjs.com/package/" + name
	case "pypi":
		return "https://pypi.org/project/" + name + "/"
	case "go":
		return "https://pkg.go.dev/" + name
	case "cargo":
		return "https://crates.io/crates/" + name
	case "rubygems":
		return "https://rubygems.org/gems/" + name
	}
	return ""
}

// Compute lists the dependencies added over the commits, attributed like
// risk.Compute (attested line hashes, else declared commits), and optionally
// checks each distinct name against its registry.
func Compute(ctx context.Context, commits []gitlog.Commit, added map[string]map[string][]string, firstParent map[string]bool, cfg config.Config, checkRegistry bool) Summary {
	sum := Summary{Commits: len(commits), Source: "cli", Checked: checkRegistry}
	seen := map[string]bool{} // ecosystem/name: first introduction wins
	var deps []Dep

	// Oldest first, so a dependency is attributed to the commit that added it.
	for i := len(commits) - 1; i >= 0; i-- {
		c := commits[i]
		files := added[c.SHA]
		if len(files) == 0 {
			continue
		}
		var s signal.Set
		var hashes map[string]bool
		attributed := false
		for path, lines := range files {
			if !IsManifest(path) {
				continue
			}
			if !attributed {
				s = signal.Extract(c, cfg)
				hashes = outcomes.AIHashes(c.Note)
				attributed = true
			}
			lineLevel := len(hashes) > 0
			wholeAI := !lineLevel && (s.AttestedClass == "ai" || s.DeclaredAI)
			reviewed := risk.Reviewed(c, firstParent)
			for _, l := range lines {
				name, eco, ok := Parse(path, l)
				if !ok {
					continue
				}
				key := eco + "/" + name
				if seen[key] {
					continue
				}
				seen[key] = true
				ai := wholeAI || (lineLevel && outcomes.Substantive(l) && hashes[outcomes.LineHash(l)])
				deps = append(deps, Dep{
					Name: name, Ecosystem: eco, Manifest: path, SHA: c.SHA, Subject: strings.TrimSpace(c.Subject),
					AI: ai, Reviewed: reviewed, AgeDays: -1, URL: RegistryURL(eco, name),
				})
			}
		}
	}

	if checkRegistry {
		for i := range deps {
			d := &deps[i]
			exists, ageDays, ok := Lookup(ctx, d.Ecosystem, d.Name)
			if !ok {
				continue
			}
			d.Checked = true
			d.Exists = exists
			d.AgeDays = ageDays
		}
	}

	for _, d := range deps {
		sum.Total++
		if d.AI {
			sum.AI++
			if !d.Reviewed {
				sum.AIUnreviewed++
			}
		}
		if d.Checked && !d.Exists {
			sum.Missing++
		}
		if d.Checked && d.Exists && d.AgeDays >= 0 && d.AgeDays < YoungDays {
			sum.Young++
		}
	}
	sort.SliceStable(deps, func(i, j int) bool { return rank(deps[i]) > rank(deps[j]) })
	if len(deps) > maxDeps {
		deps = deps[:maxDeps]
	}
	sum.Deps = deps
	return sum
}

func rank(d Dep) int {
	r := 0
	if d.Checked && !d.Exists {
		r += 16
	}
	if d.Checked && d.Exists && d.AgeDays >= 0 && d.AgeDays < YoungDays {
		r += 8
	}
	if d.AI {
		r += 4
	}
	if !d.Reviewed {
		r += 2
	}
	return r
}
