import { memo, type DragEvent as ReactDragEvent } from "react";

import type { GraphCreateType } from "../types";

type GraphEmptyStateActions = {
  setDragActive: (active: boolean) => void;
  handleFilesDrop: (files: FileList | File[]) => void;
  createGraphDocument: (type: GraphCreateType) => void;
};

export type GraphEmptyStateProps = {
  selectedGraphPath: string;
  graphCanvasDragActive: boolean;
  graphCreateError: string;
  graphCreatePendingType: GraphCreateType | "";
  actions: GraphEmptyStateActions;
};

function updateDragState(event: ReactDragEvent<HTMLElement>, selectedGraphPath: string, setDragActive: (active: boolean) => void): void {
  event.preventDefault();
  if (selectedGraphPath !== "") {
    setDragActive(true);
  }
}

function GraphEmptyStateComponent({
  selectedGraphPath,
  graphCanvasDragActive,
  graphCreateError,
  graphCreatePendingType,
  actions,
}: GraphEmptyStateProps) {
  return (
    <section
      className={`graph-empty-state shell-inner-card${graphCanvasDragActive ? " graph-canvas-shell-dragover" : ""}`}
      onDragEnter={(event) => updateDragState(event, selectedGraphPath, actions.setDragActive)}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        if (selectedGraphPath !== "") {
          actions.setDragActive(true);
        }
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        const related = event.relatedTarget;
        if (related instanceof HTMLElement && event.currentTarget.contains(related)) {
          return;
        }
        actions.setDragActive(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        actions.setDragActive(false);
        if (selectedGraphPath === "") {
          return;
        }
        const files = event.dataTransfer.files;
        if (!files || files.length === 0) {
          return;
        }
        actions.handleFilesDrop(files);
      }}
    >
      <div className="graph-empty-state-copy">
        <p className="section-kicker">Empty Graph</p>
        <h3>Start this canvas with the first document.</h3>
        <p>
          Create a note, task, or command directly in <strong>{selectedGraphPath}</strong>. The new document will open in the
          right pane immediately.
        </p>
      </div>

      {graphCreateError !== "" ? <p className="status-line status-line-error">{graphCreateError}</p> : null}

      <div className="graph-create-grid">
        <button
          className="graph-create-action graph-create-action-note"
          onClick={() => actions.createGraphDocument("note")}
          disabled={graphCreatePendingType !== ""}
          type="button"
        >
          <span className="graph-create-action-type">Note</span>
          <strong>Capture context</strong>
          <span>Start a knowledge card for design details, links, or working notes.</span>
        </button>
        <button
          className="graph-create-action graph-create-action-task"
          onClick={() => actions.createGraphDocument("task")}
          disabled={graphCreatePendingType !== ""}
          type="button"
        >
          <span className="graph-create-action-type">Task</span>
          <strong>Define work</strong>
          <span>Drop in a dependency-ready task and refine status, links, and body in the editor.</span>
        </button>
        <button
          className="graph-create-action graph-create-action-command"
          onClick={() => actions.createGraphDocument("command")}
          disabled={graphCreatePendingType !== ""}
          type="button"
        >
          <span className="graph-create-action-type">Command</span>
          <strong>Add execution</strong>
          <span>Seed a runnable command document with a placeholder name and shell step.</span>
        </button>
      </div>

      {graphCreatePendingType !== "" ? <p className="empty-state-inline">Creating {graphCreatePendingType}...</p> : null}
    </section>
  );
}

export const GraphEmptyState = memo(GraphEmptyStateComponent);