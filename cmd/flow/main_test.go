package main

import (
	"bytes"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"testing"
	"time"

	"github.com/lex/flow/internal/config"
	"github.com/lex/flow/internal/execution"
	"github.com/lex/flow/internal/httpapi"
	"github.com/lex/flow/internal/index"
	"github.com/lex/flow/internal/markdown"
	"github.com/lex/flow/internal/workspace"
	_ "modernc.org/sqlite"
)

func TestFlowInitCreatesWorkspaceFilesWithoutChangingMarkdown(t *testing.T) {
	rootDir := t.TempDir()
	markdownPath := filepath.Join(rootDir, ".flow", "features", "demo", "notes", "note.md")
	gitignorePath := filepath.Join(rootDir, ".flow", ".gitignore")
	homePath := filepath.Join(rootDir, ".flow", workspace.DataDirName, workspace.HomeFileName)
	markdownData, err := markdown.SerializeDocument(markdown.NoteDocument{
		Metadata: markdown.NoteMetadata{
			CommonFields: markdown.CommonFields{
				ID:    "note-1",
				Type:  markdown.NoteType,
				Graph: "notes",
				Title: "Note",
			},
		},
		Body: "# note\n\nbody\n",
	})
	if err != nil {
		t.Fatalf("SerializeDocument() error = %v", err)
	}
	markdownBody := string(markdownData)

	if err := os.MkdirAll(filepath.Dir(markdownPath), 0o755); err != nil {
		t.Fatalf("MkdirAll() error = %v", err)
	}

	if err := os.WriteFile(markdownPath, []byte(markdownBody), 0o644); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	stdout, stderr := runForTest(t, []string{"init"}, rootDir)
	if stderr != "" {
		t.Fatalf("stderr = %q, want empty", stderr)
	}

	if !strings.Contains(stdout, "Initialized local workspace") {
		t.Fatalf("stdout = %q", stdout)
	}

	workspaceConfig, err := config.Read(filepath.Join(rootDir, ".flow", workspace.ConfigDirName, config.FileName))
	if err != nil {
		t.Fatalf("config.Read() error = %v", err)
	}

	if workspaceConfig.GUI.Port != defaultGUIPort {
		t.Fatalf("workspaceConfig.GUI.Port = %d, want %d", workspaceConfig.GUI.Port, defaultGUIPort)
	}

	if workspaceConfig.GUI.PanelWidths.LeftRatio != config.DefaultLeftPanelRatio || workspaceConfig.GUI.PanelWidths.RightRatio != config.DefaultRightPanelRatio {
		t.Fatalf("workspaceConfig.GUI.PanelWidths = %#v, want default ratios", workspaceConfig.GUI.PanelWidths)
	}

	indexInfo, err := os.Stat(filepath.Join(rootDir, ".flow", workspace.ConfigDirName, workspace.IndexFileName))
	if err != nil {
		t.Fatalf("Stat(index) error = %v", err)
	}

	if indexInfo.Size() == 0 {
		t.Fatalf("index size = %d, want non-zero SQLite database", indexInfo.Size())
	}

	gitignoreData, err := os.ReadFile(gitignorePath)
	if err != nil {
		t.Fatalf("ReadFile(.gitignore) error = %v", err)
	}

	if string(gitignoreData) != "config/flow.index\nconfig/gui-server.json\n" {
		t.Fatalf(".gitignore = %q, want config/flow.index and config/gui-server.json entries", string(gitignoreData))
	}

	if _, err := os.Stat(filepath.Join(rootDir, ".flow", workspace.ConfigDirName)); err != nil {
		t.Fatalf("Stat(config dir) error = %v", err)
	}

	if _, err := os.Stat(filepath.Join(rootDir, ".flow", workspace.DataDirName)); err != nil {
		t.Fatalf("Stat(data dir) error = %v", err)
	}

	if _, err := os.Stat(filepath.Join(rootDir, ".flow", workspace.DataDirName, workspace.GraphsDirName)); err != nil {
		t.Fatalf("Stat(graphs dir) error = %v", err)
	}

	homeData, err := os.ReadFile(homePath)
	if err != nil {
		t.Fatalf("ReadFile(home.md) error = %v", err)
	}

	if string(homeData) != "# Home\n" {
		t.Fatalf("home.md = %q, want default content", string(homeData))
	}

	markdownAfter, err := os.ReadFile(markdownPath)
	if err != nil {
		t.Fatalf("ReadFile() error = %v", err)
	}

	if string(markdownAfter) != markdownBody {
		t.Fatalf("markdown changed to %q", string(markdownAfter))
	}

	if _, stderr := runForTest(t, []string{"init"}, rootDir); stderr != "" {
		t.Fatalf("second init stderr = %q, want empty", stderr)
	}

	gitignoreAfter, err := os.ReadFile(gitignorePath)
	if err != nil {
		t.Fatalf("ReadFile(.gitignore) after second init error = %v", err)
	}

	if string(gitignoreAfter) != string(gitignoreData) {
		t.Fatalf(".gitignore changed after second init to %q", string(gitignoreAfter))
	}
}

func TestFlowConfigureUpdatesLocalGUIPort(t *testing.T) {
	rootDir := t.TempDir()
	_, stderr := runForTest(t, []string{"configure", "--gui-port", "5521"}, rootDir)
	if stderr != "" {
		t.Fatalf("stderr = %q, want empty", stderr)
	}

	workspaceConfig, err := config.Read(filepath.Join(rootDir, ".flow", workspace.ConfigDirName, config.FileName))
	if err != nil {
		t.Fatalf("config.Read() error = %v", err)
	}

	if workspaceConfig.GUI.Port != 5521 {
		t.Fatalf("workspaceConfig.GUI.Port = %d, want 5521", workspaceConfig.GUI.Port)
	}
}

func TestFlowVersionPrintsBuildVersion(t *testing.T) {
	originalVersion := version
	version = "1.2.3-test"
	t.Cleanup(func() {
		version = originalVersion
	})

	stdout, stderr := runForTest(t, []string{"version"}, t.TempDir())
	if stderr != "" {
		t.Fatalf("stderr = %q, want empty", stderr)
	}

	if stdout != "flow 1.2.3-test\n" {
		t.Fatalf("stdout = %q, want flow 1.2.3-test\\n", stdout)
	}
}

func TestFlowGlobalConfigureAndInit(t *testing.T) {
	configHome := t.TempDir()
	workspacePath := filepath.Join(t.TempDir(), "global-workspace")

	stdout, stderr := runForTest(t, []string{"-g", "configure", "--workspace", workspacePath, "--gui-port", "5522"}, t.TempDir(), withConfigHome(configHome))
	if stderr != "" {
		t.Fatalf("stderr = %q, want empty", stderr)
	}

	if !strings.Contains(stdout, "Configured global workspace GUI port 5522") {
		t.Fatalf("stdout = %q", stdout)
	}

	stdout, stderr = runForTest(t, []string{"-g", "init"}, t.TempDir(), withConfigHome(configHome))
	if stderr != "" {
		t.Fatalf("stderr = %q, want empty", stderr)
	}

	if !strings.Contains(stdout, "Initialized global workspace") {
		t.Fatalf("stdout = %q", stdout)
	}

	workspaceConfig, err := config.Read(filepath.Join(workspacePath, ".flow", workspace.ConfigDirName, config.FileName))
	if err != nil {
		t.Fatalf("config.Read() error = %v", err)
	}

	if workspaceConfig.GUI.Port != 5522 {
		t.Fatalf("workspaceConfig.GUI.Port = %d, want 5522", workspaceConfig.GUI.Port)
	}

	if _, err := os.Stat(filepath.Join(workspacePath, ".flow", workspace.ConfigDirName, workspace.IndexFileName)); err != nil {
		t.Fatalf("Stat(index) error = %v", err)
	}
}

func TestFlowCreateTaskWritesMarkdownAndReindexes(t *testing.T) {
	rootDir := t.TempDir()
	writeDocumentForTest(t, filepath.Join(rootDir, ".flow", "data", "graphs", "knowledge", "architecture.md"), markdown.NoteDocument{
		Metadata: markdown.NoteMetadata{
			CommonFields: markdown.CommonFields{
				ID:    "note-1",
				Type:  markdown.NoteType,
				Graph: "wrong",
				Title: "Architecture",
			},
		},
	})
	writeDocumentForTest(t, filepath.Join(rootDir, ".flow", "data", "graphs", "execution", "foundation", "foundation.md"), markdown.TaskDocument{
		Metadata: markdown.TaskMetadata{
			CommonFields: markdown.CommonFields{
				ID:    "task-0",
				Type:  markdown.TaskType,
				Graph: "wrong",
				Title: "Foundation",
			},
		},
	})

	stdout, stderr := runForTest(t, []string{
		"create",
		"task",
		"--file", "parser",
		"--id", "task-1",
		"--graph", "execution/parser",
		"--title", "Build parser",
		"--description", "Parser task description",
		"--status", "todo",
		"--depends-on", "task-0",
		"--reference", "note-1",
		"--tag", "backend",
		"--body", "Task body",
	}, rootDir)
	if stderr != "" {
		t.Fatalf("stderr = %q, want empty", stderr)
	}

	if !strings.Contains(stdout, "Created task document") {
		t.Fatalf("stdout = %q", stdout)
	}

	documentPath := filepath.Join(rootDir, ".flow", "data", "graphs", "execution", "parser", "parser.md")
	data, err := os.ReadFile(documentPath)
	if err != nil {
		t.Fatalf("ReadFile() error = %v", err)
	}

	document, err := markdown.ParseTaskDocument(data)
	if err != nil {
		t.Fatalf("ParseTaskDocument() error = %v", err)
	}

	if document.Metadata.ID != "task-1" || document.Metadata.Graph != "execution/parser" || document.Metadata.Status != "todo" {
		t.Fatalf("document metadata = %#v", document.Metadata)
	}

	if document.Metadata.Description != "Parser task description" {
		t.Fatalf("document.Metadata.Description = %q, want Parser task description", document.Metadata.Description)
	}

	if document.Body != "Task body" {
		t.Fatalf("document.Body = %q, want Task body", document.Body)
	}

	indexDB := openIndexForTest(t, filepath.Join(rootDir, ".flow", workspace.ConfigDirName, workspace.IndexFileName))
	defer indexDB.Close()

	assertIntQuery(t, indexDB, `SELECT COUNT(*) FROM documents`, 4)
	assertIntQuery(t, indexDB, `SELECT COUNT(*) FROM hard_dependencies`, 1)
	assertIntQuery(t, indexDB, `SELECT COUNT(*) FROM soft_references`, 1)

	var taskStatus string
	if err := indexDB.QueryRow(`SELECT task_status FROM documents WHERE id = 'task-1'`).Scan(&taskStatus); err != nil {
		t.Fatalf("QueryRow(task_status) error = %v", err)
	}

	if taskStatus != "todo" {
		t.Fatalf("taskStatus = %q, want todo", taskStatus)
	}
}

func TestFlowUpdateCommandWritesMarkdownAndReindexes(t *testing.T) {
	rootDir := t.TempDir()
	writeDocumentForTest(t, filepath.Join(rootDir, ".flow", "data", "graphs", "demo", "notes", "architecture.md"), markdown.NoteDocument{
		Metadata: markdown.NoteMetadata{
			CommonFields: markdown.CommonFields{
				ID:    "note-1",
				Type:  markdown.NoteType,
				Graph: "notes",
				Title: "Architecture",
			},
		},
	})
	writeDocumentForTest(t, filepath.Join(rootDir, ".flow", "data", "graphs", "release", "prepare.md"), markdown.CommandDocument{
		Metadata: markdown.CommandMetadata{
			CommonFields: markdown.CommonFields{
				ID:    "cmd-0",
				Type:  markdown.CommandType,
				Graph: "setup",
				Title: "Prepare",
			},
			Name: "prepare",
			Run:  "./prepare.sh",
		},
	})
	documentPath := filepath.Join(rootDir, ".flow", "data", "graphs", "release", "build.md")
	writeDocumentForTest(t, documentPath, markdown.CommandDocument{
		Metadata: markdown.CommandMetadata{
			CommonFields: markdown.CommonFields{
				ID:    "cmd-1",
				Type:  markdown.CommandType,
				Graph: "release",
				Title: "Build",
			},
			Name:       "build",
			DependsOn:  []string{"cmd-0"},
			References: []markdown.NodeReference{{Node: "note-1"}},
			Env: map[string]string{
				"GOOS": "linux",
			},
			Run: "go build ./cmd/flow",
		},
		Body: "Original body",
	})

	if _, stderr := runForTest(t, []string{"init"}, rootDir); stderr != "" {
		t.Fatalf("stderr = %q, want empty", stderr)
	}

	stdout, stderr := runForTest(t, []string{
		"update",
		"--path", "data/graphs/release/build.md",
		"--graph", "delivery/release",
		"--title", "Build binary",
		"--description", "Release build description",
		"--run", "go test ./...",
		"--env", "GOOS=linux",
		"--env", "GOARCH=amd64",
		"--body", "Updated body",
	}, rootDir)
	if stderr != "" {
		t.Fatalf("stderr = %q, want empty", stderr)
	}

	if !strings.Contains(stdout, "Updated document") {
		t.Fatalf("stdout = %q", stdout)
	}

	documentPath = filepath.Join(rootDir, ".flow", "data", "graphs", "delivery", "release", "build.md")
	data, err := os.ReadFile(documentPath)
	if err != nil {
		t.Fatalf("ReadFile() error = %v", err)
	}

	document, err := markdown.ParseCommandDocument(data)
	if err != nil {
		t.Fatalf("ParseCommandDocument() error = %v", err)
	}

	if document.Metadata.Title != "Build binary" {
		t.Fatalf("document.Metadata.Title = %q, want Build binary", document.Metadata.Title)
	}

	if document.Metadata.Description != "Release build description" {
		t.Fatalf("document.Metadata.Description = %q, want Release build description", document.Metadata.Description)
	}

	if document.Metadata.Run != "go test ./..." {
		t.Fatalf("document.Metadata.Run = %q, want go test ./...", document.Metadata.Run)
	}

	if document.Metadata.Env["GOARCH"] != "amd64" {
		t.Fatalf("document.Metadata.Env = %#v", document.Metadata.Env)
	}
	if document.Metadata.Graph != "delivery/release" {
		t.Fatalf("document.Metadata.Graph = %q, want delivery/release", document.Metadata.Graph)
	}

	if document.Body != "Updated body" {
		t.Fatalf("document.Body = %q, want Updated body", document.Body)
	}

	indexDB := openIndexForTest(t, filepath.Join(rootDir, ".flow", workspace.ConfigDirName, workspace.IndexFileName))
	defer indexDB.Close()

	var title string
	var runValue string
	if err := indexDB.QueryRow(`SELECT title, command_run FROM documents WHERE id = 'cmd-1'`).Scan(&title, &runValue); err != nil {
		t.Fatalf("QueryRow(command document) error = %v", err)
	}

	if title != "Build binary" || runValue != "go test ./..." {
		t.Fatalf("indexed document = %q %q", title, runValue)
	}

	assertIntQuery(t, indexDB, `SELECT COUNT(*) FROM command_env WHERE document_id = 'cmd-1'`, 2)
}

func TestFlowDeleteNoteRemovesMarkdownAndReindexes(t *testing.T) {
	rootDir := t.TempDir()
	writeDocumentForTest(t, filepath.Join(rootDir, ".flow", "data", "graphs", "demo", "execution", "parser.md"), markdown.TaskDocument{
		Metadata: markdown.TaskMetadata{
			CommonFields: markdown.CommonFields{
				ID:    "task-1",
				Type:  markdown.TaskType,
				Graph: "execution",
				Title: "Parser",
			},
		},
	})
	documentPath := filepath.Join(rootDir, ".flow", "data", "graphs", "demo", "notes", "architecture.md")
	writeDocumentForTest(t, documentPath, markdown.NoteDocument{
		Metadata: markdown.NoteMetadata{
			CommonFields: markdown.CommonFields{
				ID:    "note-1",
				Type:  markdown.NoteType,
				Graph: "notes",
				Title: "Architecture",
			},
			References: []markdown.NodeReference{{Node: "task-1"}},
		},
		Body: "Note body",
	})

	if _, stderr := runForTest(t, []string{"init"}, rootDir); stderr != "" {
		t.Fatalf("stderr = %q, want empty", stderr)
	}

	stdout, stderr := runForTest(t, []string{"delete", "--path", "data/graphs/demo/notes/architecture.md"}, rootDir)
	if stderr != "" {
		t.Fatalf("stderr = %q, want empty", stderr)
	}

	if !strings.Contains(stdout, "Deleted document") {
		t.Fatalf("stdout = %q", stdout)
	}

	if _, err := os.Stat(documentPath); !os.IsNotExist(err) {
		t.Fatalf("Stat() error = %v, want not exist", err)
	}

	indexDB := openIndexForTest(t, filepath.Join(rootDir, ".flow", workspace.ConfigDirName, workspace.IndexFileName))
	defer indexDB.Close()

	assertIntQuery(t, indexDB, `SELECT COUNT(*) FROM documents`, 2)
	assertIntQuery(t, indexDB, `SELECT COUNT(*) FROM soft_references`, 0)
}

func TestFlowCreateCommandRejectsDuplicateShortName(t *testing.T) {
	rootDir := t.TempDir()
	writeDocumentForTest(t, filepath.Join(rootDir, ".flow", "data", "graphs", "release", "build.md"), markdown.CommandDocument{
		Metadata: markdown.CommandMetadata{
			CommonFields: markdown.CommonFields{
				ID:    "cmd-1",
				Type:  markdown.CommandType,
				Graph: "release",
				Title: "Build",
			},
			Name: "build",
			Run:  "go build ./cmd/flow",
		},
	})

	stderr := runExpectErrorForTest(t, []string{
		"create",
		"command",
		"--file", "test",
		"--id", "cmd-2",
		"--graph", "demo/test",
		"--name", "build",
		"--run", "go test ./...",
	}, rootDir)

	if !strings.Contains(stderr, "duplicate command short name") {
		t.Fatalf("stderr = %q", stderr)
	}
}

func TestFlowUpdateCommandRejectsTaskDependency(t *testing.T) {
	rootDir := t.TempDir()
	writeDocumentForTest(t, filepath.Join(rootDir, ".flow", "data", "graphs", "demo", "execution", "parser.md"), markdown.TaskDocument{
		Metadata: markdown.TaskMetadata{
			CommonFields: markdown.CommonFields{
				ID:    "task-1",
				Type:  markdown.TaskType,
				Graph: "execution",
				Title: "Parser",
			},
		},
	})
	writeDocumentForTest(t, filepath.Join(rootDir, ".flow", "data", "graphs", "release", "build.md"), markdown.CommandDocument{
		Metadata: markdown.CommandMetadata{
			CommonFields: markdown.CommonFields{
				ID:    "cmd-1",
				Type:  markdown.CommandType,
				Graph: "release",
				Title: "Build",
			},
			Name: "build",
			Run:  "go build ./cmd/flow",
		},
	})

	stderr := runExpectErrorForTest(t, []string{
		"update",
		"--path", "data/graphs/release/build.md",
		"--depends-on", "task-1",
	}, rootDir)

	if !strings.Contains(stderr, "must reference another command") {
		t.Fatalf("stderr = %q", stderr)
	}
}

func TestFlowCreateTaskRejectsCrossTypeDependency(t *testing.T) {
	rootDir := t.TempDir()
	writeDocumentForTest(t, filepath.Join(rootDir, ".flow", "data", "graphs", "release", "build.md"), markdown.CommandDocument{
		Metadata: markdown.CommandMetadata{
			CommonFields: markdown.CommonFields{
				ID:    "cmd-1",
				Type:  markdown.CommandType,
				Graph: "release",
				Title: "Build",
			},
			Name: "build",
			Run:  "go build ./cmd/flow",
		},
	})

	stderr := runExpectErrorForTest(t, []string{
		"create",
		"task",
		"--file", "parser",
		"--id", "task-1",
		"--graph", "execution/parser",
		"--depends-on", "cmd-1",
	}, rootDir)

	if !strings.Contains(stderr, "must reference another task") {
		t.Fatalf("stderr = %q", stderr)
	}
}

func TestFlowTUIRendersWorkspaceSections(t *testing.T) {
	rootDir := t.TempDir()

	if _, stderr := runForTest(t, []string{"init"}, rootDir); stderr != "" {
		t.Fatalf("stderr = %q", stderr)
	}

	writeDocumentForTest(t, filepath.Join(rootDir, ".flow", "data", "graphs", "notes", "architecture.md"), markdown.NoteDocument{
		Metadata: markdown.NoteMetadata{
			CommonFields: markdown.CommonFields{ID: "note-1", Type: markdown.NoteType, Graph: "notes", Title: "Architecture"},
		},
		Body: "Build architecture notes.\n",
	})
	writeDocumentForTest(t, filepath.Join(rootDir, ".flow", "data", "graphs", "execution", "foundation.md"), markdown.TaskDocument{
		Metadata: markdown.TaskMetadata{
			CommonFields: markdown.CommonFields{ID: "task-0", Type: markdown.TaskType, Graph: "planning", Title: "Foundation"},
			Status:       "todo",
		},
		Body: "Foundation body.\n",
	})
	writeDocumentForTest(t, filepath.Join(rootDir, ".flow", "data", "graphs", "execution", "parser", "parser.md"), markdown.TaskDocument{
		Metadata: markdown.TaskMetadata{
			CommonFields: markdown.CommonFields{ID: "task-1", Type: markdown.TaskType, Graph: "planning", Title: "Parser"},
			Status:       "todo",
			DependsOn:    []string{"task-0"},
		},
		Body: "Parser body.\n",
	})
	writeDocumentForTest(t, filepath.Join(rootDir, ".flow", "data", "graphs", "release", "build.md"), markdown.CommandDocument{
		Metadata: markdown.CommandMetadata{
			CommonFields: markdown.CommonFields{ID: "cmd-1", Type: markdown.CommandType, Graph: "release", Title: "Build"},
			Name:         "build",
			Run:          "go build ./cmd/flow",
		},
		Body: "Build release binary.\n",
	})

	if err := index.Rebuild(filepath.Join(rootDir, ".flow", workspace.ConfigDirName, workspace.IndexFileName), filepath.Join(rootDir, ".flow")); err != nil {
		t.Fatalf("Rebuild() error = %v", err)
	}

	stdout, stderr := runForTest(t, []string{"tui", "--search", "build"}, rootDir)
	if stderr != "" {
		t.Fatalf("stderr = %q", stderr)
	}

	if !strings.Contains(stdout, "Workspace\nScope: local") {
		t.Fatalf("stdout = %q", stdout)
	}

	if !strings.Contains(stdout, "Home\nPath: data/home.md") {
		t.Fatalf("stdout = %q", stdout)
	}

	if !strings.Contains(stdout, "Graph Tree\n- execution [1 direct / 2 total]") {
		t.Fatalf("stdout = %q", stdout)
	}

	if !strings.Contains(stdout, "Indexed Search\nQuery: build") {
		t.Fatalf("stdout = %q", stdout)
	}
}

func TestFlowSearchRebuildsMissingIndex(t *testing.T) {
	rootDir := t.TempDir()
	writeDocumentForTest(t, filepath.Join(rootDir, ".flow", "data", "graphs", "notes", "architecture.md"), markdown.NoteDocument{
		Metadata: markdown.NoteMetadata{
			CommonFields: markdown.CommonFields{ID: "note-1", Type: markdown.NoteType, Graph: "notes", Title: "Architecture"},
		},
		Body: "Build architecture notes.\n",
	})

	stdout, stderr := runForTest(t, []string{"search", "build"}, rootDir)
	if stderr != "" {
		t.Fatalf("stderr = %q, want empty", stderr)
	}

	if !strings.Contains(stdout, "- note note-1 [notes] data/graphs/notes/architecture.md") {
		t.Fatalf("stdout = %q", stdout)
	}

	if _, err := os.Stat(filepath.Join(rootDir, ".flow", workspace.ConfigDirName, workspace.IndexFileName)); err != nil {
		t.Fatalf("Stat(index) error = %v", err)
	}

	stdout, stderr = runForTest(t, []string{"search", "missing"}, rootDir)
	if stderr != "" {
		t.Fatalf("stderr = %q, want empty", stderr)
	}

	if !strings.Contains(stdout, "No indexed matches for \"missing\"") {
		t.Fatalf("stdout = %q", stdout)
	}
}

func TestFlowRunExecutesCommandByShortName(t *testing.T) {
	rootDir := t.TempDir()
	writeDocumentForTest(t, filepath.Join(rootDir, ".flow", "data", "graphs", "release", "prepare.md"), markdown.CommandDocument{
		Metadata: markdown.CommandMetadata{
			CommonFields: markdown.CommonFields{ID: "cmd-0", Type: markdown.CommandType, Graph: "release", Title: "Prepare"},
			Name:         "prepare",
			Run:          "printf prepare",
		},
	})
	writeDocumentForTest(t, filepath.Join(rootDir, ".flow", "data", "graphs", "release", "build.md"), markdown.CommandDocument{
		Metadata: markdown.CommandMetadata{
			CommonFields: markdown.CommonFields{ID: "cmd-1", Type: markdown.CommandType, Graph: "release", Title: "Build"},
			Name:         "build",
			DependsOn:    []string{"cmd-0"},
			Env: map[string]string{
				"GOOS": "linux",
			},
			Run: "go build ./cmd/flow",
		},
	})

	var received execution.CommandExecution
	stdout, stderr := runForTest(
		t,
		[]string{"run", "build"},
		rootDir,
		withEnvironment([]string{"PATH=/usr/bin", "GOOS=darwin"}),
		withStartCommand(func(commandExecution execution.CommandExecution, stdout io.Writer, stderr io.Writer) error {
			received = commandExecution
			_, err := fmt.Fprintln(stdout, "simulated command output")
			return err
		}),
	)
	if stderr != "" {
		t.Fatalf("stderr = %q, want empty", stderr)
	}

	if received.ID != "cmd-1" || received.Name != "build" {
		t.Fatalf("received = %#v", received)
	}

	if len(received.DependencyIDs) != 1 || received.DependencyIDs[0] != "cmd-0" {
		t.Fatalf("received.DependencyIDs = %#v, want [cmd-0]", received.DependencyIDs)
	}

	if !strings.Contains(strings.Join(received.Environment, "\n"), "GOOS=linux") {
		t.Fatalf("received.Environment = %#v", received.Environment)
	}

	if !strings.Contains(stdout, "Checked dependencies: cmd-0") {
		t.Fatalf("stdout = %q", stdout)
	}

	if !strings.Contains(stdout, "Running command Build (cmd-1)") {
		t.Fatalf("stdout = %q", stdout)
	}

	if !strings.Contains(stdout, "simulated command output") {
		t.Fatalf("stdout = %q", stdout)
	}

	if !strings.Contains(stdout, "Completed command Build (cmd-1)") {
		t.Fatalf("stdout = %q", stdout)
	}
}

func TestFlowRunSurfacesCommandFailure(t *testing.T) {
	rootDir := t.TempDir()
	writeDocumentForTest(t, filepath.Join(rootDir, ".flow", "data", "graphs", "release", "build.md"), markdown.CommandDocument{
		Metadata: markdown.CommandMetadata{
			CommonFields: markdown.CommonFields{ID: "cmd-1", Type: markdown.CommandType, Graph: "release", Title: "Build"},
			Name:         "build",
			Run:          "go build ./cmd/flow",
		},
	})

	stderr := runExpectErrorForTest(
		t,
		[]string{"run", "cmd-1"},
		rootDir,
		withStartCommand(func(commandExecution execution.CommandExecution, stdout io.Writer, stderr io.Writer) error {
			return errors.New("process failed")
		}),
	)

	if !strings.Contains(stderr, "run command Build (cmd-1): process failed") {
		t.Fatalf("stderr = %q", stderr)
	}
}

func TestFlowGUIStartsLocalServerAndOpensBrowser(t *testing.T) {
	rootDir := t.TempDir()
	runtime := execution.NewGUIRuntime()
	port := availablePortForTest(t)

	if _, stderr := runForTest(t, []string{"configure", "--gui-port", strconv.Itoa(port)}, rootDir); stderr != "" {
		t.Fatalf("stderr = %q, want empty", stderr)
	}

	var openedURL string
	root, err := workspace.ResolveLocal(rootDir)
	if err != nil {
		t.Fatalf("ResolveLocal() error = %v", err)
	}

	stdout, stderr := runForTest(
		t,
		[]string{"gui"},
		rootDir,
		withLaunchGUIProcess(func(global bool, launchedRoot workspace.Root) error {
			if global {
				t.Fatal("launchGUIProcess() global = true, want false")
			}

			if launchedRoot.WorkspacePath != root.WorkspacePath {
				t.Fatalf("launchedRoot.WorkspacePath = %q, want %q", launchedRoot.WorkspacePath, root.WorkspacePath)
			}

			return startSimulatedGUIProcess(t, runtime, launchedRoot, port, 1101)
		}),
		withBrowserOpener(func(url string) error {
			openedURL = url
			return nil
		}),
		withWaitForGUI(func(url string) error {
			return assertGUIResponse(url)
		}),
	)
	if stderr != "" {
		t.Fatalf("stderr = %q, want empty", stderr)
	}

	wantURL := fmt.Sprintf("http://127.0.0.1:%d", port)
	if openedURL != wantURL {
		t.Fatalf("openedURL = %q, want %q", openedURL, wantURL)
	}

	if !strings.Contains(stdout, "Started local GUI server") {
		t.Fatalf("stdout = %q", stdout)
	}

	if !strings.Contains(stdout, wantURL) {
		t.Fatalf("stdout = %q", stdout)
	}

	if err := stopSimulatedGUIProcess(runtime, root); err != nil {
		t.Fatalf("stopSimulatedGUIProcess() error = %v", err)
	}
}

func TestFlowGlobalGUIStartsServerAndOpensBrowser(t *testing.T) {
	configHome := t.TempDir()
	workspacePath := filepath.Join(t.TempDir(), "global-workspace")
	runtime := execution.NewGUIRuntime()
	port := availablePortForTest(t)

	if _, stderr := runForTest(
		t,
		[]string{"-g", "configure", "--workspace", workspacePath, "--gui-port", strconv.Itoa(port)},
		t.TempDir(),
		withConfigHome(configHome),
	); stderr != "" {
		t.Fatalf("stderr = %q, want empty", stderr)
	}

	var openedURL string
	root, err := workspace.ResolveGlobal(workspace.DefaultGlobalLocatorPath(configHome))
	if err != nil {
		t.Fatalf("ResolveGlobal() error = %v", err)
	}

	stdout, stderr := runForTest(
		t,
		[]string{"-g", "gui"},
		t.TempDir(),
		withConfigHome(configHome),
		withLaunchGUIProcess(func(global bool, launchedRoot workspace.Root) error {
			if !global {
				t.Fatal("launchGUIProcess() global = false, want true")
			}

			if launchedRoot.WorkspacePath != root.WorkspacePath {
				t.Fatalf("launchedRoot.WorkspacePath = %q, want %q", launchedRoot.WorkspacePath, root.WorkspacePath)
			}

			return startSimulatedGUIProcess(t, runtime, launchedRoot, port, 2202)
		}),
		withBrowserOpener(func(url string) error {
			openedURL = url
			return nil
		}),
		withWaitForGUI(func(url string) error {
			return assertGUIResponse(url)
		}),
	)
	if stderr != "" {
		t.Fatalf("stderr = %q, want empty", stderr)
	}

	wantURL := fmt.Sprintf("http://127.0.0.1:%d", port)
	if openedURL != wantURL {
		t.Fatalf("openedURL = %q, want %q", openedURL, wantURL)
	}

	if !strings.Contains(stdout, "Started global GUI server") {
		t.Fatalf("stdout = %q", stdout)
	}

	if !strings.Contains(stdout, workspacePath) {
		t.Fatalf("stdout = %q", stdout)
	}

	if err := stopSimulatedGUIProcess(runtime, root); err != nil {
		t.Fatalf("stopSimulatedGUIProcess() error = %v", err)
	}
}

func TestFlowGUICleansUpWhenBrowserOpenFails(t *testing.T) {
	rootDir := t.TempDir()
	runtime := execution.NewGUIRuntime()
	port := availablePortForTest(t)

	if _, stderr := runForTest(t, []string{"configure", "--gui-port", strconv.Itoa(port)}, rootDir); stderr != "" {
		t.Fatalf("stderr = %q, want empty", stderr)
	}

	stderr := runExpectErrorForTest(
		t,
		[]string{"gui"},
		rootDir,
		withLaunchGUIProcess(func(global bool, root workspace.Root) error {
			return startSimulatedGUIProcess(t, runtime, root, port, 3303)
		}),
		withSignalProcess(func(pid int, signal syscall.Signal) error {
			if pid != 3303 {
				t.Fatalf("signal pid = %d, want 3303", pid)
			}

			if signal == syscall.Signal(0) {
				return nil
			}

			if signal != syscall.SIGTERM {
				t.Fatalf("signal = %v, want SIGTERM", signal)
			}

			root, err := workspace.ResolveLocal(rootDir)
			if err != nil {
				return err
			}

			return stopSimulatedGUIProcess(runtime, root)
		}),
		withBrowserOpener(func(string) error {
			return errors.New("browser launch failed")
		}),
		withWaitForGUI(func(url string) error {
			return assertGUIResponse(url)
		}),
	)

	if !strings.Contains(stderr, "open browser: browser launch failed") {
		t.Fatalf("stderr = %q", stderr)
	}

	root, err := workspace.ResolveLocal(rootDir)
	if err != nil {
		t.Fatalf("ResolveLocal() error = %v", err)
	}

	if err := runtime.Stop(root); !errors.Is(err, execution.ErrGUIServerNotRunning) {
		t.Fatalf("runtime.Stop() error = %v, want ErrGUIServerNotRunning", err)
	}
}

func TestFlowGUIStopStopsLocalServer(t *testing.T) {
	rootDir := t.TempDir()
	runtime := execution.NewGUIRuntime()
	port := availablePortForTest(t)
	root := mustResolveLocalRootForTest(t, rootDir)

	if _, stderr := runForTest(t, []string{"configure", "--gui-port", strconv.Itoa(port)}, rootDir); stderr != "" {
		t.Fatalf("stderr = %q, want empty", stderr)
	}

	if err := startSimulatedGUIProcess(t, runtime, root, port, 4404); err != nil {
		t.Fatalf("startSimulatedGUIProcess() error = %v", err)
	}

	stdout, stderr := runForTest(
		t,
		[]string{"gui", "stop"},
		rootDir,
		withSignalProcess(func(pid int, signal syscall.Signal) error {
			if pid != 4404 {
				t.Fatalf("signal pid = %d, want 4404", pid)
			}

			if signal == syscall.Signal(0) {
				return nil
			}

			if signal != syscall.SIGTERM {
				t.Fatalf("signal = %v, want SIGTERM", signal)
			}

			return stopSimulatedGUIProcess(runtime, root)
		}),
	)
	if stderr != "" {
		t.Fatalf("stderr = %q, want empty", stderr)
	}

	if !strings.Contains(stdout, "Stopped local GUI server") {
		t.Fatalf("stdout = %q", stdout)
	}

	if _, err := os.Stat(execution.GUIStatePath(root)); !os.IsNotExist(err) {
		t.Fatalf("Stat(guiState) error = %v, want not exist", err)
	}
}

func TestFlowGlobalGUIStopStopsServer(t *testing.T) {
	configHome := t.TempDir()
	workspacePath := filepath.Join(t.TempDir(), "global-workspace")
	runtime := execution.NewGUIRuntime()
	port := availablePortForTest(t)

	if _, stderr := runForTest(
		t,
		[]string{"-g", "configure", "--workspace", workspacePath, "--gui-port", strconv.Itoa(port)},
		t.TempDir(),
		withConfigHome(configHome),
	); stderr != "" {
		t.Fatalf("stderr = %q, want empty", stderr)
	}

	root, err := workspace.ResolveGlobal(workspace.DefaultGlobalLocatorPath(configHome))
	if err != nil {
		t.Fatalf("ResolveGlobal() error = %v", err)
	}

	if err := startSimulatedGUIProcess(t, runtime, root, port, 5505); err != nil {
		t.Fatalf("startSimulatedGUIProcess() error = %v", err)
	}

	stdout, stderr := runForTest(
		t,
		[]string{"-g", "gui", "stop"},
		t.TempDir(),
		withConfigHome(configHome),
		withSignalProcess(func(pid int, signal syscall.Signal) error {
			if pid != 5505 {
				t.Fatalf("signal pid = %d, want 5505", pid)
			}

			if signal == syscall.Signal(0) {
				return nil
			}

			if signal != syscall.SIGTERM {
				t.Fatalf("signal = %v, want SIGTERM", signal)
			}

			return stopSimulatedGUIProcess(runtime, root)
		}),
	)
	if stderr != "" {
		t.Fatalf("stderr = %q, want empty", stderr)
	}

	if !strings.Contains(stdout, "Stopped global GUI server") {
		t.Fatalf("stdout = %q", stdout)
	}
}

func TestFlowNodeReadReturnsMarkdownForNote(t *testing.T) {
	rootDir := t.TempDir()
	writeDocumentForTest(t, filepath.Join(rootDir, ".flow", "data", "content", "arch", "overview.md"), markdown.NoteDocument{
		Metadata: markdown.NoteMetadata{
			CommonFields: markdown.CommonFields{
				ID:    "note-1",
				Type:  markdown.NoteType,
				Graph: "arch",
				Title: "Overview",
			},
		},
		Body: "Overview body text.\n",
	})

	stdout, stderr := runForTest(t, []string{"node", "read", "--id", "note-1", "--graph", "arch"}, rootDir)
	if stderr != "" {
		t.Fatalf("stderr = %q, want empty", stderr)
	}

	if !strings.Contains(stdout, "# Overview") {
		t.Fatalf("stdout missing title, got %q", stdout)
	}
	if !strings.Contains(stdout, "ID: note-1") {
		t.Fatalf("stdout missing ID, got %q", stdout)
	}
	if !strings.Contains(stdout, "Type: note") {
		t.Fatalf("stdout missing type, got %q", stdout)
	}
	if !strings.Contains(stdout, "Role: context") {
		t.Fatalf("stdout missing role, got %q", stdout)
	}
	if !strings.Contains(stdout, "Overview body text.") {
		t.Fatalf("stdout missing body, got %q", stdout)
	}
}

func TestFlowNodeReadReturnsJSONFormat(t *testing.T) {
	rootDir := t.TempDir()
	writeDocumentForTest(t, filepath.Join(rootDir, ".flow", "data", "content", "arch", "overview.md"), markdown.NoteDocument{
		Metadata: markdown.NoteMetadata{
			CommonFields: markdown.CommonFields{
				ID:    "note-1",
				Type:  markdown.NoteType,
				Graph: "arch",
				Title: "Overview",
			},
		},
		Body: "Overview body.\n",
	})

	stdout, stderr := runForTest(t, []string{"node", "read", "--id", "note-1", "--format", "json"}, rootDir)
	if stderr != "" {
		t.Fatalf("stderr = %q, want empty", stderr)
	}

	if !strings.Contains(stdout, `"id":"note-1"`) {
		t.Fatalf("stdout missing id field, got %q", stdout)
	}
	if !strings.Contains(stdout, `"type":"note"`) {
		t.Fatalf("stdout missing type field, got %q", stdout)
	}
	if !strings.Contains(stdout, `"role":"context"`) {
		t.Fatalf("stdout missing role field, got %q", stdout)
	}
}

func TestFlowNodeReadRequiresID(t *testing.T) {
	rootDir := t.TempDir()
	stderr := runExpectErrorForTest(t, []string{"node", "read", "--graph", "arch"}, rootDir)
	if !strings.Contains(stderr, "--id") {
		t.Fatalf("stderr = %q, want --id mention", stderr)
	}
}

func TestFlowNodeReadUnknownIDReturnsError(t *testing.T) {
	rootDir := t.TempDir()
	writeDocumentForTest(t, filepath.Join(rootDir, ".flow", "data", "content", "arch", "overview.md"), markdown.NoteDocument{
		Metadata: markdown.NoteMetadata{
			CommonFields: markdown.CommonFields{
				ID:    "note-1",
				Type:  markdown.NoteType,
				Graph: "arch",
				Title: "Overview",
			},
		},
	})

	stderr := runExpectErrorForTest(t, []string{"node", "read", "--id", "does-not-exist"}, rootDir)
	if !strings.Contains(stderr, "not found") {
		t.Fatalf("stderr = %q, want not found message", stderr)
	}
}

func TestFlowNodeListReturnsMarkdownForGraph(t *testing.T) {
	rootDir := t.TempDir()
	writeDocumentForTest(t, filepath.Join(rootDir, ".flow", "data", "content", "proj", "note.md"), markdown.NoteDocument{
		Metadata: markdown.NoteMetadata{
			CommonFields: markdown.CommonFields{
				ID:    "note-1",
				Type:  markdown.NoteType,
				Graph: "proj",
				Title: "Note",
			},
		},
	})
	writeDocumentForTest(t, filepath.Join(rootDir, ".flow", "data", "content", "proj", "task.md"), markdown.TaskDocument{
		Metadata: markdown.TaskMetadata{
			CommonFields: markdown.CommonFields{
				ID:    "task-1",
				Type:  markdown.TaskType,
				Graph: "proj",
				Title: "Task",
			},
			Status: "todo",
		},
	})

	stdout, stderr := runForTest(t, []string{"node", "list", "--graph", "proj"}, rootDir)
	if stderr != "" {
		t.Fatalf("stderr = %q, want empty", stderr)
	}

	if !strings.Contains(stdout, "note-1") {
		t.Fatalf("stdout missing note-1, got %q", stdout)
	}
	if !strings.Contains(stdout, "task-1") {
		t.Fatalf("stdout missing task-1, got %q", stdout)
	}
}

func TestFlowNodeListReturnsJSONFormat(t *testing.T) {
	rootDir := t.TempDir()
	writeDocumentForTest(t, filepath.Join(rootDir, ".flow", "data", "content", "proj", "note.md"), markdown.NoteDocument{
		Metadata: markdown.NoteMetadata{
			CommonFields: markdown.CommonFields{
				ID:    "note-1",
				Type:  markdown.NoteType,
				Graph: "proj",
				Title: "Note",
			},
		},
	})

	stdout, stderr := runForTest(t, []string{"node", "list", "--graph", "proj", "--format", "json"}, rootDir)
	if stderr != "" {
		t.Fatalf("stderr = %q, want empty", stderr)
	}

	if !strings.Contains(stdout, `"id":"note-1"`) {
		t.Fatalf("stdout missing id field, got %q", stdout)
	}
	if !strings.Contains(stdout, `"graph":"proj"`) {
		t.Fatalf("stdout missing graph field, got %q", stdout)
	}
}

func TestFlowNodeListEmptyGraphReturnsNoNodesMessage(t *testing.T) {
	rootDir := t.TempDir()

	stdout, stderr := runForTest(t, []string{"node", "list", "--graph", "empty"}, rootDir)
	if stderr != "" {
		t.Fatalf("stderr = %q, want empty", stderr)
	}

	if !strings.Contains(stdout, "No nodes") {
		t.Fatalf("stdout = %q, want no-nodes message", stdout)
	}
}

func TestFlowNodeListRequiresGraph(t *testing.T) {
	rootDir := t.TempDir()
	stderr := runExpectErrorForTest(t, []string{"node", "list"}, rootDir)
	if !strings.Contains(stderr, "--graph") {
		t.Fatalf("stderr = %q, want --graph mention", stderr)
	}
}

func TestFlowNodeUnknownSubcommandReturnsError(t *testing.T) {
	rootDir := t.TempDir()
	stderr := runExpectErrorForTest(t, []string{"node", "bogus"}, rootDir)
	if !strings.Contains(stderr, "bogus") {
		t.Fatalf("stderr = %q, want subcommand name in error", stderr)
	}
}

func TestFlowNodeEdgesRequiresID(t *testing.T) {
	rootDir := t.TempDir()
	stderr := runExpectErrorForTest(t, []string{"node", "edges"}, rootDir)
	if !strings.Contains(stderr, "--id") {
		t.Fatalf("stderr = %q, want --id mention", stderr)
	}
}

func TestFlowNodeNeighborsReturnsNeighborSummaries(t *testing.T) {
	rootDir := t.TempDir()
	writeDocumentForTest(t, filepath.Join(rootDir, ".flow", "data", "content", "proj", "source.md"), markdown.NoteDocument{
		Metadata: markdown.NoteMetadata{
			CommonFields: markdown.CommonFields{ID: "note-src", Type: markdown.NoteType, Graph: "proj", Title: "Source"},
			References:   []markdown.NodeReference{{Node: "note-ref"}},
		},
	})
	writeDocumentForTest(t, filepath.Join(rootDir, ".flow", "data", "content", "proj", "ref.md"), markdown.NoteDocument{
		Metadata: markdown.NoteMetadata{
			CommonFields: markdown.CommonFields{ID: "note-ref", Type: markdown.NoteType, Graph: "proj", Title: "Ref"},
		},
	})

	stdout, stderr := runForTest(t, []string{"node", "neighbors", "--id", "note-src", "--graph", "proj"}, rootDir)
	if stderr != "" {
		t.Fatalf("stderr = %q, want empty", stderr)
	}

	if !strings.Contains(stdout, "note-ref") {
		t.Fatalf("stdout missing note-ref neighbor, got %q", stdout)
	}
}

func TestFlowNodeNeighborsRequiresID(t *testing.T) {
	rootDir := t.TempDir()
	stderr := runExpectErrorForTest(t, []string{"node", "neighbors"}, rootDir)
	if !strings.Contains(stderr, "--id") {
		t.Fatalf("stderr = %q, want --id mention", stderr)
	}
}

func TestFlowNodeUpdateChangesTitle(t *testing.T) {
	rootDir := t.TempDir()
	writeDocumentForTest(t, filepath.Join(rootDir, ".flow", "data", "content", "proj", "note.md"), markdown.NoteDocument{
		Metadata: markdown.NoteMetadata{
			CommonFields: markdown.CommonFields{
				ID:    "note-1",
				Type:  markdown.NoteType,
				Graph: "proj",
				Title: "Original Title",
			},
		},
		Body: "Original body.\n",
	})

	stdout, stderr := runForTest(t, []string{"node", "update", "--id", "note-1", "--title", "Updated Title"}, rootDir)
	if stderr != "" {
		t.Fatalf("stderr = %q, want empty", stderr)
	}
	if !strings.Contains(stdout, "Updated node note-1") {
		t.Fatalf("stdout = %q, want updated message", stdout)
	}

	// Verify the file on disk was updated.
	documentPath := filepath.Join(rootDir, ".flow", "data", "content", "proj", "note.md")
	data, err := os.ReadFile(documentPath)
	if err != nil {
		t.Fatalf("ReadFile() error = %v", err)
	}
	if !strings.Contains(string(data), "Updated Title") {
		t.Fatalf("file content = %q, want Updated Title", string(data))
	}
}

func TestFlowNodeUpdateRequiresID(t *testing.T) {
	rootDir := t.TempDir()
	stderr := runExpectErrorForTest(t, []string{"node", "update", "--title", "New"}, rootDir)
	if !strings.Contains(stderr, "--id") {
		t.Fatalf("stderr = %q, want --id mention", stderr)
	}
}

func TestFlowNodeUpdateRequiresAtLeastOneField(t *testing.T) {
	rootDir := t.TempDir()
	writeDocumentForTest(t, filepath.Join(rootDir, ".flow", "data", "content", "proj", "note.md"), markdown.NoteDocument{
		Metadata: markdown.NoteMetadata{
			CommonFields: markdown.CommonFields{ID: "note-1", Type: markdown.NoteType, Graph: "proj", Title: "Note"},
		},
	})

	stderr := runExpectErrorForTest(t, []string{"node", "update", "--id", "note-1"}, rootDir)
	if !strings.Contains(stderr, "at least one field") {
		t.Fatalf("stderr = %q, want at-least-one-field message", stderr)
	}
}

func TestFlowNodeConnectCreatesEdge(t *testing.T) {
	rootDir := t.TempDir()
	writeDocumentForTest(t, filepath.Join(rootDir, ".flow", "data", "content", "proj", "a.md"), markdown.NoteDocument{
		Metadata: markdown.NoteMetadata{
			CommonFields: markdown.CommonFields{ID: "note-a", Type: markdown.NoteType, Graph: "proj", Title: "A"},
		},
	})
	writeDocumentForTest(t, filepath.Join(rootDir, ".flow", "data", "content", "proj", "b.md"), markdown.NoteDocument{
		Metadata: markdown.NoteMetadata{
			CommonFields: markdown.CommonFields{ID: "note-b", Type: markdown.NoteType, Graph: "proj", Title: "B"},
		},
	})

	stdout, stderr := runForTest(t, []string{"node", "connect", "--from", "note-a", "--to", "note-b", "--graph", "proj"}, rootDir)
	if stderr != "" {
		t.Fatalf("stderr = %q, want empty", stderr)
	}
	if !strings.Contains(stdout, "Connected note-a") {
		t.Fatalf("stdout = %q, want Connected message", stdout)
	}
	if !strings.Contains(stdout, "note-b") {
		t.Fatalf("stdout = %q, want note-b in message", stdout)
	}
}

func TestFlowNodeConnectRequiresFrom(t *testing.T) {
	rootDir := t.TempDir()
	stderr := runExpectErrorForTest(t, []string{"node", "connect", "--to", "note-b", "--graph", "proj"}, rootDir)
	if !strings.Contains(stderr, "--from") {
		t.Fatalf("stderr = %q, want --from mention", stderr)
	}
}

func TestFlowNodeConnectRequiresTo(t *testing.T) {
	rootDir := t.TempDir()
	stderr := runExpectErrorForTest(t, []string{"node", "connect", "--from", "note-a", "--graph", "proj"}, rootDir)
	if !strings.Contains(stderr, "--to") {
		t.Fatalf("stderr = %q, want --to mention", stderr)
	}
}

func TestFlowNodeConnectRequiresGraph(t *testing.T) {
	rootDir := t.TempDir()
	stderr := runExpectErrorForTest(t, []string{"node", "connect", "--from", "note-a", "--to", "note-b"}, rootDir)
	if !strings.Contains(stderr, "--graph") {
		t.Fatalf("stderr = %q, want --graph mention", stderr)
	}
}

func TestFlowNodeDisconnectRequiresFrom(t *testing.T) {
	rootDir := t.TempDir()
	stderr := runExpectErrorForTest(t, []string{"node", "disconnect", "--to", "note-b", "--graph", "proj"}, rootDir)
	if !strings.Contains(stderr, "--from") {
		t.Fatalf("stderr = %q, want --from mention", stderr)
	}
}

type testOption func(*commandEnv)

func withConfigHome(configHome string) testOption {
	return func(env *commandEnv) {
		env.userConfigDir = func() (string, error) {
			return configHome, nil
		}
	}
}

func withBrowserOpener(openBrowser func(string) error) testOption {
	return func(env *commandEnv) {
		env.openBrowser = openBrowser
	}
}

func withEnvironment(values []string) testOption {
	return func(env *commandEnv) {
		env.environ = func() []string {
			return append([]string(nil), values...)
		}
	}
}

func withStartCommand(start func(execution.CommandExecution, io.Writer, io.Writer) error) testOption {
	return func(env *commandEnv) {
		env.startCommand = start
	}
}

func withLaunchGUIProcess(launch func(bool, workspace.Root) error) testOption {
	return func(env *commandEnv) {
		env.launchGUIProcess = launch
	}
}

func withSignalProcess(signal func(int, syscall.Signal) error) testOption {
	return func(env *commandEnv) {
		env.signalProcess = signal
	}
}

func withWaitForGUI(wait func(string) error) testOption {
	return func(env *commandEnv) {
		env.waitForGUI = wait
	}
}

func withShutdownWait(waitForShutdown func(string) error) testOption {
	return func(env *commandEnv) {
		env.waitForShutdown = waitForShutdown
	}
}

func runForTest(t *testing.T, args []string, workingDirectory string, options ...testOption) (string, string) {
	t.Helper()

	stdout := &bytes.Buffer{}
	stderr := &bytes.Buffer{}
	env := commandEnv{
		stdout: stdout,
		stderr: stderr,
		getwd: func() (string, error) {
			return workingDirectory, nil
		},
		userConfigDir: os.UserConfigDir,
	}

	for _, option := range options {
		option(&env)
	}

	if exitCode := run(args, env); exitCode != 0 {
		t.Fatalf("run() exitCode = %d, stdout = %q, stderr = %q", exitCode, stdout.String(), stderr.String())
	}

	return stdout.String(), stderr.String()
}

func runExpectErrorForTest(t *testing.T, args []string, workingDirectory string, options ...testOption) string {
	t.Helper()

	stdout := &bytes.Buffer{}
	stderr := &bytes.Buffer{}
	env := commandEnv{
		stdout: stdout,
		stderr: stderr,
		getwd: func() (string, error) {
			return workingDirectory, nil
		},
		userConfigDir: os.UserConfigDir,
	}

	for _, option := range options {
		option(&env)
	}

	if exitCode := run(args, env); exitCode == 0 {
		t.Fatalf("run() exitCode = 0, want non-zero, stdout = %q, stderr = %q", stdout.String(), stderr.String())
	}

	return stderr.String()
}

func writeDocumentForTest(t *testing.T, path string, document markdown.Document) {
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

func openIndexForTest(t *testing.T, path string) *sql.DB {
	t.Helper()

	database, err := sql.Open("sqlite", path)
	if err != nil {
		t.Fatalf("sql.Open() error = %v", err)
	}

	return database
}

func assertIntQuery(t *testing.T, database *sql.DB, query string, want int) {
	t.Helper()

	var got int
	if err := database.QueryRow(query).Scan(&got); err != nil {
		t.Fatalf("QueryRow(%q) error = %v", query, err)
	}

	if got != want {
		t.Fatalf("QueryRow(%q) = %d, want %d", query, got, want)
	}
}

func availablePortForTest(t *testing.T) int {
	t.Helper()

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("net.Listen() error = %v", err)
	}
	defer listener.Close()

	return listener.Addr().(*net.TCPAddr).Port
}

func assertGUIResponse(url string) error {
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
			return fmt.Errorf("read GUI response: %w", err)
		}

		if response.StatusCode != http.StatusOK {
			return fmt.Errorf("unexpected GUI status: %d", response.StatusCode)
		}

		if !strings.Contains(string(body), "<div id=\"root\"></div>") {
			return fmt.Errorf("GUI response missing root element")
		}

		return nil
	}

	return fmt.Errorf("GET %s did not succeed: %w", url, lastErr)
}

func mustResolveLocalRootForTest(t *testing.T, rootDir string) workspace.Root {
	t.Helper()

	root, err := workspace.ResolveLocal(rootDir)
	if err != nil {
		t.Fatalf("ResolveLocal() error = %v", err)
	}

	return root
}

func startSimulatedGUIProcess(t *testing.T, runtime *execution.GUIRuntime, root workspace.Root, port int, pid int) error {
	t.Helper()

	handler, err := httpapi.NewMux(httpapi.Options{Root: root})
	if err != nil {
		return err
	}

	result, err := runtime.Start(root, port, handler)
	if err != nil {
		return err
	}

	return execution.WriteGUIState(root, execution.GUIState{PID: pid, Port: result.Port, URL: result.URL})
}

func stopSimulatedGUIProcess(runtime *execution.GUIRuntime, root workspace.Root) error {
	if err := runtime.Stop(root); err != nil && !errors.Is(err, execution.ErrGUIServerNotRunning) {
		return err
	}

	return execution.RemoveGUIState(root)
}
