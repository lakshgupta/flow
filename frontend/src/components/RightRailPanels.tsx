import { memo } from "react";
import { ArrowRight, Search, Wand2 } from "lucide-react";

import { fileNameFromPath, formatDocumentType } from "../lib/docUtils";
import { edgeTypeFixLabel } from "../lib/graphCanvasUtils";
import type { CalendarDocumentResponse, EdgeTypeViolation, SearchResult } from "../types";
import { HomeCalendarPanel } from "./HomeCalendarPanel";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Input } from "./ui/input";

export type RightRailSearchPanelProps = {
  searchQuery: string;
  searchTagQuery: string;
  searchTitleQuery: string;
  searchDescriptionQuery: string;
  searchContentQuery: string;
  searchError: string;
  hasDeferredSearchFilter: boolean;
  searchResults: SearchResult[];
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  setSearchTagQuery: React.Dispatch<React.SetStateAction<string>>;
  setSearchTitleQuery: React.Dispatch<React.SetStateAction<string>>;
  setSearchDescriptionQuery: React.Dispatch<React.SetStateAction<string>>;
  setSearchContentQuery: React.Dispatch<React.SetStateAction<string>>;
  onResultNavigate: (result: SearchResult) => void;
};

function RightRailSearchPanelComponent({
  searchQuery,
  searchTagQuery,
  searchTitleQuery,
  searchDescriptionQuery,
  searchContentQuery,
  searchError,
  hasDeferredSearchFilter,
  searchResults,
  setSearchQuery,
  setSearchTagQuery,
  setSearchTitleQuery,
  setSearchDescriptionQuery,
  setSearchContentQuery,
  onResultNavigate,
}: RightRailSearchPanelProps) {
  return (
    <Card className="detail-card-context shell-context-card">
      <CardHeader className="panel-header shell-context-header">
        <div>
          <h3>Search</h3>
        </div>
      </CardHeader>
      <CardContent className="shell-context-content">
        <div className="right-search-field">
          <Search aria-hidden="true" className="right-search-icon" size={16} />
          <Input
            aria-label="Search all fields"
            autoFocus
            className="shell-search-input shell-search-input-with-icon"
            placeholder="Any field"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            aria-label="Search by tag"
            placeholder="Tag"
            value={searchTagQuery}
            onChange={(event) => setSearchTagQuery(event.target.value)}
          />
          <Input
            aria-label="Search by title"
            placeholder="Title"
            value={searchTitleQuery}
            onChange={(event) => setSearchTitleQuery(event.target.value)}
          />
          <Input
            aria-label="Search by description"
            placeholder="Description"
            value={searchDescriptionQuery}
            onChange={(event) => setSearchDescriptionQuery(event.target.value)}
          />
          <Input
            aria-label="Search by content"
            placeholder="Content"
            value={searchContentQuery}
            onChange={(event) => setSearchContentQuery(event.target.value)}
          />
        </div>
        {searchError !== "" ? <p className="status-line status-line-error">{searchError}</p> : null}
        {hasDeferredSearchFilter ? (
          <div className="search-results">
            {searchResults.length === 0 ? (
              <p className="empty-state-inline">No indexed matches.</p>
            ) : (
              searchResults.map((result) => (
                <button
                  key={result.id}
                  className="search-result"
                  type="button"
                  onClick={() => onResultNavigate(result)}
                >
                  <span className="search-result-type">{formatDocumentType(result.type)}</span>
                  <strong>{result.title}</strong>
                  <span className="item-file-name">{result.type === "home" ? "Workspace Home" : fileNameFromPath(result.path)}</span>
                  <span className="item-path">{result.path}</span>
                  {result.type !== "home" ? <span>{result.graph}</span> : null}
                  {result.description !== "" ? <p className="search-result-description">{result.description}</p> : null}
                  <p>{result.snippet}</p>
                </button>
              ))
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export const RightRailSearchPanel = memo(RightRailSearchPanelComponent);

export type RightRailCalendarPanelProps = {
  documents: CalendarDocumentResponse[];
  selectedDate: string;
  error: string;
  onDateChange: React.Dispatch<React.SetStateAction<string>>;
  onDocumentOpen: (document: CalendarDocumentResponse) => void;
};

function RightRailCalendarPanelComponent({
  documents,
  selectedDate,
  error,
  onDateChange,
  onDocumentOpen,
}: RightRailCalendarPanelProps) {
  return (
    <Card className="detail-card-context shell-context-card home-cal-card">
      <CardContent className="shell-context-content p-0">
        <HomeCalendarPanel
          documents={documents}
          selectedDate={selectedDate}
          onDateChange={onDateChange}
          onDocumentOpen={onDocumentOpen}
          error={error}
        />
      </CardContent>
    </Card>
  );
}

export const RightRailCalendarPanel = memo(RightRailCalendarPanelComponent);

export type RightRailViolationsPanelProps = {
  /** The graph whose persisted per-graph violation list is being shown. */
  graphPath: string;
  /** The current graph's violation list, served by the graph-validation endpoint. */
  violations: EdgeTypeViolation[];
  /** Keys ("fromID\u0000toID") whose canvas edge is an editable link, so a quick fix applies. */
  fixableEdgeKeys: Set<string>;
  onFixViolation: (violation: EdgeTypeViolation) => void;
  onFixAll: () => void;
  /** Highlights the matching edge on the canvas. */
  onSelectViolation: (violation: EdgeTypeViolation) => void;
  /** @deprecated Panel is closed by toggling the Edge violations icon again; kept for compatibility. */
  onClose?: () => void;
};

function RightRailViolationsPanelComponent({
  graphPath,
  violations,
  fixableEdgeKeys,
  onFixViolation,
  onFixAll,
  onSelectViolation,
}: RightRailViolationsPanelProps) {
  const errorCount = violations.filter((violation) => violation.severity === "error").length;
  const warningCount = violations.length - errorCount;
  const sortedViolations = [...violations].sort((left, right) => {
    if (left.severity !== right.severity) {
      return left.severity === "error" ? -1 : 1;
    }
    return (
      left.path.localeCompare(right.path)
      || left.fromID.localeCompare(right.fromID)
      || left.toID.localeCompare(right.toID)
      || left.relationship.localeCompare(right.relationship)
    );
  });

  return (
    <Card className="detail-card-context shell-context-card">
      <CardHeader className="panel-header shell-context-header">
        <div className="graph-violations-header">
          <h3>Edge violations</h3>
          {violations.length > 0 && (
            <div className="graph-violations-summary">
              {errorCount > 0 && (
                <span className="graph-violations-count graph-violations-count-error">{errorCount} error{errorCount === 1 ? "" : "s"}</span>
              )}
              {warningCount > 0 && (
                <span className="graph-violations-count graph-violations-count-warning">{warningCount} warning{warningCount === 1 ? "" : "s"}</span>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="shell-context-content graph-violations-content">
        {graphPath.trim() === "" ? (
          <p className="empty-state-inline">Open a graph to inspect its edge-type violations.</p>
        ) : sortedViolations.length === 0 ? (
          <p className="empty-state-inline">No edge-type violations in this graph.</p>
        ) : (
          <>
            <ul className="graph-violations-list">
              {sortedViolations.map((violation, index) => {
                const fixable = fixableEdgeKeys.has(`${violation.fromID}\u0000${violation.toID}`);
                const fixLabel = edgeTypeFixLabel(violation);

                return (
                  <li
                    key={`${violation.path}-${violation.fromID}-${violation.toID}-${violation.relationship}-${index}`}
                    className={`graph-violation-card graph-violation-card-${violation.severity}`}
                  >
                    <button
                      type="button"
                      className="graph-violation-main"
                      onClick={() => onSelectViolation(violation)}
                      aria-label={`Highlight ${violation.fromID} to ${violation.toID}`}
                      title="Highlight this edge on the canvas"
                    >
                      <span className="graph-violation-row">
                        <span className={`graph-validation-severity graph-validation-severity-${violation.severity}`}>
                          {violation.severity}
                        </span>
                        <span className="graph-violation-relationship">{violation.relationship}</span>
                      </span>
                      <p className="graph-violation-message">{violation.message}</p>
                      <span className="graph-violation-edge">
                        {violation.fromID}
                        <ArrowRight aria-hidden="true" size={12} />
                        {violation.toID}
                      </span>
                      <span className="graph-violation-meta">
                        {violation.graph}{violation.path !== "" ? ` · ${violation.path}` : ""}
                      </span>
                    </button>
                    {fixable && (
                      <button
                        type="button"
                        className="graph-violation-fix"
                        onClick={() => onFixViolation(violation)}
                        title={fixLabel === "" ? "Remove the offending relationship tag" : `Replace with ${fixLabel}`}
                      >
                        <Wand2 aria-hidden="true" size={12} />
                        {fixLabel === "" ? "Remove tag" : fixLabel}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="graph-violations-footer">
              <button type="button" className="graph-violations-fix-all" onClick={onFixAll}>
                <Wand2 aria-hidden="true" size={14} />
                Fix all ({violations.length})
              </button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export const RightRailViolationsPanel = memo(RightRailViolationsPanelComponent);