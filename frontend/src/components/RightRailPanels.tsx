import { memo } from "react";
import { Search } from "lucide-react";

import { fileNameFromPath, formatDocumentType } from "../lib/docUtils";
import type { CalendarDocumentResponse, SearchResult } from "../types";
import { HomeCalendarPanel } from "./HomeCalendarPanel";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Input } from "./ui/input";

type RightRailSearchPanelProps = {
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

type RightRailCalendarPanelProps = {
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