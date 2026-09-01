package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/FrontTribe/grain/internal/gitlog"
	"github.com/FrontTribe/grain/internal/report"
)

// cmdPush scans the repository (or reads an existing grain.json) and POSTs it to
// a Grain Cloud ingest endpoint. Auth is a per-org bearer token minted in the
// dashboard (Settings → Ingest tokens).
func cmdPush(args []string) error {
	fs := flag.NewFlagSet("push", flag.ExitOnError)
	dir := fs.String("C", ".", "run in this directory")
	max := fs.Int("max", 0, "limit to the most recent N commits (0 = all)")
	file := fs.String("file", "", "read this grain.json instead of scanning")
	url := fs.String("url", os.Getenv("GRAIN_API"), "ingest endpoint (or GRAIN_API env)")
	token := fs.String("token", os.Getenv("GRAIN_TOKEN"), "ingest token (or GRAIN_TOKEN env)")
	fs.Parse(args)

	if strings.TrimSpace(*url) == "" {
		return fmt.Errorf("no ingest URL — pass --url or set GRAIN_API (e.g. https://your-app/api/ingest)")
	}
	if strings.TrimSpace(*token) == "" {
		return fmt.Errorf("no ingest token — pass --token or set GRAIN_TOKEN (mint one in Settings → Ingest tokens)")
	}

	var body []byte
	if *file != "" {
		b, err := os.ReadFile(*file)
		if err != nil {
			return err
		}
		body = b
	} else {
		root, cfg, err := setup(*dir)
		if err != nil {
			return err
		}
		commits, err := gitlog.ReadCommits(root, "", *max)
		if err != nil {
			return err
		}
		if len(commits) == 0 {
			return fmt.Errorf("no commits found")
		}
		rep := report.Build(repoName(root), today(), commits, classifyAll(commits, cfg), cfg)
		var buf bytes.Buffer
		if err := rep.WriteJSON(&buf); err != nil {
			return err
		}
		body = buf.Bytes()
	}

	req, err := http.NewRequest(http.MethodPost, *url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(*token))

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("push failed: %w", err)
	}
	defer resp.Body.Close()
	rb, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<16))

	if resp.StatusCode/100 != 2 {
		msg := strings.TrimSpace(string(rb))
		if m := jsonField(rb, "error"); m != "" {
			msg = m
		}
		return fmt.Errorf("ingest rejected (HTTP %d): %s", resp.StatusCode, msg)
	}

	human, ai := jsonField(rb, "human"), jsonField(rb, "ai")
	if human != "" || ai != "" {
		fmt.Printf("  ✓ pushed to Grain Cloud · %s%% human · %s%% AI-assisted\n", human, ai)
	} else {
		fmt.Println("  ✓ pushed to Grain Cloud")
	}
	return nil
}

// jsonField pulls a single top-level scalar field out of a small JSON object,
// rendered as a string. Avoids a struct just to read one value.
func jsonField(b []byte, key string) string {
	var m map[string]any
	if json.Unmarshal(b, &m) != nil {
		return ""
	}
	v, ok := m[key]
	if !ok || v == nil {
		return ""
	}
	switch t := v.(type) {
	case float64:
		return fmt.Sprintf("%g", t)
	case string:
		return t
	default:
		return fmt.Sprint(t)
	}
}
