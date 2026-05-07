import type { CodeBlockAttrs } from 'prosekit/extensions/code-block'
import { shikiBundledLanguagesInfo } from 'prosekit/extensions/code-block'
import type { ReactNodeViewProps } from 'prosekit/react'

import { MermaidDiagram } from '../../../MermaidDiagram'

const codeBlockLanguages = [
  { id: 'mermaid', name: 'Mermaid Diagram' },
  ...shikiBundledLanguagesInfo.filter((info) => info.id !== 'mermaid'),
]

export default function CodeBlockView(props: ReactNodeViewProps) {
  const attrs = props.node.attrs as CodeBlockAttrs
  const language = attrs.language
  const code = props.node.textContent
  const showMermaidPreview = language === 'mermaid' && code.trim() !== ''

  const setLanguage = (language: string) => {
    const attrs: CodeBlockAttrs = { language }
    props.setAttrs(attrs)
  }

  return (
    <>
      <div className="relative mx-2 top-3 h-0 select-none overflow-visible text-xs" contentEditable={false}>
        <select
          aria-label="Code block language"
          className="relative box-border w-auto cursor-pointer select-none appearance-none rounded-sm border border-white/12 bg-black/45 px-2 py-1 text-xs text-(--prosemirror-highlight) opacity-80 shadow-sm transition hover:bg-black/60 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-white/25 [div[data-node-view-root]:hover_&]:opacity-95"
          onChange={(event) => setLanguage(event.target.value)}
          value={language || ''}
        >
          <option value="">Plain Text</option>
          {codeBlockLanguages.map((info) => (
            <option key={info.id} value={info.id}>
              {info.name}
            </option>
          ))}
        </select>
      </div>
      <pre ref={props.contentRef} data-language={language}></pre>
      {showMermaidPreview ? (
        <div className="px-4 pb-4" contentEditable={false}>
          <MermaidDiagram source={code} className="flow-mermaid-diagram-editor" />
        </div>
      ) : null}
    </>
  )
}
