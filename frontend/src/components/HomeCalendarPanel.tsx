import { useMemo } from "react";
import MarkdownIt from "markdown-it";

import { Calendar } from "@/components/ui/calendar";
import { findAllDateMentions, datesWithEntries, toISODateString } from "@/lib/dateEntries";
import type { CalendarDocumentResponse } from "@/types";

const md = new MarkdownIt({ html: false, linkify: true, breaks: true });

type HomeCalendarPanelProps = {
  documents: CalendarDocumentResponse[];
  selectedDate: string;
  onDateChange: (date: string) => void;
  error?: string;
};

type CalendarMention = {
  key: string;
  sourceLabel: string;
  block: string;
};

function calendarDocumentLabel(document: CalendarDocumentResponse): string {
  if (document.type === "home") {
    return "Workspace Home";
  }

  if (document.graph.trim() === "") {
    return document.title;
  }

  return `${document.graph} / ${document.title}`;
}

export function HomeCalendarPanel({ documents, selectedDate, onDateChange, error = "" }: HomeCalendarPanelProps) {

  const datesWithContent = useMemo(() => {
    const dateStrs = new Set<string>();
    for (const document of documents) {
      for (const dateStr of datesWithEntries(document.body)) {
        dateStrs.add(dateStr);
      }
    }

    return Array.from(dateStrs).map((s) => {
      const [y, m, d] = s.split("-").map(Number);
      return new Date(y, m - 1, d);
    });
  }, [documents]);

  const mentions = useMemo<CalendarMention[]>(() => {
    return documents.flatMap((document) =>
      findAllDateMentions(document.body, selectedDate).map((block, index) => ({
        key: `${document.id}:${index}`,
        sourceLabel: calendarDocumentLabel(document),
        block,
      })),
    );
  }, [documents, selectedDate]);

  function handleDaySelect(day: Date | undefined) {
    if (!day) return;
    onDateChange(toISODateString(day));
  }

  const selectedDayObj = (() => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    return new Date(y, m - 1, d);
  })();

  return (
    <div className="home-cal-panel">
      <Calendar
        mode="single"
        selected={selectedDayObj}
        onSelect={handleDaySelect}
        modifiers={{ hasEntry: datesWithContent }}
        modifiersClassNames={{ hasEntry: "rdp-day-has-entry" }}
      />
      <div className="home-cal-entries">
        {error !== "" ? (
          <p className="home-cal-empty">{error}</p>
        ) : mentions.length > 0 ? (
          <div className="home-cal-mentions">
            {mentions.map((mention) => (
              <div key={mention.key} className="home-cal-item">
                <p className="home-cal-source">{mention.sourceLabel}</p>
                <div
                  className="home-cal-content rich-editor-preview"
                  dangerouslySetInnerHTML={{ __html: md.render(mention.block) }}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="home-cal-empty">No entries for this day.</p>
        )}
      </div>
      <div className="home-cal-footer" />
    </div>
  );
}
