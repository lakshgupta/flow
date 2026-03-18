package execution

import (
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/lex/flow/internal/workspace"
)

func TestGUIRuntimeRestartsSameWorkspaceOnSamePort(t *testing.T) {
	t.Parallel()

	runtime := NewGUIRuntime()
	root := mustResolveLocalRoot(t, t.TempDir())
	port := availablePort(t)

	first, err := runtime.Start(root, port, http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		_, _ = writer.Write([]byte("first"))
	}))
	if err != nil {
		t.Fatalf("Start(first) error = %v", err)
	}
	defer runtime.Stop(root)

	assertHTTPBody(t, first.URL, "first")

	second, err := runtime.Start(root, port, http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		_, _ = writer.Write([]byte("second"))
	}))
	if err != nil {
		t.Fatalf("Start(second) error = %v", err)
	}

	if !second.Restarted {
		t.Fatal("second.Restarted = false, want true")
	}

	if second.URL != first.URL {
		t.Fatalf("second.URL = %q, want %q", second.URL, first.URL)
	}

	assertHTTPBody(t, second.URL, "second")
	if err := runtime.Stop(root); err != nil {
		t.Fatalf("Stop() error = %v", err)
	}
}

func TestGUIRuntimeRejectsCrossWorkspacePortConflict(t *testing.T) {
	t.Parallel()

	runtime := NewGUIRuntime()
	firstRoot := mustResolveLocalRoot(t, t.TempDir())
	secondRoot := mustResolveLocalRoot(t, t.TempDir())
	port := availablePort(t)

	_, err := runtime.Start(firstRoot, port, http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		_, _ = writer.Write([]byte("first"))
	}))
	if err != nil {
		t.Fatalf("Start(first) error = %v", err)
	}
	defer runtime.Stop(firstRoot)

	_, err = runtime.Start(secondRoot, port, http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {}))
	if err == nil {
		t.Fatal("Start(second) error = nil, want port conflict")
	}

	var portConflict *PortConflictError
	if !errors.As(err, &portConflict) {
		t.Fatalf("Start(second) error = %v, want PortConflictError", err)
	}

	if portConflict.ConflictingWorkspace != firstRoot.WorkspacePath {
		t.Fatalf("portConflict.ConflictingWorkspace = %q, want %q", portConflict.ConflictingWorkspace, firstRoot.WorkspacePath)
	}
}

func TestGUIRuntimeRejectsExternallyOccupiedPort(t *testing.T) {
	t.Parallel()

	runtime := NewGUIRuntime()
	root := mustResolveLocalRoot(t, t.TempDir())
	listener, err := net.Listen("tcp", net.JoinHostPort(loopbackHost, "0"))
	if err != nil {
		t.Fatalf("net.Listen() error = %v", err)
	}
	defer listener.Close()

	port := listener.Addr().(*net.TCPAddr).Port
	_, err = runtime.Start(root, port, http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {}))
	if err == nil {
		t.Fatal("Start() error = nil, want unavailable port error")
	}

	if want := fmt.Sprintf("gui port %d is unavailable", port); err != nil && !strings.Contains(err.Error(), want) {
		t.Fatalf("Start() error = %v, want substring %q", err, want)
	}
}

func TestGUIStatePathUsesConfigDirectory(t *testing.T) {
	t.Parallel()

	root := mustResolveLocalRoot(t, t.TempDir())
	want := filepath.Join(root.FlowPath, workspace.ConfigDirName, GUIStateFileName)

	if got := GUIStatePath(root); got != want {
		t.Fatalf("GUIStatePath() = %q, want %q", got, want)
	}
}

func mustResolveLocalRoot(t *testing.T, rootDir string) workspace.Root {
	t.Helper()

	root, err := workspace.ResolveLocal(rootDir)
	if err != nil {
		t.Fatalf("ResolveLocal() error = %v", err)
	}

	return root
}

func availablePort(t *testing.T) int {
	t.Helper()

	listener, err := net.Listen("tcp", net.JoinHostPort(loopbackHost, "0"))
	if err != nil {
		t.Fatalf("net.Listen() error = %v", err)
	}
	defer listener.Close()

	return listener.Addr().(*net.TCPAddr).Port
}

func assertHTTPBody(t *testing.T, url string, want string) {
	t.Helper()

	client := &http.Client{Timeout: 2 * time.Second}
	var lastErr error
	for range 20 {
		response, err := client.Get(url)
		if err != nil {
			lastErr = err
			time.Sleep(10 * time.Millisecond)
			continue
		}

		body, err := io.ReadAll(response.Body)
		response.Body.Close()
		if err != nil {
			t.Fatalf("ReadAll() error = %v", err)
		}

		if got := string(body); got != want {
			t.Fatalf("body = %q, want %q", got, want)
		}

		return
	}

	t.Fatalf("GET %s did not succeed: %v", url, lastErr)
}
