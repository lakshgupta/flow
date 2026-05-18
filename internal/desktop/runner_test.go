package desktop

import (
	"strings"
	"testing"

	"github.com/lex/flow/internal/workspace"
)

func TestScopeLabel(t *testing.T) {
	t.Parallel()

	if got := scopeLabel(workspace.LocalScope); got != "local" {
		t.Fatalf("scopeLabel(local) = %q, want %q", got, "local")
	}

	if got := scopeLabel(workspace.GlobalScope); got != "global" {
		t.Fatalf("scopeLabel(global) = %q, want %q", got, "global")
	}
}

func TestRunDesktopModeStubIncludesScopeInError(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name  string
		input RuntimeContext
		scope string
	}{
		{name: "local scope", input: RuntimeContext{Root: workspace.Root{Scope: workspace.LocalScope, WorkspacePath: "/tmp/local"}}, scope: "local"},
		{name: "global scope", input: RuntimeContext{Root: workspace.Root{Scope: workspace.GlobalScope, WorkspacePath: "/tmp/global"}}, scope: "global"},
	}

	for _, testCase := range testCases {
		testCase := testCase
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()

			err := runDesktopMode(testCase.input)
			if err == nil {
				t.Fatalf("runDesktopMode(%+v) error = nil, want non-nil", testCase.input)
			}

			message := err.Error()
			if !strings.Contains(message, testCase.scope) {
				t.Fatalf("runDesktopMode(%+v) error = %q, want scope %q", testCase.input, message, testCase.scope)
			}
		})
	}
}
