package core

import (
	"fmt"
	"strings"

	"github.com/lex/flow/internal/index"
)

// RebuildIndexRequest contains the file-system paths required to rebuild
// the derived SQLite index from canonical workspace Markdown.
type RebuildIndexRequest struct {
	IndexPath string
	FlowPath  string
}

// RebuildIndex executes a workspace index rebuild with basic input validation.
func RebuildIndex(request RebuildIndexRequest) error {
	indexPath := strings.TrimSpace(request.IndexPath)
	flowPath := strings.TrimSpace(request.FlowPath)
	if indexPath == "" {
		return fmt.Errorf("index path must not be empty")
	}
	if flowPath == "" {
		return fmt.Errorf("flow path must not be empty")
	}

	return index.Rebuild(indexPath, flowPath)
}
