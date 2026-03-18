package execution

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/lex/flow/internal/markdown"
	"github.com/lex/flow/internal/workspace"
)

func TestPrepareCommandExecutionResolvesShortNameAndMergesEnv(t *testing.T) {
	t.Parallel()

	root := createExecutionTestWorkspace(t)
	writeExecutionDocument(t, filepath.Join(root.FlowPath, "features", "release", "commands", "prepare.md"), markdown.CommandDocument{
		Metadata: markdown.CommandMetadata{
			CommonFields: markdown.CommonFields{ID: "cmd-0", Type: markdown.CommandType, Graph: "release", Title: "Prepare"},
			Name:         "prepare",
			Run:          "printf prepare",
		},
	})
	writeExecutionDocument(t, filepath.Join(root.FlowPath, "features", "release", "commands", "build.md"), markdown.CommandDocument{
		Metadata: markdown.CommandMetadata{
			CommonFields: markdown.CommonFields{ID: "cmd-1", Type: markdown.CommandType, Graph: "release", Title: "Build"},
			Name:         "build",
			DependsOn:    []string{"cmd-0"},
			Env: map[string]string{
				"GOOS":   "linux",
				"GOARCH": "amd64",
			},
			Run: "go build ./cmd/flow",
		},
	})

	execution, err := PrepareCommandExecution(root, "build", []string{"PATH=/usr/bin", "GOOS=darwin"})
	if err != nil {
		t.Fatalf("PrepareCommandExecution() error = %v", err)
	}

	if execution.ID != "cmd-1" || execution.Name != "build" {
		t.Fatalf("execution = %#v", execution)
	}

	if len(execution.DependencyIDs) != 1 || execution.DependencyIDs[0] != "cmd-0" {
		t.Fatalf("execution.DependencyIDs = %#v, want [cmd-0]", execution.DependencyIDs)
	}

	env := envMap(execution.Environment)
	if env["GOOS"] != "linux" || env["GOARCH"] != "amd64" || env["PATH"] != "/usr/bin" {
		t.Fatalf("env = %#v", env)
	}

	if execution.WorkingDir != root.WorkspacePath {
		t.Fatalf("execution.WorkingDir = %q, want %q", execution.WorkingDir, root.WorkspacePath)
	}

	if execution.Shell == "" || len(execution.Args) == 0 {
		t.Fatalf("shell execution not prepared: %#v", execution)
	}
	if execution.Args[len(execution.Args)-1] != "go build ./cmd/flow" {
		t.Fatalf("execution.Args = %#v", execution.Args)
	}
}

func TestPrepareCommandExecutionResolvesByID(t *testing.T) {
	t.Parallel()

	root := createExecutionTestWorkspace(t)
	writeExecutionDocument(t, filepath.Join(root.FlowPath, "features", "release", "commands", "build.md"), markdown.CommandDocument{
		Metadata: markdown.CommandMetadata{
			CommonFields: markdown.CommonFields{ID: "cmd-1", Type: markdown.CommandType, Graph: "release", Title: "Build"},
			Name:         "build",
			Run:          "go build ./cmd/flow",
		},
	})

	execution, err := PrepareCommandExecution(root, "cmd-1", nil)
	if err != nil {
		t.Fatalf("PrepareCommandExecution() error = %v", err)
	}

	if execution.ID != "cmd-1" {
		t.Fatalf("execution.ID = %q, want cmd-1", execution.ID)
	}
}

func TestPrepareCommandExecutionRejectsMissingDependency(t *testing.T) {
	t.Parallel()

	root := createExecutionTestWorkspace(t)
	writeExecutionDocument(t, filepath.Join(root.FlowPath, "features", "release", "commands", "build.md"), markdown.CommandDocument{
		Metadata: markdown.CommandMetadata{
			CommonFields: markdown.CommonFields{ID: "cmd-1", Type: markdown.CommandType, Graph: "release", Title: "Build"},
			Name:         "build",
			DependsOn:    []string{"cmd-0"},
			Run:          "go build ./cmd/flow",
		},
	})

	_, err := PrepareCommandExecution(root, "build", nil)
	if err == nil {
		t.Fatal("PrepareCommandExecution() error = nil, want missing dependency error")
	}
}

func createExecutionTestWorkspace(t *testing.T) workspace.Root {
	t.Helper()

	root, err := workspace.ResolveLocal(t.TempDir())
	if err != nil {
		t.Fatalf("ResolveLocal() error = %v", err)
	}

	return root
}

func writeExecutionDocument(t *testing.T, path string, document markdown.Document) {
	t.Helper()

	data, err := markdown.SerializeDocument(document)
	if err != nil {
		t.Fatalf("SerializeDocument() error = %v", err)
	}

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("MkdirAll() error = %v", err)
	}

	if err := os.WriteFile(path, data, 0o644); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}
}

func envMap(values []string) map[string]string {
	result := map[string]string{}
	for _, entry := range values {
		parts := strings.SplitN(entry, "=", 2)
		if len(parts) == 2 {
			result[parts[0]] = parts[1]
		}
	}

	return result
}
