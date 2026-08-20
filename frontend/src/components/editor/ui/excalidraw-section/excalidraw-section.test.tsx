import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { RichTextEditor } from '../../RichTextEditor'

type SceneChangeHandler = (elements: unknown[], appState: unknown, files: unknown) => void

type MountedInitialData = { elements?: unknown[]; appState?: Record<string, unknown> }

const sceneChangeHandlers = vi.hoisted(() => [] as SceneChangeHandler[])
const mountedInitialData = vi.hoisted(() => [] as MountedInitialData[])

vi.mock('@excalidraw/excalidraw', () => ({
  Excalidraw: ({ initialData, onChange }: { initialData?: MountedInitialData; onChange?: SceneChangeHandler }) => {
    mountedInitialData.push(initialData ?? {})
    if (onChange) {
      sceneChangeHandlers.push(onChange)
    }
    return <div data-testid="excalidraw-canvas">canvas</div>
  },
  serializeAsJSON: (elements: unknown[], appState: unknown, files: unknown) =>
    JSON.stringify({ type: 'excalidraw', version: 2, elements, appState, files }),
}))

vi.mock('@excalidraw/excalidraw/index.css', () => ({}))

vi.mock('@/components/ui/calendar', () => ({
  Calendar: () => null,
}))

vi.mock('react-day-picker', () => ({
  DayPicker: () => null,
}))

vi.mock('react-day-picker/style.css', () => ({}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => children,
  DialogContent: ({ children }: { children: React.ReactNode }) => children,
  DialogTitle: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('./ui/block-handle', () => ({
  BlockHandle: () => null,
}))

vi.mock('./ui/drop-indicator', () => ({
  DropIndicator: () => null,
}))

vi.mock('./ui/inline-menu', () => ({
  InlineMenu: () => null,
}))

vi.mock('./ui/reference-menu/reference-menu', () => ({
  default: () => null,
}))

vi.mock('./ui/slash-menu', () => ({
  SlashMenu: () => null,
}))

const SCENE_JSON = JSON.stringify({
  type: 'excalidraw',
  version: 2,
  source: 'https://excalidraw.com',
  flowTitle: 'My Drawing',
  elements: [{ type: 'rectangle', id: 'r1' }],
  appState: { zoom: { value: 1 } },
  files: {},
})

function renderEditor(value: string) {
  return render(
    <RichTextEditor
      ariaLabel="Document body editor"
      onChange={vi.fn()}
      value={value}
    />,
  )
}

async function waitForSection() {
  const editor = screen.getByLabelText('Document body editor')
  await waitFor(() => {
    expect(editor.querySelector('[data-diagram-language="excalidraw"]')).not.toBeNull()
  })
  return editor
}

describe('excalidraw diagram section', () => {
  it('renders the canvas with the persisted scene and extracts the title', async () => {
    renderEditor(`\`\`\`excalidraw\n${SCENE_JSON}\n\`\`\``)
    await waitForSection()

    expect(mountedInitialData.at(-1)?.elements).toEqual([{ type: 'rectangle', id: 'r1' }])
    const title = screen.getByLabelText('Excalidraw Drawing title') as HTMLInputElement
    expect(title.value).toBe('My Drawing')
  })

  it('renders an empty canvas when the scene JSON is corrupt', async () => {
    renderEditor('```excalidraw\nnot json\n```')
    await waitForSection()

    expect(mountedInitialData.at(-1)?.elements).toEqual([])
    const title = screen.getByLabelText('Excalidraw Drawing title') as HTMLInputElement
    expect(title.value).toBe('')
  })

  it('strips runtime-only appState fields (e.g. collaborators) from old scenes', async () => {
    // Older saves persisted the runtime `collaborators` Map as a plain object,
    // which crashes Excalidraw on restore (`collaborators.forEach is not a
    // function`). The sanitizer must drop it so the default (an empty Map) is used.
    const oldScene = JSON.stringify({
      type: 'excalidraw',
      version: 2,
      flowTitle: 'Legacy',
      elements: [{ type: 'rectangle', id: 'r1' }],
      appState: {
        collaborators: {},
        width: 1048,
        height: 478,
        offsetTop: 389,
        offsetLeft: 306,
        viewBackgroundColor: '#ffffff',
        zoom: { value: 1 },
      },
      files: {},
    })
    renderEditor(`\`\`\`excalidraw\n${oldScene}\n\`\`\``)
    const editor = await waitForSection()

    const mounted = mountedInitialData.at(-1) as MountedInitialData
    expect(editor.querySelector('[data-diagram-language="excalidraw"]')).not.toBeNull()
    // The canvas still receives the scene elements.
    expect(mounted.elements).toEqual([{ type: 'rectangle', id: 'r1' }])
    // Runtime-only fields are gone from the restored appState.
    expect(mounted.appState).not.toHaveProperty('collaborators')
    expect(mounted.appState).not.toHaveProperty('width')
    expect(mounted.appState).not.toHaveProperty('offsetTop')
    expect(mounted.appState).toHaveProperty('viewBackgroundColor', '#ffffff')
  })

  it('persists scene changes back into the code block text (debounced)', async () => {
    renderEditor(`\`\`\`excalidraw\n${SCENE_JSON}\n\`\`\``)
    const editor = await waitForSection()

    const onChange = sceneChangeHandlers.at(-1)
    expect(onChange).toBeDefined()
    onChange?.([{ type: 'rectangle', id: 'r2', x: 5 }], { zoom: { value: 2 } }, {})

    await waitFor(() => {
      const pre = editor.querySelector('pre[data-language="excalidraw"]')
      const text = pre?.textContent ?? ''
      expect(text).toContain('"flowTitle":"My Drawing"')
      expect(text).toContain('"id":"r2"')
    }, { timeout: 2000 })
  })

  it('deletes the section when the trash button is clicked', async () => {
    const user = userEvent.setup()
    renderEditor(`\`\`\`excalidraw\n${SCENE_JSON}\n\`\`\``)
    const editor = await waitForSection()

    await user.click(screen.getByRole('button', { name: 'Delete excalidraw drawing' }))

    await waitFor(() => {
      expect(editor.querySelector('[data-diagram-language="excalidraw"]')).toBeNull()
    })
  })

  it('updates the stored title when the title input is committed', async () => {
    const user = userEvent.setup()
    renderEditor(`\`\`\`excalidraw\n${SCENE_JSON}\n\`\`\``)
    const editor = await waitForSection()

    const title = screen.getByLabelText('Excalidraw Drawing title') as HTMLInputElement
    await user.clear(title)
    await user.type(title, 'Renamed{Enter}')

    await waitFor(() => {
      const pre = editor.querySelector('pre[data-language="excalidraw"]')
      expect(pre?.textContent ?? '').toContain('"flowTitle":"Renamed"')
    })
  })
})
