package security

import (
	"bytes"
	"os"
	"testing"
)

func ids(ps []Pattern) []string {
	out := make([]string, 0, len(ps))
	for _, p := range ps {
		out = append(out, p.ID)
	}
	return out
}

func TestPatternsHitAndMiss(t *testing.T) {
	cases := []struct {
		path, line string
		want       string // "" = no finding
	}{
		{"cmd/x.go", `cfg := &tls.Config{InsecureSkipVerify: true}`, "tls.verification-disabled"},
		{"api/client.ts", `https.request({ rejectUnauthorized: false })`, "tls.verification-disabled"},
		{"app.py", `requests.get(url, verify=False)`, "tls.verification-disabled"},
		{"deploy/aws.tf", `access_key = "AKIAIOSFODNN7EXAMPLE"`, "secret.aws-access-key"},
		{"lib/gh.ts", `const token = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij"`, "secret.github-token"},
		{"config.py", `API_KEY = "a1b2c3d4e5f6g7h8i9j0k1l2"`, "secret.hardcoded-credential"},
		{"config.py", `API_KEY = os.getenv("API_KEY")`, ""},
		{"config.py", `api_key: "<your-api-key-here>"`, ""},
		{"db.py", `cur.execute("SELECT * FROM users WHERE name = '" + name + "'")`, "sql.string-concat"},
		{"db.py", `cur.execute(f"SELECT * FROM users WHERE id = {uid}")`, "sql.string-concat"},
		{"db.go", `db.Query("SELECT * FROM users WHERE id = $1", id)`, ""},
		{"run.py", `subprocess.run("ls " + path, shell=True)`, "exec.shell-with-input"},
		{"run.py", `subprocess.run(["ls", path])`, ""},
		{"ui/Post.tsx", `<div dangerouslySetInnerHTML={{ __html: body }} />`, "xss.inner-html"},
		{"load.py", `data = pickle.loads(blob)`, "deser.unsafe-load"},
		{"load.py", `yaml.load(f, Loader=yaml.SafeLoader)`, ""},
		{"load.py", `yaml.load(f)`, "deser.unsafe-load"},
		{"iam/policy.json", `"Action": "*",`, "iam.wildcard"},
		{"settings.py", `DEBUG = True`, "debug.enabled-in-code"},
		{"server.ts", `app.use(cors())`, "net.cors-any-origin"},
		{"auth.js", `const otp = Math.random().toString(36).slice(2)`, "crypto.math-random-secret"},
		{"auth.py", `hashed = hashlib.md5(password.encode()).hexdigest()`, "crypto.weak-hash-for-password"},
		{"Makefile", `git commit -m "wip" --no-verify`, "git.no-verify"},
		{".env", `DATABASE_URL=postgres://x`, "env.file-committed"},
		{".env.example", `DATABASE_URL=`, ""},
		// comments, definitions and tests never count
		{"x.go", `// InsecureSkipVerify: true is wrong`, ""},
		{"x.go", "re := regexp.MustCompile(`InsecureSkipVerify\\s*:\\s*true`)", ""},
		{"internal/x_test.go", `cfg := &tls.Config{InsecureSkipVerify: true}`, ""},
		{"fixtures/keys.txt", `AKIAIOSFODNN7EXAMPLE`, ""},
		{"docs/security.md", `a pasted token, rejectUnauthorized: false, a shell command`, ""},
	}
	for _, c := range cases {
		got := ids(Check(c.path, c.line))
		if c.want == "" {
			if len(got) != 0 {
				t.Errorf("%s: %q: want no finding, got %v", c.path, c.line, got)
			}
			continue
		}
		found := false
		for _, g := range got {
			if g == c.want {
				found = true
			}
		}
		if !found {
			t.Errorf("%s: %q: want %s, got %v", c.path, c.line, c.want, got)
		}
	}
}

func TestExcerptRedactsSecrets(t *testing.T) {
	var p Pattern
	for _, q := range Patterns() {
		if q.ID == "secret.aws-access-key" {
			p = q
		}
	}
	got := Excerpt(p, `key = "AKIAIOSFODNN7EXAMPLE"`)
	if got != `key = "AKIAIO…"` {
		t.Fatalf("redaction: %q", got)
	}
}

// The Cloud scanner must run the identical rule set: the JSON is copied into
// web/src/lib/security-patterns.json and this test keeps the copy honest.
func TestCloudCopyOfPatternsIsIdentical(t *testing.T) {
	cloud, err := os.ReadFile("../../web/src/lib/security-patterns.json")
	if err != nil {
		t.Skip("web copy not present:", err)
	}
	if !bytes.Equal(bytes.TrimSpace(cloud), bytes.TrimSpace(PatternsJSON)) {
		t.Fatal("web/src/lib/security-patterns.json differs from internal/security/patterns.json; copy it over")
	}
}
