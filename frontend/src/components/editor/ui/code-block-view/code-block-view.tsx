import type { CodeBlockAttrs } from 'prosekit/extensions/code-block'
import { shikiBundledLanguagesInfo } from 'prosekit/extensions/code-block'
import type { ReactNodeViewProps } from 'prosekit/react'
import { Excalidraw } from '@excalidraw/excalidraw'
import { useEffect, useMemo, useRef, useState } from 'react'

import { MermaidDiagram } from '../../../MermaidDiagram'
import {
  DEFAULT_EXCALIDRAW_HEIGHT,
  clampExcalidrawHeight,
  parseExcalidrawSource,
  serializeExcalidrawScene,
  setExcalidrawSourceHeight,
} from '../../../../lib/excalidraw'

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
  const excalidrawHeightRef = useRef(DEFAULT_EXCALIDRAW_HEIGHT)
  const hasExcalidrawInteractionRef = useRef(false)
  const resizeStartYRef = useRef(0)
  const resizeStartHeightRef = useRef(DEFAULT_EXCALIDRAW_HEIGHT)
  const [excalidrawHeight, setExcalidrawHeight] = useState(DEFAULT_EXCALIDRAW_HEIGHT)
  const [isResizingExcalidraw, setIsResizingExcalidraw] = useState(false)
  const showMermaidSection = language === 'mermaid'
  const showMermaidPreview = language === 'mermaid' && code.trim() !== ''
  const showExcalidrawPreview = language === 'excalidraw'
  const showDiagramSection = showMermaidSection || showExcalidrawPreview

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
    if (excalidrawSource === null || excalidrawSource.status === 'error') {
      return
    }

    excalidrawHeightRef.current = excalidrawSource.height
    if (isResizingExcalidraw === false) {
      setExcalidrawHeight(excalidrawSource.height)
    }
  }, [excalidrawSource, isResizingExcalidraw])

  useEffect(() => {
    if (showExcalidrawPreview === false || excalidrawSource === null || excalidrawSource.status === 'error') {
      return
    }
    if (excalidrawAPIRef.current === null) {
      return
    }

    excalidrawAPIRef.current.updateScene(excalidrawSource.initialData)
  }, [excalidrawSource, showExcalidrawPreview])

  useEffect(() => {
    if (isResizingExcalidraw === false || typeof window === 'undefined') {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      event.preventDefault()

      const nextHeight = clampExcalidrawHeight(resizeStartHeightRef.current + event.clientY - resizeStartYRef.current)
      excalidrawHeightRef.current = nextHeight
      setExcalidrawHeight(nextHeight)
    }

    const handlePointerUp = (event: PointerEvent) => {
      event.preventDefault()
      setIsResizingExcalidraw(false)

      const nextSource = setExcalidrawSourceHeight(lastSerializedExcalidrawSourceRef.current, excalidrawHeightRef.current)
      if (nextSource === lastSerializedExcalidrawSourceRef.current) {
        return
      }

      lastSerializedExcalidrawSourceRef.current = nextSource
      replaceCodeBlockContent(nextSource)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [isResizingExcalidraw])

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

  const languageSelector = (
    <select
      aria-label="Code block language"
      className={showDiagramSection ? 'flow-diagram-block-select' : 'relative box-border w-auto cursor-pointer select-none appearance-none rounded-sm border border-white/12 bg-black/45 px-2 py-1 text-xs text-(--prosemirror-highlight) opacity-80 shadow-sm transition hover:bg-black/60 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-white/25 [div[data-node-view-root]:hover_&]:opacity-95'}
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
  )

  return (
    <>
      {showDiagramSection ? (
        <section className="flow-diagram-block" contentEditable={false}>
          <header className="flow-diagram-block-header">
            <div>
              <h3 className="flow-diagram-block-title">{showMermaidSection ? 'Mermaid diagram' : 'Excalidraw canvas'}</h3>
            </div>
            {languageSelector}
          </header>
          {showMermaidSection ? (
            <div className="flow-diagram-block-body">
              <div className="flow-diagram-block-source">
                <label className="flow-diagram-block-source-label">Diagram source</label>
                <textarea
                  aria-label="Mermaid diagram source"
                  className="flow-diagram-source"
                  onChange={(event) => replaceCodeBlockContent(event.target.value)}
                  spellCheck={false}
                  value={code}
                />
              </div>
              <div className="flow-diagram-block-preview">
                {showMermaidPreview ? (
                  <MermaidDiagram source={code} className="flow-mermaid-diagram-editor" />
                ) : (
                  <p className="flow-diagram-block-empty">Add Mermaid syntax to render a live preview.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="flow-diagram-block-body">
              <div className="flow-diagram-block-preview">
                <div className="px-4 pb-4" contentEditable={false}>
                  {excalidrawSource?.status === 'error' ? (
                    <div className="flow-excalidraw-diagram flow-excalidraw-diagram-editor flow-excalidraw-diagram-error">
                      <p className="flow-excalidraw-diagram-message">Unable to load Excalidraw diagram.</p>
                      <p className="flow-excalidraw-diagram-detail">{excalidrawSource.error}</p>
                    </div>
                  ) : (
                    <div
                      className="flow-excalidraw-diagram flow-excalidraw-diagram-editor flow-excalidraw-editor-shell group"
                      onFocusCapture={() => {
                        hasExcalidrawInteractionRef.current = true
                      }}
                      onPointerDownCapture={() => {
                        hasExcalidrawInteractionRef.current = true
                      }}
                      style={{ height: `${excalidrawHeight}px` }}
                    >
                      <Excalidraw
                        excalidrawAPI={(api) => {
                          excalidrawAPIRef.current = api
                        }}
                        initialData={excalidrawSource?.initialData}
                        onChange={(elements, appState, files) => {
                          if (hasExcalidrawInteractionRef.current === false) {
                            return
                          }

                          const nextSource = serializeExcalidrawScene(elements, appState, files, {
                            height: excalidrawHeightRef.current,
                          })
                          if (nextSource === lastSerializedExcalidrawSourceRef.current) {
                            return
                          }

                          lastSerializedExcalidrawSourceRef.current = nextSource
                          replaceCodeBlockContent(nextSource)
                        }}
                      />
                      <button
                        aria-label="Resize Excalidraw diagram"
                        className="flow-excalidraw-resize-handle"
                        onPointerDown={(event) => {
                          event.preventDefault()
                          resizeStartYRef.current = event.clientY
                          resizeStartHeightRef.current = excalidrawHeightRef.current
                          setIsResizingExcalidraw(true)
                        }}
                        type="button"
                      >
                        <span className="i-lucide-grip-horizontal size-4 block" aria-hidden="true"></span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      ) : (
        <div className="relative mx-2 top-3 h-0 select-none overflow-visible text-xs" contentEditable={false}>
          {languageSelector}
        </div>
      )}
      <pre ref={props.contentRef} data-language={language} hidden={showDiagramSection}></pre>
    </>
  )
}
