package credentials

import (
	"os"
	"path/filepath"
	"testing"
)

func TestStoreSetGetDelete(t *testing.T) {
	t.Parallel()

	s := &Store{}
	s.Set(ServiceJira, "default", "user@example.com", "token123")
	cred, ok := s.Get(ServiceJira, "default")
	if !ok || cred.Token != "token123" || cred.Email != "user@example.com" {
		t.Fatalf("Get after Set = %#v ok=%v, want token123", cred, ok)
	}
	// Get is case-insensitive for service, alias normalized
	cred, ok = s.Get("JIRA", "")
	if !ok || cred.Token != "token123" {
		t.Fatalf("Get with empty alias/service case-insensitive = %#v ok=%v", cred, ok)
	}
	s.Delete(ServiceJira, "default")
	if _, ok := s.Get(ServiceJira, "default"); ok {
		t.Fatal("Get after Delete should be not ok")
	}
}

func TestStoreSetNormalizesAlias(t *testing.T) {
	t.Parallel()

	s := &Store{}
	s.Set(ServiceJira, "  j1  ", "a@b.com", "tok")
	if _, ok := s.Get(ServiceJira, "j1"); !ok {
		t.Fatal("expected j1 alias trimmed")
	}
	// empty alias maps to default
	s.Set(ServiceJira, "", "d@e.com", "dtok")
	if _, ok := s.Get(ServiceJira, "default"); !ok {
		t.Fatal("empty alias should map to default")
	}
}

func TestStoreGetRequiresToken(t *testing.T) {
	t.Parallel()

	s := &Store{}
	s.Set(ServiceJira, "no-token", "a@b.com", "")
	if _, ok := s.Get(ServiceJira, "no-token"); ok {
		t.Fatal("Get should return false when token empty")
	}
}

func TestPathForWorkspaceEnvOverride(t *testing.T) {
	t.Parallel()

	env := []string{"FLOW_CREDENTIALS_PATH=/tmp/custom"}
	got := PathForWorkspace("/some/config", env)
	if got != "/tmp/custom" {
		t.Fatalf("PathForWorkspace with env = %q want /tmp/custom", got)
	}
	got2 := PathForWorkspace("", nil)
	if got2 == "" {
		t.Fatal("PathForWorkspace without configDir should not be empty")
	}
}

func TestSaveAndLoadWithEnv(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	credPath := filepath.Join(dir, "creds")
	env := []string{"FLOW_CREDENTIALS_PATH=" + credPath}

	s := &Store{}
	s.Set(ServiceJira, "default", "user@example.com", "tok123")
	s.Set(ServiceAha, "team-a", "", "aha-token")

	if err := s.SaveWithEnv(env); err != nil {
		t.Fatalf("SaveWithEnv error = %v", err)
	}
	// permissions 0600
	info, err := os.Stat(credPath)
	if err != nil {
		t.Fatalf("Stat cred file error = %v", err)
	}
	if info.Mode().Perm() != 0600 {
		t.Fatalf("cred file perm = %o want 0600", info.Mode().Perm())
	}

	loaded, err := LoadWithEnv(env)
	if err != nil {
		t.Fatalf("LoadWithEnv error = %v", err)
	}
	cred, ok := loaded.Get(ServiceJira, "default")
	if !ok || cred.Token != "tok123" {
		t.Fatalf("loaded jira cred = %#v ok=%v", cred, ok)
	}
	cred, ok = loaded.Get(ServiceAha, "team-a")
	if !ok || cred.Token != "aha-token" {
		t.Fatalf("loaded aha cred = %#v ok=%v", cred, ok)
	}
}

func TestResolveTokenEnvPrecedence(t *testing.T) {
	t.Parallel()

	store := &Store{}
	store.Set(ServiceJira, "default", "store@example.com", "store-token")
	store.Set(ServiceJira, "j1", "j1-store@example.com", "j1-store-token")

	// Env overrides store for default alias
	env := []string{"FLOW_JIRA_API_TOKEN=jira-env-token", "FLOW_JIRA_EMAIL=env@example.com"}
	email, token, source := ResolveToken(ServiceJira, "default", env, store)
	if token != "jira-env-token" || source != "env" || email != "env@example.com" {
		t.Fatalf("ResolveToken default env = %q %q %q want env", email, token, source)
	}

	// Alias-specific env token
	env2 := []string{"FLOW_JIRA_API_TOKEN_J1=j1-env-token", "FLOW_JIRA_EMAIL_J1=j1-env@example.com", "FLOW_JIRA_API_TOKEN=fallback"}
	email, token, source = ResolveToken(ServiceJira, "j1", env2, store)
	if token != "j1-env-token" || source != "env" {
		t.Fatalf("ResolveToken alias env = %q %q %q", email, token, source)
	}

	// Alias with dash normalized to underscore
	store.Set(ServiceJira, "my-alias", "", "dash-store")
	env3 := []string{"FLOW_JIRA_API_TOKEN_MY_ALIAS=dash-env-token"}
	_, token, source = ResolveToken(ServiceJira, "my-alias", env3, store)
	if token != "dash-env-token" || source != "env" {
		t.Fatalf("ResolveToken dash alias = %q %q", token, source)
	}

	// No env, fallback to store
	_, token, source = ResolveToken(ServiceJira, "default", nil, store)
	if token != "store-token" || source != "credentials" {
		t.Fatalf("ResolveToken store fallback = %q %q", token, source)
	}

	// No env, no store -> empty
	_, token, source = ResolveToken(ServiceJira, "missing", nil, store)
	if token != "" || source != "" {
		t.Fatalf("ResolveToken missing = %q %q want empty", token, source)
	}
}

func TestResolveTokenAha(t *testing.T) {
	t.Parallel()

	store := &Store{}
	store.Set(ServiceAha, "default", "", "aha-store")
	env := []string{"FLOW_AHA_API_TOKEN=aha-env"}
	_, token, source := ResolveToken(ServiceAha, "default", env, store)
	if token != "aha-env" || source != "env" {
		t.Fatalf("ResolveToken aha env = %q %q", token, source)
	}
	_, token, source = ResolveToken(ServiceAha, "default", nil, store)
	if token != "aha-store" || source != "credentials" {
		t.Fatalf("ResolveToken aha store = %q %q", token, source)
	}
}

func TestLoadForWorkspaceFallsBackToStore(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	configDir := filepath.Join(dir, "config")
	if err := os.MkdirAll(configDir, 0700); err != nil {
		t.Fatalf("MkdirAll error = %v", err)
	}
	// Write credentials to workspace path
	s := &Store{}
	s.Set(ServiceJira, "default", "", "ws-token")
	if err := s.SaveForWorkspace(configDir, nil); err != nil {
		t.Fatalf("SaveForWorkspace error = %v", err)
	}
	loaded, err := LoadForWorkspace(configDir, nil)
	if err != nil {
		t.Fatalf("LoadForWorkspace error = %v", err)
	}
	cred, ok := loaded.Get(ServiceJira, "default")
	if !ok || cred.Token != "ws-token" {
		t.Fatalf("LoadForWorkspace loaded = %#v ok=%v", cred, ok)
	}
}

func TestLoadForWorkspaceEnvOverride(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	customPath := filepath.Join(dir, "custom-creds")
	env := []string{"FLOW_CREDENTIALS_PATH=" + customPath}
	s := &Store{}
	s.Set(ServiceJira, "default", "", "custom-token")
	if err := s.SaveWithEnv(env); err != nil {
		t.Fatalf("SaveWithEnv error = %v", err)
	}
	loaded, err := LoadForWorkspace("/irrelevant/config", env)
	if err != nil {
		t.Fatalf("LoadForWorkspace env override error = %v", err)
	}
	cred, ok := loaded.Get(ServiceJira, "default")
	if !ok || cred.Token != "custom-token" {
		t.Fatalf("env override loaded = %#v", cred)
	}
}

func TestDeleteServiceCaseInsensitive(t *testing.T) {
	t.Parallel()

	s := &Store{}
	s.Set(ServiceJira, "default", "", "tok")
	s.Delete("JIRA", "default")
	if _, ok := s.Get(ServiceJira, "default"); ok {
		t.Fatal("Delete should be case-insensitive")
	}
}
