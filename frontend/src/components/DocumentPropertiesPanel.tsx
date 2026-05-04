import { ArrowDownLeft, ArrowUpRight, Plus, X } from "lucide-react";
import { useState } from "react";

import { Input } from "./ui/input";
import { Button } from "./ui/button";

import type { DocumentFormState, DocumentResponse } from "../types";

type DocumentLinkStat = {
  nodeId: string;
  context: string;
  linkType: string;
};

type EditableLinkDetail = {
  nodeId: string;
  context: string;
  linkType: string;
};

const taskStatusOptions = ["Ready", "Running", "Done", "Success", "Failed", "Interrupted"];

function formatLinkCount(count: number, direction: "incoming" | "outgoing"): string {
  return `${count} ${direction} ${count === 1 ? "link" : "links"}`;
}

function summarizeLinks(links: DocumentLinkStat[]): string {
  if (links.length === 0) {
    return "None";
  }

  return links.map((link) => {
    const details = [link.linkType, link.context].filter((value) => value.trim() !== "").join(" · ");
    return details === "" ? link.nodeId : `${link.nodeId} (${details})`;
  }).join(", ");
}

export interface DocumentPropertiesPanelProps {
  selectedDocument: DocumentResponse;
  formState: DocumentFormState;
  linkStats: {
		outgoing: DocumentLinkStat[];
		incoming: DocumentLinkStat[];
  };
  editableOutgoingLinks: EditableLinkDetail[];
  availableLinkTargets: string[];
  onAddOutgoingLink: (nodeId: string) => void;
  onRemoveOutgoingLink: (nodeId: string) => void;
  onUpdateLinkDetail: (nodeId: string, field: "linkType" | "context", value: string) => void;
  updateFormField: (field: keyof DocumentFormState, value: string) => void;
}

export function DocumentPropertiesPanel({
  selectedDocument,
  formState,
  linkStats,
  editableOutgoingLinks,
  availableLinkTargets,
  onAddOutgoingLink,
  onRemoveOutgoingLink,
  onUpdateLinkDetail,
  updateFormField,
}: DocumentPropertiesPanelProps) {
  const [newLinkTarget, setNewLinkTarget] = useState<string>("");

  function handleAddOutgoingLink(): void {
    const nextTarget = newLinkTarget.trim();
    if (nextTarget === "") {
      return;
    }

    onAddOutgoingLink(nextTarget);
    setNewLinkTarget("");
  }

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

        <section className="center-document-properties-links" aria-label="Editable outgoing links">
          <h6>Outgoing link details</h6>
          <div className="center-document-properties-link-add-row">
            <Input
              aria-label="Add outgoing link target"
              placeholder="Target document ID"
              value={newLinkTarget}
              onChange={(event) => setNewLinkTarget(event.target.value)}
              list="document-link-target-options"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Add outgoing link"
              onClick={handleAddOutgoingLink}
            >
              <Plus size={14} aria-hidden="true" />
              Add
            </Button>
            <datalist id="document-link-target-options">
              {availableLinkTargets.map((target) => (
                <option key={target} value={target} />
              ))}
            </datalist>
          </div>
          {editableOutgoingLinks.length === 0 ? (
            <p className="center-document-properties-links-empty">No outgoing links.</p>
          ) : (
            editableOutgoingLinks.map((link) => (
              <div key={link.nodeId} className="center-document-properties-link-row">
                <div className="center-document-properties-link-row-header">
                  <p className="center-document-properties-link-node">{link.nodeId}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove link to ${link.nodeId}`}
                    onClick={() => onRemoveOutgoingLink(link.nodeId)}
                  >
                    <X size={14} aria-hidden="true" />
                  </Button>
                </div>
                <label className="center-document-properties-field editor-field">
                  <span>Type</span>
                  <Input
                    aria-label={`Link type for ${link.nodeId}`}
                    placeholder="depends-on, references"
                    value={link.linkType}
                    onChange={(event) => onUpdateLinkDetail(link.nodeId, "linkType", event.target.value)}
                  />
                </label>
                <label className="center-document-properties-field editor-field">
                  <span>Context</span>
                  <Input
                    aria-label={`Link context for ${link.nodeId}`}
                    placeholder="Optional context"
                    value={link.context}
                    onChange={(event) => onUpdateLinkDetail(link.nodeId, "context", event.target.value)}
                  />
                </label>
              </div>
            ))
          )}
        </section>

        <section className="center-document-properties-links" aria-label="Incoming links details">
          <h6>Incoming link details</h6>
          {linkStats.incoming.length === 0 ? (
            <p className="center-document-properties-links-empty">No incoming links.</p>
          ) : (
            linkStats.incoming.map((link) => (
              <div key={link.nodeId} className="center-document-properties-link-row">
                <p className="center-document-properties-link-node">{link.nodeId}</p>
                <p className="center-document-properties-link-meta">Type: {link.linkType.trim() === "" ? "None" : link.linkType}</p>
                <p className="center-document-properties-link-meta">Context: {link.context.trim() === "" ? "None" : link.context}</p>
              </div>
            ))
          )}
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
                {taskStatusOptions.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
                {formState.status.trim() !== "" && !taskStatusOptions.includes(formState.status) ? (
                  <option value={formState.status}>{formState.status}</option>
                ) : null}
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
