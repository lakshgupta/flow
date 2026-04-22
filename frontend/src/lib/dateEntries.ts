export type DateEntry = {
  date: string; // YYYY-MM-DD
  content: string;
};

const DATE_HEADING_LINE_RE = /^## (\d{4}-\d{2}-\d{2})(\s|$)/;
const DATE_HEADING_RE = new RegExp(DATE_HEADING_LINE_RE.source, "m");

function splitLines(body: string): string[] {
  return body.split("\n")
}

function collectNonEmptyBlocks(body: string): string[] {
  const blocks: string[] = []
  let currentLines: string[] = []

  function flushBlock() {
    const block = currentLines.join("\n").trim()
    if (block.length > 0) {
      blocks.push(block)
    }
    currentLines = []
  }

  for (const line of splitLines(body)) {
    if (line.trim() === "") {
      flushBlock()
      continue
    }

    currentLines.push(line)
  }

  flushBlock()
  return blocks
}

/**
 * Parse markdown body into date-keyed sections.
 * Sections start at a `## YYYY-MM-DD` heading and run until the next such heading
 * or end of string. Content is the text *after* the heading line, trimmed.
 */
export function parseDateEntries(body: string): DateEntry[] {
  const entries: DateEntry[] = []
  let currentDate: string | null = null
  let currentLines: string[] = []

  for (const line of splitLines(body)) {
    const match = DATE_HEADING_LINE_RE.exec(line)
    if (match) {
      if (currentDate !== null) {
        entries.push({ date: currentDate, content: currentLines.join('\n').trim() })
      }
      currentDate = match[1]
      currentLines = []
    } else if (currentDate !== null) {
      currentLines.push(line)
    }
  }

  if (currentDate !== null) {
    entries.push({ date: currentDate, content: currentLines.join('\n').trim() })
  }

  return entries
}

/**
 * Return the set of dates (YYYY-MM-DD strings) that appear anywhere in the body.
 */
export function datesWithEntries(body: string): Set<string> {
  const found = new Set<string>()
  const re = /\b(\d{4}-\d{2}-\d{2})\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(body)) !== null) {
    found.add(m[1])
  }
  return found
}

export function todayString(): string {
  return toISODateString(new Date())
}

export function toISODateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatDisplayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Return every distinct paragraph/block in `body` that mentions `date`
 * (as the bare ISO string YYYY-MM-DD) — including the content under the
 * date's own section heading.  Results are de-duplicated and returned in
 * document order.
 */
export function findAllDateMentions(body: string, date: string): string[] {
  return collectNonEmptyBlocks(body).filter((block) => block.includes(date))
}

export { DATE_HEADING_RE }
