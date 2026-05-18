package core

import (
	"errors"
	"fmt"
)

// GraphCreator creates one canonical graph path in workspace storage.
type GraphCreator func(name string) error

// GraphRenamer renames one canonical graph path in workspace storage.
type GraphRenamer func(currentName string, nextName string) error

// GraphDeleter deletes one canonical graph path in workspace storage.
type GraphDeleter func(name string) error

// GraphMutationHook runs follow-up work after a successful graph mutation.
type GraphMutationHook func() error

// CreateGraphRequest describes the inputs required to create a graph and
// refresh the derived index so all surfaces observe the new graph.
type CreateGraphRequest struct {
	Name      string
	IndexPath string
	FlowPath  string
}

// RenameGraphRequest describes the inputs required to rename a graph and
// refresh derived state afterwards.
type RenameGraphRequest struct {
	CurrentName string
	NextName    string
	AfterRename GraphMutationHook
}

// DeleteGraphRequest describes the inputs required to delete a graph and run
// any follow-up cleanup after the canonical mutation succeeds.
type DeleteGraphRequest struct {
	Name        string
	AfterDelete GraphMutationHook
}

// CreateGraph creates one graph directory in canonical workspace storage and
// then rebuilds the derived index.
func CreateGraph(request CreateGraphRequest, createGraph GraphCreator) error {
	if createGraph == nil {
		return errors.New("graph creator must not be nil")
	}

	if err := createGraph(request.Name); err != nil {
		return err
	}

	if err := RebuildIndex(RebuildIndexRequest{
		IndexPath: request.IndexPath,
		FlowPath:  request.FlowPath,
	}); err != nil {
		return fmt.Errorf("rebuild index after graph create: %w", err)
	}

	return nil
}

// RenameGraph renames one graph in canonical storage and then runs any
// required follow-up work such as GUI configuration remapping.
func RenameGraph(request RenameGraphRequest, renameGraph GraphRenamer) error {
	if renameGraph == nil {
		return errors.New("graph renamer must not be nil")
	}

	if err := renameGraph(request.CurrentName, request.NextName); err != nil {
		return err
	}

	if request.AfterRename != nil {
		if err := request.AfterRename(); err != nil {
			return fmt.Errorf("after graph rename: %w", err)
		}
	}

	return nil
}

// DeleteGraph deletes one graph in canonical storage and then runs any
// required follow-up work such as GUI configuration cleanup.
func DeleteGraph(request DeleteGraphRequest, deleteGraph GraphDeleter) error {
	if deleteGraph == nil {
		return errors.New("graph deleter must not be nil")
	}

	if err := deleteGraph(request.Name); err != nil {
		return err
	}

	if request.AfterDelete != nil {
		if err := request.AfterDelete(); err != nil {
			return fmt.Errorf("after graph delete: %w", err)
		}
	}

	return nil
}
