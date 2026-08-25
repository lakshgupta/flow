package credentials

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"
)

// Service name constants.
const (
	ServiceJira = "jira"
	ServiceAha  = "aha"
)

// DefaultAlias is used when no alias is specified.
const DefaultAlias = "default"

// DefaultServiceAlias is an alias for DefaultAlias for Jira/Aha configs (kept for compatibility with config package).
const DefaultServiceAlias = DefaultAlias

// Store holds per-service, per-alias credentials.
// YAML shape:
//
//	jira:
//	  default:
//	    email: user@example.com
//	    token: api-token
//	  j1:
//	    token: other
//	aha:
//	  default:
//	    token: xxx
type Store struct {
	Jira map[string]ServiceCredentials `yaml:"jira,omitempty"`
	Aha  map[string]ServiceCredentials `yaml:"aha,omitempty"`
}

// ServiceCredentials holds the sensitive part for one alias.
// Host is stored in flow.yaml; only token/email live here.
type ServiceCredentials struct {
	Email string `yaml:"email,omitempty"`
	Token string `yaml:"token,omitempty"`
}

// Path returns the legacy global credentials file path: $XDG_CONFIG_HOME/flow/credentials
// (UserConfigDir/flow/credentials). Prefer PathForWorkspace for per-workspace storage.
func Path() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("resolve user config directory: %w", err)
	}
	return filepath.Join(dir, "flow", "credentials"), nil
}

// PathForWorkspace returns the credentials file for a workspace.
// It lives at <workspace>/.flow/config/credentials (0600) so global vs local
// workspaces have isolated tokens. FLOW_CREDENTIALS_PATH env overrides for tests.
func PathForWorkspace(configDir string, env []string) string {
	for _, kv := range env {
		if strings.HasPrefix(kv, "FLOW_CREDENTIALS_PATH=") {
			return strings.TrimPrefix(kv, "FLOW_CREDENTIALS_PATH=")
		}
	}
	if configDir != "" {
		return filepath.Join(configDir, "credentials")
	}
	p, _ := Path()
	return p
}

// PathForTest allows overriding the path in tests via env.
func pathForEnv(env []string) string {
	if p, ok := envOverride(env); ok {
		return p
	}
	p, _ := Path()
	return p
}

func envOverride(env []string) (string, bool) {
	for _, kv := range env {
		if strings.HasPrefix(kv, "FLOW_CREDENTIALS_PATH=") {
			return strings.TrimPrefix(kv, "FLOW_CREDENTIALS_PATH="), true
		}
	}
	return "", false
}

func ensureStoreMaps(s *Store) {
	if s.Jira == nil {
		s.Jira = map[string]ServiceCredentials{}
	}
	if s.Aha == nil {
		s.Aha = map[string]ServiceCredentials{}
	}
}

func loadStore(path string) (*Store, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return &Store{}, nil
		}
		return nil, fmt.Errorf("read credentials: %w", err)
	}
	var s Store
	if err := yaml.Unmarshal(data, &s); err != nil {
		return nil, fmt.Errorf("parse credentials: %w", err)
	}
	ensureStoreMaps(&s)
	return &s, nil
}

func writeStore(path string, s *Store) error {
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return fmt.Errorf("create credentials directory: %w", err)
	}
	if len(s.Jira) == 0 {
		s.Jira = nil
	}
	if len(s.Aha) == 0 {
		s.Aha = nil
	}
	data, err := yaml.Marshal(s)
	if err != nil {
		return fmt.Errorf("marshal credentials: %w", err)
	}
	if err := os.WriteFile(path, data, 0600); err != nil {
		return fmt.Errorf("write credentials: %w", err)
	}
	return nil
}

func serviceMap(s *Store, service string, create bool) (map[string]ServiceCredentials, bool) {
	if s == nil {
		return nil, false
	}
	switch strings.ToLower(strings.TrimSpace(service)) {
	case ServiceJira:
		if s.Jira == nil && create {
			s.Jira = map[string]ServiceCredentials{}
		}
		return s.Jira, true
	case ServiceAha:
		if s.Aha == nil && create {
			s.Aha = map[string]ServiceCredentials{}
		}
		return s.Aha, true
	default:
		return nil, false
	}
}

// Load reads the credentials file. Missing file returns empty store.
func Load() (*Store, error) {
	return LoadWithEnv(os.Environ())
}

// LoadWithEnv is test-friendly variant that respects FLOW_CREDENTIALS_PATH.
func LoadWithEnv(env []string) (*Store, error) {
	return loadStore(pathForEnv(env))
}

// LoadForWorkspace reads credentials for a workspace's config dir.
// e.g. <workspace>/.flow/config/credentials . Falls back to legacy global
// path if per-workspace file missing and legacy file exists (migration aid).
func LoadForWorkspace(configDir string, env []string) (*Store, error) {
	path := PathForWorkspace(configDir, env)
	data, err := os.ReadFile(path)
	if err == nil {
		var s Store
		if err := yaml.Unmarshal(data, &s); err != nil {
			return nil, fmt.Errorf("parse credentials: %w", err)
		}
		ensureStoreMaps(&s)
		return &s, nil
	}
	if !os.IsNotExist(err) {
		return nil, fmt.Errorf("read credentials: %w", err)
	}
	if _, overridden := envOverride(env); !overridden && configDir != "" {
		if legacy, _ := Path(); legacy != path {
			if data, err := os.ReadFile(legacy); err == nil {
				var s Store
				if err := yaml.Unmarshal(data, &s); err == nil {
					ensureStoreMaps(&s)
					if len(s.Jira) > 0 || len(s.Aha) > 0 {
						return &s, nil
					}
				}
			}
		}
	}
	return &Store{}, nil
}

// Save persists the store with 0600 permissions.
func (s *Store) Save() error {
	return s.SaveWithEnv(os.Environ())
}

// SaveWithEnv respects FLOW_CREDENTIALS_PATH for tests.
func (s *Store) SaveWithEnv(env []string) error {
	return writeStore(pathForEnv(env), s)
}

// SaveForWorkspace persists credentials to <configDir>/credentials (0600),
// so `flow sync` vs `flow -g sync` use isolated tokens.
func (s *Store) SaveForWorkspace(configDir string, env []string) error {
	return writeStore(PathForWorkspace(configDir, env), s)
}

// Get returns credentials for service/alias. Alias empty means default.
func (s *Store) Get(service, alias string) (ServiceCredentials, bool) {
	m, ok := serviceMap(s, service, false)
	if !ok {
		return ServiceCredentials{}, false
	}
	alias = normalizeAlias(alias)
	cred, ok := m[alias]
	return cred, ok && cred.Token != ""
}

// Set stores credentials for service/alias.
func (s *Store) Set(service, alias, email, token string) {
	alias = normalizeAlias(alias)
	if alias == "" {
		alias = DefaultServiceAlias
	}
	cred := ServiceCredentials{Email: strings.TrimSpace(email), Token: strings.TrimSpace(token)}
	if m, ok := serviceMap(s, service, true); ok {
		m[alias] = cred
	}
}

// Delete removes an alias.
func (s *Store) Delete(service, alias string) {
	if m, ok := serviceMap(s, service, false); ok {
		delete(m, normalizeAlias(alias))
	}
}

func normalizeAlias(alias string) string {
	alias = strings.TrimSpace(alias)
	if alias == "" {
		return DefaultAlias
	}
	return alias
}

func lookupEnvToken(prefix, alias string, envMap map[string]string) string {
	if alias != DefaultAlias {
		candidate := prefix + "_" + strings.ToUpper(strings.ReplaceAll(alias, "-", "_"))
		if v, ok := envMap[candidate]; ok && strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	if v, ok := envMap[prefix]; ok && strings.TrimSpace(v) != "" {
		return strings.TrimSpace(v)
	}
	return ""
}

// ResolveToken returns token/email for service/alias, checking env vars first.
// Env precedence:
//  1. FLOW_JIRA_API_TOKEN_<ALIAS> (ALIAS upper, '-'→'_')
//  2. FLOW_JIRA_API_TOKEN (for default alias)
//  3. FLOW_JIRA_EMAIL_<ALIAS> / FLOW_JIRA_EMAIL
//  4. Credentials file
func ResolveToken(service, alias string, env []string, store *Store) (email, token, source string) {
	alias = normalizeAlias(alias)
	service = strings.ToLower(strings.TrimSpace(service))

	// Env lookup
	envMap := map[string]string{}
	for _, kv := range env {
		if idx := strings.Index(kv, "="); idx >= 0 {
			envMap[kv[:idx]] = kv[idx+1:]
		}
	}

	var tokenEnv, emailEnv string
	switch service {
	case ServiceJira:
		tokenEnv = lookupEnvToken("FLOW_JIRA_API_TOKEN", alias, envMap)
		emailEnv = lookupEnvToken("FLOW_JIRA_EMAIL", alias, envMap)
	case ServiceAha:
		tokenEnv = lookupEnvToken("FLOW_AHA_API_TOKEN", alias, envMap)
	}

	if tokenEnv != "" {
		return emailEnv, tokenEnv, "env"
	}

	if store != nil {
		if cred, ok := store.Get(service, alias); ok {
			return cred.Email, cred.Token, "credentials"
		}
		// Fallback to default alias if specific not found? No, keep strict.
	}

	return "", "", ""
}
