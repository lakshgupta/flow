import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

import { Input } from "./ui/input";

import type { DocumentFormState, DocumentResponse } from "../types";

type DocumentLinkStat = {
  nodeId: string;
  context: string;
};

function formatLinkCount(count: number, direction: "incoming" | "outgoing"): string {
  return `${count} ${direction} ${count === 1 ? "link" : "links"}`;
}

function summarizeLinks(links: DocumentLinkStat[]): string {
  if (links.length === 0) {
    return "None";
  }

  return links.map((link) => (link.context === "" ? link.nodeId : `${link.nodeId} (${link.context})`)).join(", ");
}

export interface DocumentPropertiesPanelProps {
  selectedDocument: DocumentResponse;
  formState: DocumentFormState;
  linkStats: {
    outgoing: DocumentLinkStat[];
    incoming: DocumentLinkStat[];
  };
  updateFormField: (field: keyof DocumentFormState, value: string) => void;
}

export function DocumentPropertiesPanel({
  selectedDocument,
  formState,
  linkStats,
  updateFormField,
}: DocumentPropertiesPanelProps) {
  return (
    <div className="center-document-properties">
      <section className="center-document-properties-section">
        <h5>Core</h5>
        <label className="center-document-properties-field editor-field">
          <span>Description</span>
          <textarea
            aria-label="Document description"
            placeholder="Add a brief description…"
            rows={4}
            value={formState.description}
            onChange={(event) => updateFormField("description", event.target.value)}
          />
        </label>
        <label className="center-document-properties-field editor-field">
          <span>Tags</span>
          <textarea
            aria-label="Document tags"
            placeholder="Add tags, one per line or comma separated"
            rows={4}
            value={formState.tags}
            onChange={(event) => updateFormField("tags", event.target.value)}
          />
        </label>
        <label className="center-document-properties-field editor-field">
          <span>Links</span>
          <textarea
            aria-label="Document links"
            placeholder="Linked document IDs, one per line or comma separated"
            rows={4}
            value={formState.links}
            onChange={(event) => updateFormField("links", event.target.value)}
          />
        </label>
        <section className="center-document-properties-link-stats" aria-label="Document link stats">
          <div
            className="center-document-link-stat"
            title={`Outgoing links: ${summarizeLinks(linkStats.outgoing)}`}
          >
            <ArrowUpRight size={14} aria-hidden="true" />
            <span>{formatLinkCount(linkStats.outgoing.length, "outgoing")}</span>
          </div>
          <div
            className="center-document-link-stat"
            title={`Incoming links: ${summarizeLinks(linkStats.incoming)}`}
          >
            <ArrowDownLeft size={14} aria-hidden="true" />
            <span>{formatLinkCount(linkStats.incoming.length, "incoming")}</span>
          </div>
        </section>
      </section>

      {(selectedDocument.type === "task" || selectedDocument.type === "command") && (
        <section className="center-document-properties-section">
          <h5>{selectedDocument.type === "task" ? "Task" : "Command"}</h5>

          {selectedDocument.type === "task" ? (
            <label className="center-document-properties-field editor-field">
              <span>Status</span>
              <select
                aria-label="Task status"
                value={formState.status}
                onChange={(event) => updateFormField("status", event.target.value)}
              >
                <option value="">No status</option>
                <option value="todo">todo</option>
                <option value="doing">doing</option>
                <option value="done">done</option>
              </select>
            </label>
          ) : null}

          {selectedDocument.type === "command" ? (
            <label className="center-document-properties-field editor-field">
              <span>Name</span>
              <Input
                aria-label="Command name"
                placeholder="Command name"
                value={formState.name}
                onChange={(event) => updateFormField("name", event.target.value)}
              />
            </label>
          ) : null}

          <label className="center-document-properties-field editor-field">
            <span>Dependencies</span>
            <textarea
              aria-label={`${selectedDocument.type === "task" ? "Task" : "Command"} dependencies`}
              placeholder="Dependency document IDs, one per line or comma separated"
              rows={4}
              value={formState.dependsOn}
              onChange={(event) => updateFormField("dependsOn", event.target.value)}
            />
          </label>

          {selectedDocument.type === "command" ? (
            <>
              <label className="center-document-properties-field editor-field">
                <span>Env</span>
                <textarea
                  aria-label="Command environment variables"
                  placeholder="KEY=value, one per line"
                  rows={4}
                  value={formState.env}
                  onChange={(event) => updateFormField("env", event.target.value)}
                />
              </label>
              <label className="center-document-properties-field editor-field">
                <span>Run</span>
                <textarea
                  aria-label="Command run script"
                  placeholder="Shell command/script body"
                  rows={4}
                  value={formState.run}
                  onChange={(event) => updateFormField("run", event.target.value)}
                />
              </label>
            </>
          ) : null}
        </section>
      )}
    </div>
  );
}
