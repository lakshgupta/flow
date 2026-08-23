import { memo, useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";

type LocalSearchBarProps = {
  open: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  matchCount: number;
  currentIndex: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
};

function LocalSearchBarComponent({
  open,
  query,
  onQueryChange,
  matchCount,
  currentIndex,
  onPrev,
  onNext,
  onClose,
}: LocalSearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="local-search-bar" role="search" aria-label="Find in document">
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            if (event.shiftKey) {
              onPrev();
            } else {
              onNext();
            }
          } else if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
        }}
        placeholder="Find in document"
        aria-label="Find in document"
        className="local-search-input"
      />
      <span className="local-search-count" aria-live="polite">
        {query.trim() === "" ? "" : matchCount === 0 ? "No results" : `${currentIndex + 1}/${matchCount}`}
      </span>
      <button
        type="button"
        className="local-search-nav"
        onClick={onPrev}
        disabled={matchCount === 0}
        aria-label="Previous match"
      >
        <ChevronUp size={14} />
      </button>
      <button
        type="button"
        className="local-search-nav"
        onClick={onNext}
        disabled={matchCount === 0}
        aria-label="Next match"
      >
        <ChevronDown size={14} />
      </button>
      <button type="button" className="local-search-close" onClick={onClose} aria-label="Close find bar">
        <X size={14} />
      </button>
    </div>
  );
}

export const LocalSearchBar = memo(LocalSearchBarComponent);
