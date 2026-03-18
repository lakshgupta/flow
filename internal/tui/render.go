package tui

import (
	"fmt"
	"strings"

	"github.com/lex/flow/internal/graph"
	"github.com/lex/flow/internal/index"
	"github.com/lex/flow/internal/markdown"
	"github.com/lex/flow/internal/workspace"
)

// Options controls which sections the terminal view renders.
type Options struct {
	CommandGraph string
	SearchQuery  string
	SearchLimit  int
}

// Render returns a text-oriented terminal view for the selected workspace.
func Render(root workspace.Root, options Options) (string, error) {
	documents, err := workspace.LoadDocuments(root.FlowPath)
	if err != nil {
		return "", err
	}

	graphNodes, err := index.ReadGraphNodesWorkspace(root.IndexPath, root.FlowPath)
	if err != nil {
		return "", err
	}

	noteView, err := graph.BuildNoteGraphView(documents)
	if err != nil {
		return "", err
	}

	taskView, err := graph.BuildTaskLayerView(documents)
	if err != nil {
		return "", err
	}

	commandGraphNames := commandGraphs(documents)
	selectedCommandGraph := strings.TrimSpace(options.CommandGraph)
	var commandView graph.CommandLayerView
	if len(commandGraphNames) > 0 {
		if selectedCommandGraph == "" {
			selectedCommandGraph = commandGraphNames[0]
		}

		commandView, err = graph.BuildCommandLayerView(documents, selectedCommandGraph)
		if err != nil {
			return "", err
		}
	}

	results := []index.SearchResult{}
	if strings.TrimSpace(options.SearchQuery) != "" {
		results, err = index.SearchWorkspace(root.IndexPath, root.FlowPath, options.SearchQuery, options.SearchLimit)
		if err != nil {
			return "", err
		}
	}

	var builder strings.Builder
	builder.WriteString("Workspace\n")
	builder.WriteString(fmt.Sprintf("Scope: %s\n", root.Scope))
	builder.WriteString(fmt.Sprintf("Path: %s\n", root.WorkspacePath))
	builder.WriteString(fmt.Sprintf("Index: %s\n", root.IndexPath))

	builder.WriteString("\nHome\n")
	builder.WriteString(fmt.Sprintf("Path: %s/%s\n", workspace.DataDirName, workspace.HomeFileName))

	builder.WriteString("\nGraph Tree\n")
	writeGraphTree(&builder, graphNodes)

	builder.WriteString("\nGrouped Lists\n")
	writeGroupedDocuments(&builder, "Notes", groupNotes(noteView))
	writeGroupedDocuments(&builder, "Tasks", groupTasks(taskView))
	writeGroupedDocuments(&builder, "Commands", groupCommands(documents))

	builder.WriteString("\nTask Layers\n")
	if len(taskView.Layers) == 0 {
		builder.WriteString("none\n")
	} else {
		for _, layer := range taskView.Layers {
			builder.WriteString(fmt.Sprintf("L%d: %s\n", layer.Index, joinTaskLayer(layer.Tasks)))
		}
	}

	builder.WriteString("\nCommand Layers\n")
	if len(commandGraphNames) == 0 {
		builder.WriteString("none\n")
	} else {
		builder.WriteString(fmt.Sprintf("Selected graph: %s\n", commandView.SelectedGraph))
		for _, layer := range commandView.Layers {
			builder.WriteString(fmt.Sprintf("L%d: %s\n", layer.Index, joinCommandLayer(layer.Commands)))
		}
	}

	if strings.TrimSpace(options.SearchQuery) != "" {
		builder.WriteString("\nIndexed Search\n")
		builder.WriteString(fmt.Sprintf("Query: %s\n", strings.TrimSpace(options.SearchQuery)))
		if len(results) == 0 {
			builder.WriteString("none\n")
		} else {
			for _, result := range results {
				line := fmt.Sprintf("- %s %s [%s] %s", result.Type, result.ID, result.Graph, result.Path)
				if result.Title != "" {
					line += " :: " + result.Title
				}
				if result.Snippet != "" {
					line += " :: " + result.Snippet
				}
				builder.WriteString(line + "\n")
			}
		}
	}

	return builder.String(), nil
}

func writeGraphTree(builder *strings.Builder, nodes []index.GraphNode) {
	if len(nodes) == 0 {
		builder.WriteString("none\n")
		return
	}

	for _, node := range nodes {
		builder.WriteString(fmt.Sprintf("%s- %s [%d direct / %d total]\n", strings.Repeat("  ", graphTreeDepth(node.GraphPath)), node.GraphPath, node.DirectCount, node.TotalCount))
	}
}

func graphTreeDepth(graphPath string) int {
	return strings.Count(strings.TrimSpace(graphPath), "/")
}

func commandGraphs(documents []markdown.WorkspaceDocument) []string {
	seen := map[string]struct{}{}
	graphs := []string{}
	for _, item := range documents {
		commandDocument, ok := item.Document.(markdown.CommandDocument)
		if !ok {
			continue
		}

		if _, ok := seen[commandDocument.Metadata.Graph]; ok {
			continue
		}

		seen[commandDocument.Metadata.Graph] = struct{}{}
		graphs = append(graphs, commandDocument.Metadata.Graph)
	}

	return sortedStrings(graphs)
}

func groupNotes(view graph.NoteGraphView) map[string][]string {
	groups := map[string][]string{}
	for graphName, noteIDs := range view.GraphNotes {
		entries := make([]string, 0, len(noteIDs))
		for _, noteID := range noteIDs {
			note := view.Nodes[noteID]
			entries = append(entries, fmt.Sprintf("%s (%s)", note.Title, note.ID))
		}
		groups[graphName] = entries
	}

	return groups
}

func groupTasks(view graph.TaskLayerView) map[string][]string {
	groups := map[string][]string{}
	for _, task := range view.Tasks {
		groups[task.Graph] = append(groups[task.Graph], fmt.Sprintf("%s (%s)", task.Title, task.ID))
	}

	for graphName, entries := range groups {
		groups[graphName] = sortedStrings(entries)
	}

	return groups
}

func groupCommands(documents []markdown.WorkspaceDocument) map[string][]string {
	groups := map[string][]string{}
	for _, item := range documents {
		commandDocument, ok := item.Document.(markdown.CommandDocument)
		if !ok {
			continue
		}

		groups[commandDocument.Metadata.Graph] = append(
			groups[commandDocument.Metadata.Graph],
			fmt.Sprintf("%s (%s)", commandDocument.Metadata.Title, commandDocument.Metadata.ID),
		)
	}

	for graphName, entries := range groups {
		groups[graphName] = sortedStrings(entries)
	}

	return groups
}

func writeGroupedDocuments(builder *strings.Builder, label string, groups map[string][]string) {
	builder.WriteString(label + ":\n")
	if len(groups) == 0 {
		builder.WriteString("- none\n")
		return
	}

	for _, graphName := range sortedMapKeys(groups) {
		builder.WriteString(fmt.Sprintf("- %s: %s\n", graphName, strings.Join(groups[graphName], ", ")))
	}
}

func joinTaskLayer(tasks []graph.TaskNode) string {
	parts := make([]string, 0, len(tasks))
	for _, task := range tasks {
		parts = append(parts, fmt.Sprintf("%s [%s]", task.Title, task.Graph))
	}

	return strings.Join(parts, ", ")
}

func joinCommandLayer(commands []graph.CommandNode) string {
	parts := make([]string, 0, len(commands))
	for _, command := range commands {
		parts = append(parts, fmt.Sprintf("%s (%s)", command.Title, command.ID))
	}

	return strings.Join(parts, ", ")
}

func sortedStrings(values []string) []string {
	if len(values) == 0 {
		return nil
	}

	cloned := append([]string(nil), values...)
	for index := 0; index < len(cloned)-1; index++ {
		for cursor := index + 1; cursor < len(cloned); cursor++ {
			if cloned[cursor] < cloned[index] {
				cloned[index], cloned[cursor] = cloned[cursor], cloned[index]
			}
		}
	}

	return cloned
}

func sortedMapKeys(values map[string][]string) []string {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}

	return sortedStrings(keys)
}
