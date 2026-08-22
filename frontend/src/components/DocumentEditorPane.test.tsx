import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DocumentEditorPane, type DocumentEditorPaneActions } from "./DocumentEditorPane";
import type { DocumentFormState, DocumentResponse } from "../types";

function makeDocument(overrides?: Partial<DocumentResponse>): DocumentResponse {
  return {
    id: "task-1",
    type: "task",
    featureSlug: "execution",
    graph: "execution",
    title: "Run parser",
    description: "Parse the input",
    path: "data/graphs/execution/run-parser.md",
    tags: [],
    body: "Body",
    links: [],
    status: "Ready",
    ...overrides,
  };
}

function makeFormState(status: string): DocumentFormState {
  return {
    title: "Run parser",
    graph: "execution",
    tags: "",
    description: "Parse the input",
    body: "Body",
    status,
    links: "",
    name: "",
    env: "",
    run: "",
    color: "",
  };
}

function makeActions(): DocumentEditorPaneActions {
  return {
    toggleMaximize: vi.fn(),
    openDeleteDialog: vi.fn(),
    closeDocument: vi.fn(),
    updateFormField: vi.fn(),
    openInlineReference: vi.fn(),
    openDate: vi.fn(),
    openThreadAsset: vi.fn(),
    clearEditorScrollTarget: vi.fn(),
    handleFilesDrop: vi.fn(),
    inspectDocument: vi.fn(),
  };
}

describe("DocumentEditorPane task status select", () => {
  it("renders a status select on task documents showing the current status", () => {
    const actions = makeActions();
    render(
      <DocumentEditorPane
        selectedDocument={makeDocument()}
        formState={makeFormState("Running")}
        panelError=""
        mutationError=""
        mutationSuccess=""
        savingDocument={false}
        deletingDocument={false}
        isMaximized={false}
        outgoingLinks={[]}
        incomingLinks={[]}
        rightRailDocumentEditorRef={{ current: null }}
        editorScrollTarget={null}
        actions={actions}
      />,
    );

    const select = screen.getByLabelText("Task status");
    expect(select).toBeInstanceOf(HTMLSelectElement);
    expect((select as HTMLSelectElement).value).toBe("Running");
  });

  it("does not render a status select for non-task documents", () => {
    const actions = makeActions();
    render(
      <DocumentEditorPane
        selectedDocument={makeDocument({ type: "note", status: undefined })}
        formState={makeFormState("")}
        panelError=""
        mutationError=""
        mutationSuccess=""
        savingDocument={false}
        deletingDocument={false}
        isMaximized={false}
        outgoingLinks={[]}
        incomingLinks={[]}
        rightRailDocumentEditorRef={{ current: null }}
        editorScrollTarget={null}
        actions={actions}
      />,
    );

    expect(screen.queryByLabelText("Task status")).toBeNull();
  });

  it("updates the form field when a new status is picked", () => {
    const actions = makeActions();
    render(
      <DocumentEditorPane
        selectedDocument={makeDocument()}
        formState={makeFormState("Ready")}
        panelError=""
        mutationError=""
        mutationSuccess=""
        savingDocument={false}
        deletingDocument={false}
        isMaximized={false}
        outgoingLinks={[]}
        incomingLinks={[]}
        rightRailDocumentEditorRef={{ current: null }}
        editorScrollTarget={null}
        actions={actions}
      />,
    );

    const select = screen.getByLabelText("Task status");
    fireEvent.change(select, { target: { value: "Done" } });
    expect(actions.updateFormField).toHaveBeenCalledWith("status", "Done");
  });
});
