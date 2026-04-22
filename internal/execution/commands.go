package execution

import (
	"fmt"
	"runtime"
	"sort"
	"strings"

	"github.com/lex/flow/internal/markdown"
	"github.com/lex/flow/internal/workspace"
)

// CommandExecution describes one explicit command run prepared from workspace state.
type CommandExecution struct {
	ID            string
	Name          string
	Title         string
	Graph         string
	Path          string
	Run           string
	WorkingDir    string
	Environment   []string
	DependencyIDs []string
	Shell         string
	Args          []string
}

type commandRecord struct {
	path     string
	document markdown.CommandDocument
}

// PrepareCommandExecution resolves a command by document ID or short name, validates
// workspace command references, computes dependency order, and prepares a shell run.
func PrepareCommandExecution(root workspace.Root, selector string, processEnv []string) (CommandExecution, error) {
	trimmedSelector := strings.TrimSpace(selector)
	if trimmedSelector == "" {
		return CommandExecution{}, fmt.Errorf("command selector must not be empty")
	}

	documents, err := workspace.LoadDocuments(root.FlowPath)
	if err != nil {
		return CommandExecution{}, err
	}

	if err := markdown.ValidateWorkspaceDocuments(documents); err != nil {
		return CommandExecution{}, fmt.Errorf("validate workspace commands: %w", err)
	}

	commandsByID := map[string]commandRecord{}
	commandsByName := map[string]commandRecord{}
	for _, item := range documents {
		commandDocument, ok := item.Document.(markdown.CommandDocument)
		if !ok {
			continue
		}

		record := commandRecord{path: item.Path, document: commandDocument}
		commandsByID[commandDocument.Metadata.ID] = record
		commandsByName[commandDocument.Metadata.Name] = record
	}

	record, ok := commandsByID[trimmedSelector]
	if !ok {
		record, ok = commandsByName[trimmedSelector]
	}
	if !ok {
		return CommandExecution{}, fmt.Errorf("command %q not found", trimmedSelector)
	}

	dependencyIDs, err := resolveCommandDependencies(record.document.Metadata.ID, commandsByID)
	if err != nil {
		return CommandExecution{}, err
	}

	shell, args := shellCommand(record.document.Metadata.Run)
	return CommandExecution{
		ID:            record.document.Metadata.ID,
		Name:          record.document.Metadata.Name,
		Title:         record.document.Metadata.Title,
		Graph:         record.document.Metadata.Graph,
		Path:          record.path,
		Run:           record.document.Metadata.Run,
		WorkingDir:    root.WorkspacePath,
		Environment:   mergeEnvironment(processEnv, record.document.Metadata.Env),
		DependencyIDs: dependencyIDs,
		Shell:         shell,
		Args:          args,
	}, nil
}

func resolveCommandDependencies(commandID string, commandsByID map[string]commandRecord) ([]string, error) {
	ordered := []string{}
	visiting := map[string]bool{}
	visited := map[string]bool{}

	var visit func(string) error
	visit = func(currentID string) error {
		record, ok := commandsByID[currentID]
		if !ok {
			return fmt.Errorf("command %q depends on missing command %q", commandID, currentID)
		}

		if visiting[currentID] {
			return fmt.Errorf("command dependency cycle detected at %q", currentID)
		}
		if visited[currentID] {
			return nil
		}

		visiting[currentID] = true
		for _, depID := range record.document.Metadata.DependsOn {
			if _, ok := commandsByID[depID]; !ok {
				return fmt.Errorf("command %q depends on missing command %q", currentID, depID)
			}
			if err := visit(depID); err != nil {
				return err
			}
		}
		visiting[currentID] = false
		visited[currentID] = true

		if currentID != commandID {
			ordered = append(ordered, currentID)
		}

		return nil
	}

	if err := visit(commandID); err != nil {
		return nil, err
	}

	return ordered, nil
}

func mergeEnvironment(processEnv []string, commandEnv map[string]string) []string {
	if len(commandEnv) == 0 {
		return append([]string(nil), processEnv...)
	}

	merged := append([]string(nil), processEnv...)
	indexByKey := map[string]int{}
	for index, entry := range merged {
		parts := strings.SplitN(entry, "=", 2)
		indexByKey[parts[0]] = index
	}

	newKeys := make([]string, 0, len(commandEnv))
	for key := range commandEnv {
		if _, ok := indexByKey[key]; !ok {
			newKeys = append(newKeys, key)
		}
	}
	sort.Strings(newKeys)

	for key, value := range commandEnv {
		entry := key + "=" + value
		if index, ok := indexByKey[key]; ok {
			merged[index] = entry
		}
	}
	for _, key := range newKeys {
		merged = append(merged, key+"="+commandEnv[key])
	}

	return merged
}

func shellCommand(run string) (string, []string) {
	if runtime.GOOS == "windows" {
		return "cmd.exe", []string{"/C", run}
	}

	return "/bin/sh", []string{"-lc", run}
}
