package execution

import (
	"errors"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"sync"

	"github.com/lex/flow/internal/workspace"
)

const loopbackHost = "127.0.0.1"

// ErrGUIServerNotRunning reports that no tracked GUI server exists for a workspace.
var ErrGUIServerNotRunning = errors.New("gui server not running")

// PortConflictError reports that a GUI port is already owned by another tracked Flow workspace.
type PortConflictError struct {
	Port                 int
	RequestedWorkspace   string
	ConflictingWorkspace string
}

func (err *PortConflictError) Error() string {
	return fmt.Sprintf(
		"gui port %d is already used by Flow workspace %s; cannot start workspace %s",
		err.Port,
		err.ConflictingWorkspace,
		err.RequestedWorkspace,
	)
}

// GUIStartResult describes the running GUI server selected for a workspace.
type GUIStartResult struct {
	Port      int
	URL       string
	Restarted bool
}

// GUIRuntime coordinates workspace-targeted GUI server ownership inside the process.
type GUIRuntime struct {
	mu          sync.Mutex
	byWorkspace map[string]*runningGUIServer
	byPort      map[int]*runningGUIServer
}

type runningGUIServer struct {
	root     workspace.Root
	port     int
	url      string
	server   *http.Server
	listener net.Listener
}

// NewGUIRuntime creates an empty GUI server runtime registry.
func NewGUIRuntime() *GUIRuntime {
	return &GUIRuntime{
		byWorkspace: map[string]*runningGUIServer{},
		byPort:      map[int]*runningGUIServer{},
	}
}

// Start launches or replaces the tracked GUI server for a workspace.
func (runtime *GUIRuntime) Start(root workspace.Root, port int, handler http.Handler) (GUIStartResult, error) {
	if handler == nil {
		return GUIStartResult{}, fmt.Errorf("gui handler must not be nil")
	}

	if port < 1 || port > 65535 {
		return GUIStartResult{}, fmt.Errorf("gui port must be between 1 and 65535")
	}

	runtime.mu.Lock()
	defer runtime.mu.Unlock()

	workspacePath := root.WorkspacePath
	existing := runtime.byWorkspace[workspacePath]
	if conflicting := runtime.byPort[port]; conflicting != nil && (existing == nil || conflicting != existing) {
		return GUIStartResult{}, &PortConflictError{
			Port:                 port,
			RequestedWorkspace:   workspacePath,
			ConflictingWorkspace: conflicting.root.WorkspacePath,
		}
	}

	restarted := false
	if existing != nil {
		delete(runtime.byWorkspace, existing.root.WorkspacePath)
		delete(runtime.byPort, existing.port)
		if err := existing.server.Close(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			return GUIStartResult{}, fmt.Errorf("stop existing gui server: %w", err)
		}
		restarted = true
	}

	listener, err := net.Listen("tcp", net.JoinHostPort(loopbackHost, strconv.Itoa(port)))
	if err != nil {
		return GUIStartResult{}, fmt.Errorf("gui port %d is unavailable: %w", port, err)
	}

	server := &http.Server{Handler: handler}
	running := &runningGUIServer{
		root:     root,
		port:     port,
		url:      "http://" + net.JoinHostPort(loopbackHost, strconv.Itoa(port)),
		server:   server,
		listener: listener,
	}

	runtime.byWorkspace[workspacePath] = running
	runtime.byPort[port] = running

	go runtime.serve(running)

	return GUIStartResult{Port: port, URL: running.url, Restarted: restarted}, nil
}

// Stop stops the tracked GUI server for a workspace.
func (runtime *GUIRuntime) Stop(root workspace.Root) error {
	runtime.mu.Lock()
	running := runtime.byWorkspace[root.WorkspacePath]
	if running == nil {
		runtime.mu.Unlock()
		return ErrGUIServerNotRunning
	}

	delete(runtime.byWorkspace, running.root.WorkspacePath)
	delete(runtime.byPort, running.port)
	runtime.mu.Unlock()

	if err := running.server.Close(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return fmt.Errorf("stop gui server: %w", err)
	}

	return nil
}

func (runtime *GUIRuntime) serve(running *runningGUIServer) {
	err := running.server.Serve(running.listener)
	if err != nil && !errors.Is(err, http.ErrServerClosed) {
		runtime.cleanup(running)
		return
	}

	runtime.cleanup(running)
}

func (runtime *GUIRuntime) cleanup(running *runningGUIServer) {
	runtime.mu.Lock()
	defer runtime.mu.Unlock()

	if runtime.byWorkspace[running.root.WorkspacePath] == running {
		delete(runtime.byWorkspace, running.root.WorkspacePath)
	}

	if runtime.byPort[running.port] == running {
		delete(runtime.byPort, running.port)
	}
}
