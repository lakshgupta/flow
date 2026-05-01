import { CheckSquare, FileText, Terminal, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { GraphCanvasOverlayController } from "./graphCanvasOverlayController";

function normalizeRelationshipTag(value: string): string {
  return value.trim();
}

function appendRelationshipTag(tags: string[], rawValue: string): string[] {
  const nextTag = normalizeRelationshipTag(rawValue);
  if (nextTag === "") {
    return tags;
  }

  if (tags.some((tag) => tag.toLowerCase() === nextTag.toLowerCase())) {
    return tags;
  }

  return [...tags, nextTag];
}

export interface GraphCanvasOverlayInteractionProps {
  controller: GraphCanvasOverlayController;
}

export function GraphCanvasOverlayInteraction({
  controller,
}: GraphCanvasOverlayInteractionProps) {
  const {
    canvasContextMenu,
    connectingFrom,
    connectingPointerPos,
    connectingStartPos,
    connectingTarget,
    edgeToolbar,
    relationshipTagCatalog,
  } = controller.state;
  const { closeCanvasContextMenu, createGraphDocument, setEdgeToolbarState, persistEdgeToolbar } = controller.actions;
  const [relationshipTagInput, setRelationshipTagInput] = useState<string>("");

  useEffect(() => {
    setRelationshipTagInput("");
  }, [edgeToolbar?.edgeId]);

  return (
    <>
      {canvasContextMenu && (
        <div
          className="canvas-context-menu"
          style={{ left: canvasContextMenu.x, top: canvasContextMenu.y }}
          onContextMenu={(event) => event.preventDefault()}
        >
          <button
            type="button"
            className="flow-dropdown-item"
            onClick={() => {
              closeCanvasContextMenu();
              createGraphDocument("note");
            }}
          >
            <FileText size={13} /> Add note
          </button>
          <button
            type="button"
            className="flow-dropdown-item"
            onClick={() => {
              closeCanvasContextMenu();
              createGraphDocument("task");
            }}
          >
            <CheckSquare size={13} /> Add task
          </button>
          <button
            type="button"
            className="flow-dropdown-item"
            onClick={() => {
              closeCanvasContextMenu();
              createGraphDocument("command");
            }}
          >
            <Terminal size={13} /> Add command
          </button>
        </div>
      )}

      {edgeToolbar !== null && (
        <div
          className="graph-edge-toolbar"
          style={{
            left: edgeToolbar.x,
            top: edgeToolbar.y,
            transform: "translate(-50%, calc(-100% - 12px))",
          }}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          data-edge-toolbar="true"
        >
          <div className="graph-edge-toolbar-meta" aria-label="Edge direction">
            {edgeToolbar.sourceId} -&gt; {edgeToolbar.targetId}
          </div>

          <label className="graph-edge-toolbar-field">
            <span>Relationship tags</span>
            <div className="graph-edge-tag-editor">
              {edgeToolbar.relationships.length === 0 ? (
                <span className="graph-edge-tag-empty">No tags</span>
              ) : (
                <div className="graph-edge-tag-list" aria-label="Relationship tags">
                  {edgeToolbar.relationships.map((tag) => (
                    <span key={tag} className="graph-edge-tag-chip">
                      {tag}
                      <button
                        type="button"
                        className="graph-edge-tag-remove"
                        onClick={() => setEdgeToolbarState({
                          ...edgeToolbar,
                          relationships: edgeToolbar.relationships.filter((candidate) => candidate !== tag),
                        })}
                        aria-label={`Remove relationship tag ${tag}`}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="graph-edge-tag-input-row">
                <input
                  type="text"
                  value={relationshipTagInput}
                  onChange={(event) => setRelationshipTagInput(event.target.value)}
                  placeholder="Add relationship tag"
                  aria-label="Add relationship tag"
                  list="relationship-tag-catalog"
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== ",") {
                      return;
                    }

                    event.preventDefault();
                    const nextTags = appendRelationshipTag(edgeToolbar.relationships, relationshipTagInput);
                    setEdgeToolbarState({ ...edgeToolbar, relationships: nextTags });
                    setRelationshipTagInput("");
                  }}
                />
                <button
                  type="button"
                  className="flow-dropdown-item"
                  onClick={() => {
                    const nextTags = appendRelationshipTag(edgeToolbar.relationships, relationshipTagInput);
                    setEdgeToolbarState({ ...edgeToolbar, relationships: nextTags });
                    setRelationshipTagInput("");
                  }}
                >
                  Add
                </button>
              </div>

              {relationshipTagCatalog.length > 0 && (
                <datalist id="relationship-tag-catalog">
                  {relationshipTagCatalog.map((tag) => (
                    <option key={tag} value={tag} />
                  ))}
                </datalist>
              )}
            </div>
          </label>

          <label className="graph-edge-toolbar-field">
            <span>Context</span>
            <input
              type="text"
              value={edgeToolbar.context}
              onChange={(event) => setEdgeToolbarState({ ...edgeToolbar, context: event.target.value })}
              placeholder="Describe this link"
              aria-label="Edge context"
              onKeyDown={(event) => {
                if (event.key !== "Enter") {
                  return;
                }
                event.preventDefault();
                void persistEdgeToolbar(edgeToolbar);
              }}
            />
          </label>

          <div className="graph-edge-toolbar-actions">
            <button
              type="button"
              className="flow-dropdown-item"
              onClick={() => {
                void persistEdgeToolbar(edgeToolbar);
              }}
            >
              Save
            </button>
            <button
              type="button"
              className="flow-dropdown-item"
              onClick={() => setEdgeToolbarState(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {connectingFrom !== null && connectingPointerPos !== null && connectingStartPos !== null && (
        <svg
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 9998 }}
        >
          <line
            x1={connectingStartPos.x}
            y1={connectingStartPos.y}
            x2={connectingPointerPos.x}
            y2={connectingPointerPos.y}
            stroke="var(--graph-edge)"
            strokeWidth={2.5}
            strokeDasharray="6 4"
          />
          <circle
            cx={connectingPointerPos.x}
            cy={connectingPointerPos.y}
            r={5}
            fill={connectingTarget !== null ? "var(--graph-edge)" : "var(--graph-edge-hover)"}
          />
        </svg>
      )}
    </>
  );
}