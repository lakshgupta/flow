import type { CodeBlockAttrs } from 'prosekit/extensions/code-block'
import { shikiBundledLanguagesInfo } from 'prosekit/extensions/code-block'
import type { ReactNodeViewProps } from 'prosekit/react'

import DiagramSection from '../diagram-section/diagram-section'

const DIAGRAM_LANGUAGES = new Set(['mermaid'])

export default function CodeBlockView(props: ReactNodeViewProps) {
  const attrs = props.node.attrs as CodeBlockAttrs
  const language = attrs.language

  if (typeof language === 'string' && DIAGRAM_LANGUAGES.has(language)) {
    return <DiagramSection {...props} />
  }

  const setLanguage = (language: string) => {
    const attrs: CodeBlockAttrs = { language }
    props.setAttrs(attrs)
  }

  const languageSelector = (
    <select
      aria-label="Code block language"
      className="relative box-border w-auto cursor-pointer select-none appearance-none rounded-sm border border-white/12 bg-black/45 px-2 py-1 text-xs text-(--prosemirror-highlight) opacity-80 shadow-sm transition hover:bg-black/60 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-white/25 [div[data-node-view-root]:hover_&]:opacity-95"
      onChange={(event) => setLanguage(event.target.value)}
      value={language || ''}
    >
      <option value="">Plain Text</option>
      {shikiBundledLanguagesInfo.map((info) => (
        <option key={info.id} value={info.id}>
          {info.name}
        </option>
      ))}
    </select>
  )

  return (
    <>
      <div className="relative mx-2 top-3 h-0 select-none overflow-visible text-xs" contentEditable={false}>
        <div className="flow-code-block-inline-controls">
          {languageSelector}
        </div>
      </div>
      <pre ref={props.contentRef} data-language={language}></pre>
    </>
  )
}
