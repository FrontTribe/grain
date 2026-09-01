// Package gitlog reads commit history by shelling out to the `git` binary.
// Shelling out (rather than a git library) keeps grain dependency-free and
// works against any repository the user can already run `git` in.
package gitlog

import (
	"bytes"
	"fmt"
	"os/exec"
	"strconv"
	"strings"
)

// FileChange is one file touched by a commit, with its line deltas.
// Added/Deleted are 0 for binary files (git reports "-").
type FileChange struct {
	Path    string
	Added   int
	Deleted int
}

// Commit is a single non-merge commit with the fields grain scores on.
type Commit struct {
	SHA            string
	AuthorName     string
	AuthorEmail    string
	CommitterName  string
	CommitterEmail string
	AuthorTime     int64
	CommitTime     int64
	Subject        string
	Body           string
	Files          []FileChange
}

// Lines returns total churn (added + deleted) across all files.
func (c Commit) Lines() int {
	n := 0
	for _, f := range c.Files {
		n += f.Added + f.Deleted
	}
	return n
}

const (
	rs = "\x1e" // record separator between commits
	us = "\x1f" // unit separator between fields
)

// Toplevel returns the absolute path of the repository root containing dir.
func Toplevel(dir string) (string, error) {
	out, err := run(dir, "rev-parse", "--show-toplevel")
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(out), nil
}

// RemoteSlug returns "owner/repo" parsed from origin, or "" if unavailable.
func RemoteSlug(dir string) string {
	out, err := run(dir, "config", "--get", "remote.origin.url")
	if err != nil {
		return ""
	}
	url := strings.TrimSpace(out)
	url = strings.TrimSuffix(url, ".git")
	url = strings.TrimSuffix(url, "/")
	if i := strings.Index(url, "github.com"); i >= 0 {
		rest := url[i+len("github.com"):]
		rest = strings.TrimLeft(rest, ":/")
		if strings.Count(rest, "/") >= 1 {
			return rest
		}
	}
	// fall back to the last two path segments
	parts := strings.Split(url, "/")
	if len(parts) >= 2 {
		return parts[len(parts)-2] + "/" + parts[len(parts)-1]
	}
	return url
}

// ReadCommits returns commits reachable from rev (empty = current HEAD/all),
// newest first, capped at max (0 = no cap).
func ReadCommits(dir, rev string, max int) ([]Commit, error) {
	meta, err := readMeta(dir, rev, max)
	if err != nil {
		return nil, err
	}
	files, err := readNumstat(dir, rev, max)
	if err != nil {
		return nil, err
	}
	for i := range meta {
		meta[i].Files = files[meta[i].SHA]
	}
	return meta, nil
}

func readMeta(dir, rev string, max int) ([]Commit, error) {
	format := strings.Join([]string{
		"%H", "%an", "%ae", "%cn", "%ce", "%at", "%ct", "%s", "%b",
	}, us) + rs
	args := []string{"log", "--no-merges", "--date=unix", "--pretty=format:" + format}
	if max > 0 {
		args = append(args, fmt.Sprintf("--max-count=%d", max))
	}
	if rev != "" {
		args = append(args, rev)
	}
	out, err := run(dir, args...)
	if err != nil {
		return nil, err
	}
	var commits []Commit
	for _, rec := range strings.Split(out, rs) {
		rec = strings.Trim(rec, "\n")
		if rec == "" {
			continue
		}
		f := strings.Split(rec, us)
		if len(f) < 9 {
			continue
		}
		at, _ := strconv.ParseInt(strings.TrimSpace(f[5]), 10, 64)
		ct, _ := strconv.ParseInt(strings.TrimSpace(f[6]), 10, 64)
		commits = append(commits, Commit{
			SHA:            f[0],
			AuthorName:     f[1],
			AuthorEmail:    f[2],
			CommitterName:  f[3],
			CommitterEmail: f[4],
			AuthorTime:     at,
			CommitTime:     ct,
			Subject:        f[7],
			Body:           f[8],
		})
	}
	return commits, nil
}

func readNumstat(dir, rev string, max int) (map[string][]FileChange, error) {
	args := []string{"log", "--no-merges", "--numstat", "--format=" + rs + "%H"}
	if max > 0 {
		args = append(args, fmt.Sprintf("--max-count=%d", max))
	}
	if rev != "" {
		args = append(args, rev)
	}
	out, err := run(dir, args...)
	if err != nil {
		return nil, err
	}
	result := make(map[string][]FileChange)
	for _, chunk := range strings.Split(out, rs) {
		chunk = strings.Trim(chunk, "\n")
		if chunk == "" {
			continue
		}
		lines := strings.Split(chunk, "\n")
		sha := strings.TrimSpace(lines[0])
		if sha == "" {
			continue
		}
		for _, ln := range lines[1:] {
			ln = strings.TrimSpace(ln)
			if ln == "" {
				continue
			}
			cols := strings.SplitN(ln, "\t", 3)
			if len(cols) < 3 {
				continue
			}
			result[sha] = append(result[sha], FileChange{
				Path:    cols[2],
				Added:   atoiDash(cols[0]),
				Deleted: atoiDash(cols[1]),
			})
		}
	}
	return result, nil
}

func atoiDash(s string) int {
	if s == "-" || s == "" {
		return 0
	}
	n, _ := strconv.Atoi(s)
	return n
}

func run(dir string, args ...string) (string, error) {
	full := append([]string{"-C", dir}, args...)
	cmd := exec.Command("git", full...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		msg := strings.TrimSpace(stderr.String())
		if msg == "" {
			msg = err.Error()
		}
		return "", fmt.Errorf("git %s: %s", strings.Join(args, " "), msg)
	}
	return stdout.String(), nil
}
