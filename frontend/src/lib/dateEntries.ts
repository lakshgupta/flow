export type DateEntry = {
  date: string; // YYYY-MM-DD
  content: string;
};

const DATE_HEADING_RE = /^## (\d{4}-\d{2}-\d{2})(\s|$)/m;

/**
 * Parse markdown body into date-keyed sections.
 * Sections start at a `## YYYY-MM-DD` heading and run until the next such heading
 * or end of string. Content is the text *after* the heading line, trimmed.
 */
export function parseDateEntries(body: string): DateEntry[] {
  const lines = body.split('\n')
  const entries: DateEntry[] = []
  let currentDate: string | null = null
  let currentLines: string[] = []

  for (const line of lines) {
    const match = /^## (\d{4}-\d{2}-\d{2})(\s|$)/.exec(line)
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
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
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
  // Walk lines; collect blocks separated by blank lines that contain `date`
  const blocks: string[] = []
  const lines = body.split('\n')
  let current: string[] = []

  function flushBlock() {
    const block = current.join('\n').trim()
    if (block.length > 0) blocks.push(block)
    current = []
  }

  for (const line of lines) {
    if (line.trim() === '') {
      flushBlock()
    } else {
      current.push(line)
    }
  }
  flushBlock()

  return blocks.filter((b) => b.includes(date))
}

export { DATE_HEADING_RE }
