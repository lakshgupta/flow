import { IconTrash } from '@tabler/icons-react'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/types'
import type { ReactNodeViewProps } from 'prosekit/react'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'

const CANVAS_DEFAULT_HEIGHT = 480
const CANVAS_MIN_HEIGHT = 320
const CANVAS_MAX_HEIGHT = 4000

/**
 * Lazy-load the Excalidraw bundle (plus its stylesheet) so the editor's main
 * chunk does not grow by ~1 MB. The module promise is cached, so the
 * serializer and the component share a single loaded instance.
 */
type ExcalidrawModule = typeof import('@excalidraw/excalidraw')
let excalidrawModulePromise: Promise<ExcalidrawModule> | null = null
let excalidrawModule: ExcalidrawModule | null = null

function loadExcalidraw(): Promise<ExcalidrawModule> {
  if (excalidrawModulePromise === null) {
    excalidrawModulePromise = Promise.all([
      import('@excalidraw/excalidraw'),
      import('@excalidraw/excalidraw/index.css'),
    ]).then(([mod]) => {
      excalidrawModule = mod
      return mod
    })
  }
  return excalidrawModulePromise
}

const ExcalidrawCanvas = lazy(() => loadExcalidraw().then((mod) => ({ default: mod.Excalidraw })))

type SceneData = {
  elements: readonly ExcalidrawElement[]
  appState: Partial<AppState> | null
  files: BinaryFiles
}

/** Parse the persisted JSON envelope. Unknown/corrupt content yields an empty scene. */
function parseScene(text: string): { title: string; canvasHeight: number; scene: SceneData } {
  try {
    const data = JSON.parse(text) as Record<string, unknown>
    const persistedHeight = typeof data.flowCanvasHeight === 'number' && Number.isFinite(data.flowCanvasHeight)
      ? data.flowCanvasHeight
      : CANVAS_DEFAULT_HEIGHT
    return {
      title: typeof data.flowTitle === 'string' ? data.flowTitle : '',
      canvasHeight: Math.min(Math.max(persistedHeight, CANVAS_MIN_HEIGHT), CANVAS_MAX_HEIGHT),
      scene: {
        elements: Array.isArray(data.elements) ? data.elements as readonly ExcalidrawElement[] : [],
        appState: sanitizePersistedAppState(
          typeof data.appState === 'object' && data.appState !== null ? data.appState as Record<string, unknown> : null,
        ),
        files: typeof data.files === 'object' && data.files !== null ? data.files as BinaryFiles : {},
      },
    }
  } catch {
    return { title: '', canvasHeight: CANVAS_DEFAULT_HEIGHT, scene: { elements: [], appState: null, files: {} } }
  }
}

/**
 * Runtime-only appState fields that must never be re-imported. `collaborators`
 * is a Map that JSON.stringify flattens to `{}`; restoring it as a plain
 * object makes Excalidraw crash (`collaborators.forEach is not a function`).
 * Saves made with `serializeAsJSON` strip these, but older persisted scenes
 * may still contain them — drop them so restore falls back to the defaults.
 */
function sanitizePersistedAppState(appState: Record<string, unknown> | null): Partial<AppState> | null {
  if (appState === null) return null
  const next: Record<string, unknown> = { ...appState }
  delete next.collaborators
  delete next.width
  delete next.height
  delete next.offsetTop
  delete next.offsetLeft
  delete next.toast
  delete next.selectionElement
  delete next.editingFrame
  return next as Partial<AppState>
}

const SCENE_SAVE_DELAY_MS = 500

/**
 * NodeView that wraps a `codeBlock` with `language: "excalidraw"` as a
 * labeled, deletable section whose body is a live Excalidraw canvas.
 *
 * The scene is persisted as JSON in the code block text (the same markdown
 * fence round-trip mermaid diagrams use): `{"type":"excalidraw",...,"flowTitle":...,"flowCanvasHeight":...}`.
 *
 * - Header: static label + delete (trash) button.
 * - Body: the interactive Excalidraw canvas (lazy-loaded, non-editable to the
 *   ProseMirror layer, pointer events intercepted so the caret never jumps).
 *   A bottom drag handle stretches the canvas height for more drawing room;
 *   the height persists in the scene envelope.
 * - Changes are debounced and written back into the code block text.
 */
export default function ExcalidrawSection(props: ReactNodeViewProps) {
  const { node, contentRef, view, getPos } = props
  const text = node.textContent

  const [{ title, canvasHeight, scene }] = useState(() => parseScene(text))
  const sceneRef = useRef<SceneData>(scene)
  const titleRef = useRef<string>(title)
  const [draftTitle, setDraftTitle] = useState<string>(title)

  // Canvas height in px — user-stretchable via the bottom drag handle.
  const [height, setHeight] = useState<number>(canvasHeight)
  const heightRef = useRef<number>(canvasHeight)
  heightRef.current = height

  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  )

  // Follow the app's light/dark toggle so the canvas palette stays in sync.
  useEffect(() => {
    const root = document.documentElement
    const observer = new MutationObserver(() => {
      setTheme(root.classList.contains('dark') ? 'dark' : 'light')
    })
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  const initialData = useMemo(
    () => ({ elements: scene.elements, appState: scene.appState ?? undefined, files: scene.files }),
    // The canvas is the source of truth while mounted; never re-feed it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const saveTimerRef = useRef<number | null>(null)

  const writeScene = useCallback(() => {
    const pos = typeof getPos === 'function' ? getPos() : undefined
    if (pos === undefined) return
    // The node may have been removed by the time a queued save runs.
    try {
      const { elements, appState, files } = sceneRef.current
      // Use excalidraw's own serializer: it strips runtime-only appState
      // fields (collaborators, width, offsetTop, …) and element internals,
      // producing JSON that round-trips through `initialData`/restore.
      let envelope: Record<string, unknown>
      if (excalidrawModule) {
        envelope = JSON.parse(
          excalidrawModule.serializeAsJSON(elements, appState ?? {}, files, 'local'),
        ) as Record<string, unknown>
      } else {
        // Fallback (module not loaded yet): keep the minimal shape.
        envelope = { elements, appState, files }
      }
      envelope.flowTitle = titleRef.current
      envelope.flowCanvasHeight = Math.round(heightRef.current)
      const json = JSON.stringify(envelope)
      const tr = view.state.tr
      // Resolve the section from the *current* doc rather than the React node
      // prop, which can lag the live doc by a transaction — using a stale
      // nodeSize leaves the old JSON tail behind and corrupts the code block.
      const $pos = tr.doc.resolve(pos)
      const targetNode = $pos.nodeAfter
      if (!targetNode || targetNode.type.spec.code !== true) return
      if (json === targetNode.textContent) return
      const start = pos + 1
      const end = pos + targetNode.nodeSize - 1
      tr.insertText(json, start, end)
      view.dispatch(tr)
    } catch {
      // Node detached — nothing to persist into.
    }
  }, [getPos, view])

  const cancelPendingSave = useCallback(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
  }, [])

  const handleSceneChange = useCallback(
    (elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
      sceneRef.current = { elements, appState, files }
      cancelPendingSave()
      saveTimerRef.current = window.setTimeout(writeScene, SCENE_SAVE_DELAY_MS)
    },
    [cancelPendingSave, writeScene],
  )

  // Flush any pending scene write on unmount (e.g. deleting the section).
  useEffect(() => {
    return () => {
      cancelPendingSave()
      writeScene()
    }
  }, [cancelPendingSave, writeScene])

  const commitTitle = useCallback(
    (nextTitle: string) => {
      const trimmed = nextTitle.trim()
      titleRef.current = trimmed
      setDraftTitle(trimmed)
      // Cancel any pending debounced save first so the immediate write is the
      // only dispatch — two overlapping writes against stale doc state is what
      // corrupts the code block text.
      cancelPendingSave()
      writeScene()
    },
    [cancelPendingSave, writeScene],
  )

  const handleDelete = useCallback(() => {
    cancelPendingSave()
    writeScene()
    const pos = typeof getPos === 'function' ? getPos() : undefined
    if (pos === undefined) return
    const tr = view.state.tr
    // Resolve the section from the *current* doc rather than the React node
    // prop, which can lag the last transaction by a character.
    const $pos = tr.doc.resolve(pos)
    const targetNode = $pos.nodeAfter
    if (!targetNode || targetNode.type.spec.code !== true) return
    const start = pos
    const end = pos + targetNode.nodeSize
    if (tr.doc.content.size === targetNode.nodeSize) {
      // Deleting the only block would leave an invalid empty document;
      // keep a single empty paragraph instead.
      const paragraph = view.state.schema.nodes.paragraph?.createAndFill()
      if (paragraph) {
        tr.replaceWith(start, end, paragraph)
      } else {
        tr.delete(start, end)
      }
    } else {
      tr.delete(start, end)
    }
    view.dispatch(tr)
    view.focus()
  }, [cancelPendingSave, writeScene, getPos, view])

  // Drag the bottom handle to stretch/shrink the canvas vertically. The final
  // height is written into the scene envelope on pointer-up so it persists.
  const handleResizePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      event.stopPropagation()
      const startY = event.clientY
      const startHeight = heightRef.current

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const next = Math.min(
          Math.max(Math.round(startHeight + (moveEvent.clientY - startY)), CANVAS_MIN_HEIGHT),
          CANVAS_MAX_HEIGHT,
        )
        setHeight(next)
      }

      const handlePointerUp = () => {
        window.removeEventListener('pointermove', handlePointerMove)
        window.removeEventListener('pointerup', handlePointerUp)
        document.body.style.cursor = ''
        cancelPendingSave()
        writeScene()
      }

      document.body.style.cursor = 'ns-resize'
      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', handlePointerUp)
    },
    [cancelPendingSave, writeScene],
  )

  return (
    <div
      className="flow-diagram-block"
      data-diagram-language="excalidraw"
      data-diagram-section="true"
      data-flow-editor-interactive="true"
    >
      <div className="flow-diagram-block-header" contentEditable={false}>
        <div>
          <p className="flow-diagram-block-kicker">Excalidraw Drawing</p>
          <input
            aria-label="Excalidraw Drawing title"
            className="flow-diagram-block-title"
            onBlur={() => commitTitle(draftTitle)}
            onChange={(event) => setDraftTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commitTitle(draftTitle)
                ;(event.currentTarget as HTMLInputElement).blur()
              } else if (event.key === 'Escape') {
                setDraftTitle(titleRef.current)
                ;(event.currentTarget as HTMLInputElement).blur()
              }
            }}
            placeholder="Untitled Excalidraw drawing"
            type="text"
            value={draftTitle}
          />
        </div>
        <div className="flow-diagram-block-actions">
          <button
            aria-label="Delete excalidraw drawing"
            className="flow-diagram-block-action flow-diagram-block-action-destructive"
            onClick={handleDelete}
            type="button"
          >
            <IconTrash size={14} stroke={1.75} />
          </button>
        </div>
      </div>
      <div className="flow-diagram-block-body flow-diagram-block-body-canvas" contentEditable={false}>
        <div className="flow-excalidraw-canvas" data-flow-editor-interactive="true" style={{ height: `${height}px` }}>
          <Suspense fallback={<div className="flow-excalidraw-loading">Loading drawing…</div>}>
            <ExcalidrawCanvas
              initialData={initialData}
              onChange={handleSceneChange}
              theme={theme}
              viewModeEnabled={false}
            />
          </Suspense>
        </div>
        <div
          aria-label="Resize drawing canvas"
          className="flow-excalidraw-resize-handle"
          contentEditable={false}
          onPointerDown={handleResizePointerDown}
          role="separator"
          title="Drag to resize the drawing area"
        />
      </div>
      {/* ProseMirror binds the code block text (the JSON scene) to this hidden
          element; the user never edits it directly. */}
      <pre
        ref={contentRef}
        aria-hidden="true"
        className="hidden"
        data-language="excalidraw"
      />
    </div>
  )
}
