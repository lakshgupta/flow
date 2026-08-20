import { defineCodeBlockHighlight } from 'prosekit/extensions/code-block'
import type { Parser } from 'prosemirror-highlight'
import { createParser } from 'prosemirror-highlight/shiki'
import { createHighlighter, type Highlighter } from 'shiki/bundle/full'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'

// Diagram code blocks (mermaid source, excalidraw scene JSON) are rendered as
// labeled sections with their own UI — the source is not user-facing code, and
// shiki cannot resolve the `excalidraw` language. Skip syntax highlighting for
// them entirely instead of logging a parser error on every document change.
const SKIP_HIGHLIGHT_LANGUAGES = new Set(['mermaid', 'excalidraw'])

const HIGHLIGHTER_OPTIONS = { themes: ['one-dark-pro' as const], langs: ['text' as const] }

// Module-level lazy highlighter shared across editor instances. Mirrors
// prosekit's internal createLazyParser (prosekit/extensions/dist/code-block),
// but with a language filter so diagram languages never reach shiki.
let highlighterPromise: Promise<void> | null = null
let highlighter: Highlighter | null = null
const loadedLangs = new Set<string>()
const loadedThemes = new Set<string>()

type HighlightRequest =
  | { highlighter: Highlighter }
  | { promise: Promise<void> }

function ensureHighlighter(): Promise<void> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: HIGHLIGHTER_OPTIONS.themes,
      langs: HIGHLIGHTER_OPTIONS.langs,
      engine: createJavaScriptRegexEngine({ forgiving: true }),
    }).then((created) => {
      highlighter = created
    })
  }
  return highlighterPromise
}

async function loadLanguages(langs: string[]): Promise<void> {
  for (const lang of langs) {
    if (!highlighter) break
    await highlighter.loadLanguage(lang as never)
    loadedLangs.add(lang)
  }
}

async function loadThemes(themes: string[]): Promise<void> {
  for (const theme of themes) {
    if (!highlighter) break
    await highlighter.loadTheme(theme as never)
    loadedThemes.add(theme)
  }
}

function createOrGetHighlighter(langs: string[]): HighlightRequest {
  if (!highlighter) {
    return { promise: ensureHighlighter() }
  }
  const missingLangs = langs.filter((lang) => !loadedLangs.has(lang))
  if (missingLangs.length > 0) {
    return { promise: loadLanguages(missingLangs) }
  }
  const missingThemes = HIGHLIGHTER_OPTIONS.themes.filter((theme) => !loadedThemes.has(theme))
  if (missingThemes.length > 0) {
    return { promise: loadThemes(missingThemes) }
  }
  return { highlighter }
}

export function defineEditorCodeBlockHighlight() {
  let parser: ReturnType<typeof createParser> | null = null

  const lazyParser: Parser = (options) => {
    const language = options.language ?? ''
    if (SKIP_HIGHLIGHT_LANGUAGES.has(language)) {
      return []
    }

    const request = createOrGetHighlighter([language])
    if (!('highlighter' in request)) {
      return request.promise
    }
    if (!parser) {
      parser = createParser(request.highlighter, { theme: HIGHLIGHTER_OPTIONS.themes[0] })
    }
    return parser(options)
  }

  return defineCodeBlockHighlight({ parser: lazyParser })
}
