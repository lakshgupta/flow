import { useMemo } from "react";
import MarkdownIt from "markdown-it";

import { Calendar } from "@/components/ui/calendar";
import { findAllDateMentions, datesWithEntries } from "@/lib/dateEntries";

const md = new MarkdownIt({ html: false, linkify: true, breaks: true });

type HomeCalendarPanelProps = {
  body: string;
  selectedDate: string;
  onDateChange: (date: string) => void;
};

export function HomeCalendarPanel({ body, selectedDate, onDateChange }: HomeCalendarPanelProps) {

  const datesWithContent = useMemo(() => {
    const dateStrs = datesWithEntries(body);
    return Array.from(dateStrs).map((s) => {
      const [y, m, d] = s.split("-").map(Number);
      return new Date(y, m - 1, d);
    });
  }, [body]);

  const mentions = useMemo(() => findAllDateMentions(body, selectedDate), [body, selectedDate]);

  function handleDaySelect(day: Date | undefined) {
    if (!day) return;
    const y = day.getFullYear();
    const m = String(day.getMonth() + 1).padStart(2, "0");
    const d = String(day.getDate()).padStart(2, "0");
    onDateChange(`${y}-${m}-${d}`);
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
        {mentions.length > 0 ? (
          <div className="home-cal-mentions">
            {mentions.map((block, i) => (
              <div
                key={i}
                className="home-cal-content rich-editor-preview"
                dangerouslySetInnerHTML={{ __html: md.render(block) }}
              />
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
