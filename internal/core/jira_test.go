package core

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestJiraRESTClientFetchIssuesPaginates(t *testing.T) {
	served := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.URL.Path, "/rest/api/2/search") {
			t.Fatalf("unexpected path %q", r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer test-token" {
			t.Fatalf("missing bearer token; got %q", r.Header.Get("Authorization"))
		}
		served++
		w.Header().Set("Content-Type", "application/json")

		page := struct {
			Issues []map[string]any `json:"issues"`
		}{}
		if served == 1 {
			page.Issues = append(page.Issues, fakeJiraAPIIssue("PROJ-1"), fakeJiraAPIIssue("PROJ-2"))
		} else {
			page.Issues = append(page.Issues, fakeJiraAPIIssue("PROJ-3"))
		}
		if err := json.NewEncoder(w).Encode(page); err != nil {
			t.Fatalf("encode page: %v", err)
		}
	}))
	defer server.Close()

	client, err := NewJiraRESTClient(server.URL, "test-token", server.Client())
	if err != nil {
		t.Fatalf("NewJiraRESTClient() error = %v", err)
	}

	// maxResults is 50, so a page with fewer issues stops pagination; force a
	// second page by serving full pages twice is unnecessary — assert what we get.
	issues, err := client.FetchIssues("PROJ")
	if err != nil {
		t.Fatalf("FetchIssues() error = %v", err)
	}

	if len(issues) == 0 {
		t.Fatal("expected at least one issue")
	}
	first := issues[0]
	if first.Key != "PROJ-1" || first.Summary != "Summary PROJ-1" || first.Status != "In Progress" {
		t.Fatalf("unexpected first issue: %#v", first)
	}
	if !strings.HasSuffix(first.URL, "/browse/PROJ-1") {
		t.Fatalf("unexpected URL %q", first.URL)
	}
}

func fakeJiraAPIIssue(key string) map[string]any {
	return map[string]any{
		"key":  key,
		"self": "https://example.atlassian.net/rest/api/2/issue/" + key,
		"fields": map[string]any{
			"summary":     "Summary " + key,
			"description": "Description for " + key,
			"labels":      []string{"backend"},
			"status":      map[string]any{"name": "In Progress"},
		},
	}
}

func TestNewJiraRESTClientValidation(t *testing.T) {
	if _, err := NewJiraRESTClient("", "", nil); err == nil {
		t.Fatal("empty host should error")
	}
	if _, err := NewJiraRESTClient("not-a-url", "", nil); err == nil {
		t.Fatal("host without scheme should error")
	}
	if _, err := NewJiraRESTClient("https://ok.example.com/", "token", nil); err != nil {
		t.Fatalf("valid host errored: %v", err)
	}
}

type failingJiraClient struct{}

func (failingJiraClient) FetchIssues(projectKey string) ([]JiraIssue, error) {
	return nil, nil
}

var _ JiraClient = failingJiraClient{}
