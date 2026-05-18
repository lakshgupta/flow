package desktop

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/lex/flow/internal/workspace"
)

type runtimeEnvironment struct {
	getwd         func() (string, error)
	userConfigDir func() (string, error)
}

func prepareRuntimeContext(options Options) (RuntimeContext, error) {
	env := runtimeEnvironment{
		getwd:         os.Getwd,
		userConfigDir: os.UserConfigDir,
	}

	root, err := resolveDesktopRoot(options, env)
	if err != nil {
		return RuntimeContext{}, err
	}

	if err := workspace.EnsureInitialized(root); err != nil {
		return RuntimeContext{}, err
	}

	// Resolve the global locator path so the HTTP API handler can offer
	// workspace selection even in desktop mode.
	globalLocatorPath, err := resolveGlobalLocatorPath(env)
	if err != nil {
		return RuntimeContext{}, err
	}

	return RuntimeContext{
		Root:              root,
		Backend:           NewBackend(root),
		GlobalLocatorPath: globalLocatorPath,
	}, nil
}

// resolveDesktopRoot follows GUI-like selection behavior:
// - explicit global mode resolves the configured global workspace
// - local mode prefers cwd/.flow when present, then falls back to global
func resolveDesktopRoot(options Options, environment runtimeEnvironment) (workspace.Root, error) {
	if options.Global {
		return resolveGlobalRoot(environment)
	}

	workingDirectory, err := environment.getwd()
	if err != nil {
		return workspace.Root{}, fmt.Errorf("resolve working directory: %w", err)
	}

	if info, statErr := os.Stat(filepath.Join(workingDirectory, workspace.DirName)); statErr == nil && info.IsDir() {
		return workspace.ResolveLocal(workingDirectory)
	}

	return resolveGlobalRoot(environment)
}

func resolveGlobalRoot(environment runtimeEnvironment) (workspace.Root, error) {
	configDir, err := environment.userConfigDir()
	if err != nil {
		return workspace.Root{}, fmt.Errorf("resolve user config directory: %w", err)
	}

	root, err := workspace.ResolveGlobal(workspace.DefaultGlobalLocatorPath(configDir))
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return workspace.Root{}, fmt.Errorf("global workspace is not configured; run `flow -g configure --workspace /absolute/path`")
		}

		return workspace.Root{}, err
	}

	return root, nil
}

// resolveGlobalLocatorPath returns the default global locator file path without
// attempting to resolve the workspace it points at. This is safe to call even
// when no global workspace has been configured yet.
func resolveGlobalLocatorPath(environment runtimeEnvironment) (string, error) {
	configDir, err := environment.userConfigDir()
	if err != nil {
		return "", fmt.Errorf("resolve user config directory: %w", err)
	}

	return workspace.DefaultGlobalLocatorPath(configDir), nil
}
