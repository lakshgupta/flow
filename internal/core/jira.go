package core

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

// TokenCredentialEnvVar is the environment variable read for Jira API
// credentials at sync time. Tokens are never persisted in workspace config.
const JiraTokenEnvVar = "FLOW_JIRA_API_TOKEN"

// JiraIssue is the mirrored subset of a Jira issue.
type JiraIssue struct {
	Key         string   `json:"key"`
	Summary     string   `json:"summary"`
	Description string   `json:"description"`
	Status      string   `json:"status"`
	Labels      []string `json:"labels,omitempty"`
	URL         string   `json:"url"`
}

// JiraClient fetches issues for one project key. Implementations must be
// read-only: Flow never writes back to the tracker. Aha support later
// implements the same shape behind an adapter.
type JiraClient interface {
	FetchIssues(projectKey string) ([]JiraIssue, error)
}

// JiraRESTClient talks to the Jira REST API v2 over HTTP.
type JiraRESTClient struct {
	Host  string
	Token string
	HTTP  *http.Client
}

// NewJiraRESTClient builds a REST client for a Jira base URL, for example
// "https://example.atlassian.net". The token is used as a bearer token when
// non-empty.
func NewJiraRESTClient(host string, token string, httpClient *http.Client) (*JiraRESTClient, error) {
	host = strings.TrimRight(strings.TrimSpace(host), "/")
	if host == "" {
		return nil, fmt.Errorf("jira host must not be empty")
	}
	parsed, err := url.Parse(host)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return nil, fmt.Errorf("jira host %q is not a valid URL", host)
	}
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	return &JiraRESTClient{Host: host, Token: strings.TrimSpace(token), HTTP: httpClient}, nil
}

// FetchIssues implements JiraClient using paginated search requests.
func (client *JiraRESTClient) FetchIssues(projectKey string) ([]JiraIssue, error) {
	projectKey = strings.TrimSpace(projectKey)
	if projectKey == "" {
		return nil, fmt.Errorf("project key must not be empty")
	}

	issues := []JiraIssue{}
	startAt := 0
	maxResults := 50

	for {
		searchAPI := client.Host + "/rest/api/2/search?jql=" + url.QueryEscape(fmt.Sprintf("project = %q ORDER BY key ASC", projectKey)) +
			fmt.Sprintf("&startAt=%d&maxResults=%d&fields=summary,description,status,labels", startAt, maxResults)

		request, err := http.NewRequest(http.MethodGet, searchAPI, nil)
		if err != nil {
			return nil, fmt.Errorf("build jira request: %w", err)
		}
		request.Header.Set("Accept", "application/json")
		if client.Token != "" {
			request.Header.Set("Authorization", "Bearer "+client.Token)
		}

		response, err := client.HTTP.Do(request)
		if err != nil {
			return nil, fmt.Errorf("call jira search: %w", err)
		}
		payload, err := io.ReadAll(response.Body)
		response.Body.Close()
		if err != nil {
			return nil, fmt.Errorf("read jira response: %w", err)
		}
		if response.StatusCode < 200 || response.StatusCode >= 300 {
			return nil, fmt.Errorf("jira search failed: HTTP %d", response.StatusCode)
		}

		var page struct {
			Issues []struct {
				Key    string `json:"key"`
				Self   string `json:"self"`
				Fields struct {
					Summary     string   `json:"summary"`
					Description string   `json:"description"`
					Labels      []string `json:"labels"`
					Status      struct {
						Name string `json:"name"`
					} `json:"status"`
				} `json:"fields"`
			} `json:"issues"`
		}
		if err := json.Unmarshal(payload, &page); err != nil {
			return nil, fmt.Errorf("parse jira response: %w", err)
		}

		for _, issue := range page.Issues {
			issues = append(issues, JiraIssue{
				Key:         issue.Key,
				Summary:     issue.Fields.Summary,
				Description: issue.Fields.Description,
				Status:      issue.Fields.Status.Name,
				Labels:      issue.Fields.Labels,
				URL:         client.Host + "/browse/" + issue.Key,
			})
		}

		if len(page.Issues) < maxResults {
			break
		}
		startAt += len(page.Issues)
	}

	return issues, nil
}
