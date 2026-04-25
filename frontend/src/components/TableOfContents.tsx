import React from "react";

export interface TOCItem {
  level: number;
  text: string;
  id: string;
}

export interface TableOfContentsProps {
  items: TOCItem[];
  onNavigate: (id: string) => void;
  emptyMessage?: string;
}

export function TableOfContents({ items, onNavigate, emptyMessage = "No headings yet." }: TableOfContentsProps) {
  if (items.length === 0) {
    return <p className="empty-state-inline">{emptyMessage}</p>;
  }

  return (
    <nav className="toc-nav">
      <ul className="toc-list">
        {items.map((item, index) => (
          <li
            key={index}
            className={`toc-item toc-level-${item.level}`}
            style={{ marginLeft: `${(item.level - 1) * 1}rem` }}
          >
            <button
              type="button"
              className="toc-link"
              onClick={() => onNavigate(item.id)}
            >
              {item.text}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
