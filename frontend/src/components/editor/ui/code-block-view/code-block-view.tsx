import type { CodeBlockAttrs } from 'prosekit/extensions/code-block'
import { shikiBundledLanguagesInfo } from 'prosekit/extensions/code-block'
import type { ReactNodeViewProps } from 'prosekit/react'
import { Excalidraw } from '@excalidraw/excalidraw'
import { useEffect, useMemo, useRef } from 'react'

import { MermaidDiagram } from '../../../MermaidDiagram'
import { parseExcalidrawSource, serializeExcalidrawScene } from '../../../../lib/excalidraw'

const codeBlockLanguages = [
  { id: 'excalidraw', name: 'Excalidraw Diagram' },
  { id: 'mermaid', name: 'Mermaid Diagram' },
  ...shikiBundledLanguagesInfo.filter((info) => info.id !== 'excalidraw' && info.id !== 'mermaid'),
]

export default function CodeBlockView(props: ReactNodeViewProps) {
  const attrs = props.node.attrs as CodeBlockAttrs
  const language = attrs.language
  const code = props.node.textContent
  const excalidrawSource = useMemo(() => {
    return language === 'excalidraw' ? parseExcalidrawSource(code) : null
  }, [code, language])
  const excalidrawAPIRef = useRef<{ updateScene: (scene: unknown) => void } | null>(null)
  const lastSerializedExcalidrawSourceRef = useRef(code)
  const showMermaidPreview = language === 'mermaid' && code.trim() !== ''
  const showExcalidrawPreview = language === 'excalidraw'

  const setLanguage = (language: string) => {
    const attrs: CodeBlockAttrs = { language }
    props.setAttrs(attrs)
  }

  useEffect(() => {
    if (excalidrawSource === null || excalidrawSource.status === 'error') {
      lastSerializedExcalidrawSourceRef.current = code
      return
    }

    lastSerializedExcalidrawSourceRef.current = excalidrawSource.normalizedSource
  }, [code, excalidrawSource])

  useEffect(() => {
    if (showExcalidrawPreview === false || excalidrawSource === null || excalidrawSource.status === 'error') {
      return
    }
    if (excalidrawAPIRef.current === null) {
      return
    }

    excalidrawAPIRef.current.updateScene(excalidrawSource.initialData)
  }, [excalidrawSource, showExcalidrawPreview])

  const replaceCodeBlockContent = (nextCode: string) => {
    if (nextCode === code) {
      return
    }

    const pos = props.getPos()
    if (typeof pos !== 'number') {
      return
    }

    const from = pos + 1
    const to = pos + props.node.nodeSize - 1
    const transaction = props.view.state.tr

    if (nextCode === '') {
      transaction.delete(from, to)
    } else {
      transaction.replaceWith(from, to, props.view.state.schema.text(nextCode))
    }

    props.view.dispatch(transaction)
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
      <pre ref={props.contentRef} data-language={language} hidden={showExcalidrawPreview}></pre>
      {showMermaidPreview ? (
        <div className="px-4 pb-4" contentEditable={false}>
          <MermaidDiagram source={code} className="flow-mermaid-diagram-editor" />
        </div>
      ) : null}
      {showExcalidrawPreview ? (
        <div className="px-4 pb-4" contentEditable={false}>
          {excalidrawSource?.status === 'error' ? (
            <div className="flow-excalidraw-diagram flow-excalidraw-diagram-editor flow-excalidraw-diagram-error">
              <p className="flow-excalidraw-diagram-message">Unable to load Excalidraw diagram.</p>
              <p className="flow-excalidraw-diagram-detail">{excalidrawSource.error}</p>
            </div>
          ) : (
            <div className="flow-excalidraw-diagram flow-excalidraw-diagram-editor flow-excalidraw-editor-shell">
              <Excalidraw
                excalidrawAPI={(api) => {
                  excalidrawAPIRef.current = api
                }}
                initialData={excalidrawSource?.initialData}
                onChange={(elements, appState, files) => {
                  const nextSource = serializeExcalidrawScene(elements, appState, files)
                  if (nextSource === lastSerializedExcalidrawSourceRef.current) {
                    return
                  }

                  lastSerializedExcalidrawSourceRef.current = nextSource
                  replaceCodeBlockContent(nextSource)
                }}
              />
            </div>
          )}
        </div>
      ) : null}
    </>
  )
}
