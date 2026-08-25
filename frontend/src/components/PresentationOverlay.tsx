import { memo } from "react";

import { RenderedMarkdown } from "./RenderedMarkdown";
import type { PresentationState } from "../lib/presentationNavigation";
import type { PresentationNode } from "../lib/presentationNavigation";

export type PresentationOverlayProps = {
  state: PresentationState;
  nodesById: Map<string, PresentationNode>;
  bodies: Record<string, string>;
  onClose: () => void;
  onBack: () => void;
  onFollow: () => void;
  onRotate: (direction: 1 | -1) => void;
  onOpen: (nodeId: string) => void;
};

function PresentationOverlayComponent({
  state,
  nodesById,
  bodies,
  onClose,
  onBack,
  onFollow,
  onRotate,
  onOpen,
}: PresentationOverlayProps) {
  if (!state.active) {
    return null;
  }

  const node = nodesById.get(state.currentId);
  if (node === undefined) {
    return null;
  }

  const body = Object.prototype.hasOwnProperty.call(bodies, state.currentId)
    ? bodies[state.currentId]
    : node.description;

  return (
    <div className="presentation-backdrop" role="dialog" aria-modal="true" aria-label="Presentation mode">
      <article className="presentation-slide" data-testid="presentation-slide">
        <header className="presentation-slide-header">
          <div className="presentation-badges">
            <span className={`presentation-badge presentation-badge-${node.type}`}>{node.type}</span>
            {node.status ? (
              <span className="presentation-badge presentation-badge-status">{node.status}</span>
            ) : null}
          </div>
          <button type="button" className="presentation-exit" onClick={onClose} aria-label="Exit presentation mode" data-testid="presentation-exit">
            esc
          </button>
        </header>
        <h1 className="presentation-title">{node.title}</h1>
        <div className="presentation-body" data-testid="presentation-body">
          {node.type === "command" && node.run ? (
            <pre className="presentation-run">{node.run}</pre>
          ) : (
            <RenderedMarkdown value={body} ariaLabel="Slide content" />
          )}
        </div>
        <footer className="presentation-footer">
          {state.candidates.length > 0 ? (
            <ul className="presentation-candidates" aria-label="Child nodes; press right to drill in">
              {state.candidates.map((candidate, index) => {
                const candidateNode = nodesById.get(candidate.id);
                const isHighlighted = index === state.highlightIndex;
                return (
                  <li
                    key={candidate.id}
                    className={`presentation-candidate${isHighlighted ? " is-highlighted" : ""}`}
                    aria-current={isHighlighted ? "true" : undefined}
                    title={candidate.context ?? ""}
                  >
                    <span className="presentation-candidate-arrow" aria-hidden="true">→</span>
                    {candidateNode?.title ?? candidate.id}
                  </li>
                );
              })}
            </ul>
          ) : (
            <span className="presentation-candidates presentation-candidates-empty">No outgoing connections</span>
          )}
          <span className="presentation-counter" aria-live="polite">
            slide {state.history.length + 1}
          </span>
          <span className="presentation-hints" aria-hidden="true">
            ← back · → drill in · ↑↓ siblings · enter open · esc exit
          </span>
        </footer>
      </article>
      {/* Invisible buttons keep the keyboard contract testable via user events. */}
      <div className="presentation-controls" hidden>
        <button type="button" data-testid="presentation-back" onClick={onBack}>back</button>
        <button type="button" data-testid="presentation-follow" onClick={onFollow}>follow</button>
        <button type="button" data-testid="presentation-rotate-up" onClick={() => onRotate(-1)}>rotate up</button>
        <button type="button" data-testid="presentation-rotate-down" onClick={() => onRotate(1)}>rotate down</button>
        <button type="button" data-testid="presentation-open" onClick={() => onOpen(state.currentId)}>open</button>
      </div>
    </div>
  );
}

export const PresentationOverlay = memo(PresentationOverlayComponent);
