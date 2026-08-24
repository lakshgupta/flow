package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestFlowSyncJiraMirrorsIssues(t *testing.T) {
	rootDir := t.TempDir()
	runForTest(t, []string{"init"}, rootDir)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"issues":[
			{"key":"PROJ-7","fields":{"summary":"Fix login","description":"Login is broken.","status":{"name":"Open"},"labels":["auth"]}}
		]}`))
	}))
	defer server.Close()

	stdout, stderr := runForTest(t, []string{
		"configure", "--jira-host", server.URL, "--jira-project", "PROJ",
	}, rootDir)
	if stderr != "" {
		t.Fatalf("configure stderr = %q", stderr)
	}

	t.Setenv("FLOW_JIRA_API_TOKEN", "test-token")

	stdout, stderr = runForTest(t, []string{"sync", "jira"}, rootDir)
	if stderr != "" {
		t.Fatalf("sync stderr = %q", stderr)
	}
	if !strings.Contains(stdout, "synced PROJ: 1 created") {
		t.Fatalf("unexpected sync output %q", stdout)
	}

	mirrorPath := filepath.Join(rootDir, ".flow", "data", "content", "external", "jira", "PROJ", "PROJ-7.md")
	data, err := os.ReadFile(mirrorPath)
	if err != nil {
		t.Fatalf("read mirrored ticket: %v", err)
	}
	if !strings.Contains(string(data), "id: external/jira/proj/proj-7") && !strings.Contains(string(data), "id: external/jira/PROJ/proj-7") {
		t.Fatalf("mirrored note missing stable id:\n%s", data)
	}
	if !strings.Contains(string(data), "Fix login") {
		t.Fatalf("mirrored note missing summary:\n%s", data)
	}
}

func TestFlowSyncJiraJSONAndExplicitProject(t *testing.T) {
	rootDir := t.TempDir()
	runForTest(t, []string{"init"}, rootDir)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"issues":[]}`))
	}))
	defer server.Close()

	runForTest(t, []string{"configure", "--jira-host", server.URL}, rootDir)

	stdout, stderr := runForTest(t, []string{"sync", "jira", "--project", "OTHER", "--json"}, rootDir)
	if stderr != "" {
		t.Fatalf("sync stderr = %q", stderr)
	}
	var decoded []map[string]any
	if err := json.Unmarshal([]byte(stdout), &decoded); err != nil {
		t.Fatalf("decode json output %q: %v", stdout, err)
	}
	if len(decoded) != 1 || decoded[0]["project"] != "OTHER" {
		t.Fatalf("unexpected json payload %q", stdout)
	}
}

func TestFlowSyncJiraRequiresConfiguration(t *testing.T) {
	rootDir := t.TempDir()
	runForTest(t, []string{"init"}, rootDir)
	stderr := runExpectErrorForTest(t, []string{"sync", "jira"}, rootDir)
	if !strings.Contains(stderr, "no Jira") {
		t.Fatalf("stderr = %q, want missing-configuration message", stderr)
	}
}
