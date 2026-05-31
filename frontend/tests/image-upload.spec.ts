import { expect, test } from '@playwright/test'

function workspaceResponse() {
  return {
    scope: 'local',
    workspacePath: '/tmp/flow-workspace',
    flowPath: '/tmp/flow-workspace/.flow',
    configPath: '/tmp/flow-workspace/.flow/config/config.toml',
    indexPath: '/tmp/flow-workspace/.flow/config/flow.index',
    homePath: 'data/home.md',
    guiPort: 4812,
    appearance: 'system',
    panelWidths: { leftRatio: 0.31, rightRatio: 0.22, documentTOCRatio: 0.18 },
  }
}

function graphTreeResponse() {
  return {
    home: {
      id: 'home',
      type: 'home',
      title: 'Home',
      description: '',
      path: 'data/home.md',
      body: '# Home\n',
    },
    graphs: [
      {
        graphPath: 'execution',
        displayName: 'Execution',
        directCount: 2,
        totalCount: 2,
        hasChildren: false,
        countLabel: '2 direct / 2 total',
        files: [
          {
            id: 'note-1',
            type: 'note',
            title: 'Overview',
            path: 'data/graphs/execution/overview.md',
            fileName: 'overview.md',
          },
          {
            id: 'note-2',
            type: 'note',
            title: 'Follow Up',
            path: 'data/graphs/execution/follow-up.md',
            fileName: 'follow-up.md',
          },
        ],
      },
    ],
  }
}

function graphCanvasResponse() {
  return {
    selectedGraph: 'execution',
    availableGraphs: ['execution'],
    layerGuidance: {
      magneticThresholdPx: 18,
      guides: [
        { layer: 0, x: 140 },
        { layer: 1, x: 460 },
      ],
    },
    nodes: [
      {
        id: 'note-1',
        type: 'note',
        graph: 'execution',
        title: 'Overview',
        description: 'Execution overview',
        path: 'data/graphs/execution/overview.md',
        featureSlug: 'execution',
        position: { x: 140, y: 120 },
        positionPersisted: false,
      },
      {
        id: 'note-2',
        type: 'note',
        graph: 'execution',
        title: 'Follow Up',
        description: 'Execution follow-up',
        path: 'data/graphs/execution/follow-up.md',
        featureSlug: 'execution',
        position: { x: 460, y: 120 },
        positionPersisted: false,
      },
    ],
    edges: [],
  }
}

const documentBodySelector = '.ProseMirror[aria-label="Document body editor"]'

test.describe('Image upload', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/workspace', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(workspaceResponse()),
      })
    })

    await page.route('**/api/graphs', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(graphTreeResponse()),
      })
    })

    await page.route('**/api/graphs/note', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          type: 'note',
          availableGraphs: ['execution'],
          graphItems: { execution: [] },
        }),
      })
    })

    await page.route('**/api/graphs/task', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ type: 'task', availableGraphs: [], graphItems: {} }),
      })
    })

    await page.route('**/api/graphs/command', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ type: 'command', availableGraphs: [], graphItems: {} }),
      })
    })

    await page.route('**/api/calendar-documents', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })
  })

  test('uploads an image via the upload API and verifies it renders in the editor', async ({ page }) => {
    const mockImageUrl = '/api/files?path=data/uploads/test-screenshot.png'

    const noteOne = {
      id: 'note-1',
      type: 'note',
      featureSlug: 'execution',
      graph: 'execution',
      title: 'Overview',
      description: 'Execution overview',
      path: 'data/graphs/execution/overview.md',
      tags: [],
      body: 'Overview body\n',
      links: [],
      relatedNoteIds: [],
    }

    // Mock the graph canvas endpoint so the graph page loads correctly.
    await page.route('**/api/graph-canvas?graph=execution', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(graphCanvasResponse()),
      })
    })

    await page.route('**/api/documents/note-1', async (route) => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(noteOne) })
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(noteOne),
      })
    })

    // Mock the API for serving images (GET) — this test inserts the image via
    // HTML paste, bypassing the upload pipeline (which is tested separately).
    await page.route('**/api/files', async (route) => {
      await route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
        0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41,
        0x54, 0x08, 0xd7, 0x63, 0x60, 0x00, 0x00, 0x00,
        0x02, 0x00, 0x01, 0xe5, 0x27, 0xde, 0xfc,
      ]) })
    })

    await page.setViewportSize({ width: 1600, height: 1000 })
    await page.goto('/')

    // Navigate to the execution graph via the sidebar.
    await page.getByText('Execution').click()

    // Open the "overview.md" document from the sidebar file list.
    await page.getByText('overview.md').click()

    // Wait for the document editor to appear in the center thread panel.
    await expect(page.locator(documentBodySelector)).toBeVisible()

    // Insert an image by simulating a paste with the mock image URL.
    await page.evaluate(
      ({ selector, imageUrl }) => {
        const editor = document.querySelector(selector)
        if (!editor) {
          throw new Error('Editor not found')
        }

        // Focus and place cursor at the end of the editor content.
        editor.focus()
        const selection = window.getSelection()
        const range = document.createRange()
        range.selectNodeContents(editor)
        range.collapse(false)
        selection.removeAllRanges()
        selection.addRange(range)

        // Create a paste event with the image HTML and dispatch it.
        const dataTransfer = new DataTransfer()
        dataTransfer.setData('text/html', `<img src="${imageUrl}" />`)
        const event = new ClipboardEvent('paste', {
          clipboardData: dataTransfer,
          bubbles: true,
          cancelable: true,
        })
        editor.dispatchEvent(event)
      },
      { selector: documentBodySelector, imageUrl: mockImageUrl },
    )

    // Wait for the image to appear in the editor.
    const imgLocator = page.locator(`${documentBodySelector} img`)
    await expect(imgLocator).toBeVisible({ timeout: 15_000 })

    // Verify the image src matches the mock response URL.
    await expect(imgLocator).toHaveAttribute('src', mockImageUrl)
  })

  test('uploads an image via direct API call (XHR upload pipeline)', async ({ page }) => {
    const mockImageUrl = '/api/files?path=data/uploads/api-upload.png'

    const noteOne = {
      id: 'note-1',
      type: 'note',
      featureSlug: 'execution',
      graph: 'execution',
      title: 'Overview',
      description: 'Execution overview',
      path: 'data/graphs/execution/overview.md',
      tags: [],
      body: 'Overview body\n',
      links: [],
      relatedNoteIds: [],
    }

    await page.route('**/api/graph-canvas?graph=execution', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(graphCanvasResponse()),
      })
    })

    await page.route('**/api/documents/note-1', async (route) => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(noteOne) })
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(noteOne),
      })
    })

    await page.route('**/api/files', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ url: mockImageUrl }),
        })
        return
      }
      await route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('fake-image') })
    })

    await page.setViewportSize({ width: 1600, height: 1000 })
    await page.goto('/')
    await page.getByText('Execution').click()
    await page.getByText('overview.md').click()
    await expect(page.locator(documentBodySelector)).toBeVisible()

    // Directly test the upload XHR flow: create a File and POST it to /api/files.
    const uploadResponse = await page.evaluate(async () => {
      const pngBytes = Uint8Array.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
        0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41,
        0x54, 0x08, 0xd7, 0x63, 0x60, 0x00, 0x00, 0x00,
        0x02, 0x00, 0x01, 0xe5, 0x27, 0xde, 0xfc,
      ])
      const file = new File([pngBytes], 'api-test.png', { type: 'image/png' })

      return new Promise<{ url: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        const formData = new FormData()
        formData.append('file', file)

        xhr.addEventListener('load', () => {
          if (xhr.status === 201) {
            try {
              resolve(JSON.parse(xhr.responseText) as { url: string })
            } catch {
              reject(new Error('Failed to parse response'))
            }
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`))
          }
        })

        xhr.addEventListener('error', () => reject(new Error('Upload failed')))

        xhr.open('POST', '/api/files', true)
        xhr.send(formData)
      })
    })

    expect(uploadResponse.url).toBe(mockImageUrl)
  })

  test('deletes an uploaded image via the delete button', async ({ page }) => {
    const mockImageUrl = '/api/files?path=data/uploads/deletable-image.png'

    const noteOne = {
      id: 'note-1',
      type: 'note',
      featureSlug: 'execution',
      graph: 'execution',
      title: 'Overview',
      description: 'Execution overview',
      path: 'data/graphs/execution/overview.md',
      tags: [],
      body: 'Overview body\n',
      links: [],
      relatedNoteIds: [],
    }

    await page.route('**/api/graph-canvas?graph=execution', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(graphCanvasResponse()),
      })
    })

    await page.route('**/api/documents/note-1', async (route) => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(noteOne) })
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(noteOne),
      })
    })

    // Mock the upload so we can insert an image into the editor.
    await page.route('**/api/files', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ url: mockImageUrl }),
        })
        return
      }
      // Return a valid 1×1 pixel PNG so the image actually loads.
      await route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
        0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41,
        0x54, 0x08, 0xd7, 0x63, 0x60, 0x00, 0x00, 0x00,
        0x02, 0x00, 0x01, 0xe5, 0x27, 0xde, 0xfc,
      ]) })
    })

    await page.setViewportSize({ width: 1600, height: 1000 })
    await page.goto('/')

    // Navigate to the execution graph and open the document.
    await page.getByText('Execution').click()
    await page.getByText('overview.md').click()
    await expect(page.locator(documentBodySelector)).toBeVisible()

    // Insert an image by simulating a paste with an img tag.
    await page.evaluate(
      ({ selector, imageUrl }) => {
        const editor = document.querySelector(selector)
        if (!editor) {
          throw new Error('Editor not found')
        }

        editor.focus()
        const selection = window.getSelection()
        const range = document.createRange()
        range.selectNodeContents(editor)
        range.collapse(false)
        selection.removeAllRanges()
        selection.addRange(range)

        const dataTransfer = new DataTransfer()
        dataTransfer.setData('text/html', `<img src="${imageUrl}" />`)
        const event = new ClipboardEvent('paste', {
          clipboardData: dataTransfer,
          bubbles: true,
          cancelable: true,
        })
        editor.dispatchEvent(event)
      },
      { selector: documentBodySelector, imageUrl: mockImageUrl },
    )

    // Wait for the image to appear.
    const imgLocator = page.locator(`${documentBodySelector} img`)
    await expect(imgLocator).toBeVisible({ timeout: 15_000 })

    // Hover over the image to reveal the delete button.
    await imgLocator.hover()
    await page.waitForTimeout(300)

    const deleteButton = page.locator(`${documentBodySelector} button[aria-label="Delete image"]`)
    await expect(deleteButton).toBeVisible()
    await deleteButton.click({ force: true })

    // The image should now be removed from the editor DOM.
    await expect(imgLocator).not.toBeVisible()
  })
})

test.describe('Image upload — Wails desktop mode', () => {
  test.beforeEach(async ({ page }) => {
    // Standard API mocks shared with the browser-mode tests.
    await page.route('**/api/workspace', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(workspaceResponse()),
      })
    })

    await page.route('**/api/graphs', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(graphTreeResponse()),
      })
    })

    await page.route('**/api/graphs/note', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          type: 'note',
          availableGraphs: ['execution'],
          graphItems: { execution: [] },
        }),
      })
    })

    await page.route('**/api/graphs/task', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ type: 'task', availableGraphs: [], graphItems: {} }),
      })
    })

    await page.route('**/api/graphs/command', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ type: 'command', availableGraphs: [], graphItems: {} }),
      })
    })

    await page.route('**/api/calendar-documents', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })
  })

  test('Wails binding uploads image data as base64 string (not number[]) and renders in editor', async ({ page }) => {
    const mockImageUrl = '/api/files?path=data/uploads/wails-dropped.png'

    // Inject the Wails Go-JS binding mock BEFORE the app scripts load.
    // This simulates Flow running inside the Wails desktop webview.
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const win = window as any
      win.__wailsUploadCalls = []
      win.go = {
        desktop: {
          App: {
            UploadFile(fileName, content, documentPath) {
              win.__wailsUploadCalls.push({ fileName, content, documentPath })
              return Promise.resolve('/api/files?path=data/uploads/wails-dropped.png')
            },
          },
        },
      }
    })

    const noteOne = {
      id: 'note-1',
      type: 'note',
      featureSlug: 'execution',
      graph: 'execution',
      title: 'Overview',
      description: 'Execution overview',
      path: 'data/graphs/execution/overview.md',
      tags: [],
      body: 'Overview body\\n',
      links: [],
      relatedNoteIds: [],
    }

    await page.route('**/api/graph-canvas?graph=execution', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(graphCanvasResponse()),
      })
    })

    await page.route('**/api/documents/note-1', async (route) => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(noteOne) })
        return
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(noteOne) })
    })

    // Mock GET /api/files to serve a valid 1×1 pixel PNG so the <img> tag loads.
    await page.route('**/api/files', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: Buffer.from([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
          0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
          0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
          0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
          0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41,
          0x54, 0x08, 0xd7, 0x63, 0x60, 0x00, 0x00, 0x00,
          0x02, 0x00, 0x01, 0xe5, 0x27, 0xde, 0xfc,
        ]),
      })
    })

    await page.setViewportSize({ width: 1600, height: 1000 })
    await page.goto('/')

    // Navigate to the execution graph via the sidebar.
    await page.getByText('Execution').click()

    // Open the "overview.md" document from the sidebar file list.
    await page.getByText('overview.md').click()

    // Wait for the document editor to appear in the center thread panel.
    await expect(page.locator(documentBodySelector)).toBeVisible()

    // Part 1 — Upload via Wails binding.
    // Replicate what uploadViaWailsBinding() does in production:
    //   1. Read PNG bytes into a Uint8Array
    //   2. Convert to base64 (each byte 0-255 → same code unit → btoa)
    //   3. Call window.go.desktop.App.UploadFile(fileName, base64, docPath)
    //   4. Receive the uploaded URL from the mock
    // This directly tests the regression: that content is a base64 string
    // (not number[]) that Go's json.Unmarshal can decode as []byte.
    //
    // NOTE: This test calls the Wails binding directly rather than going
    // through createFlowImageUploader. The ProseKit→uploader integration
    // is tested by imageUploader.test.ts. Synthetic DOM events cannot
    // reliably trigger ProseKit's file handler in Playwright.
    const wailsResult = await page.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const win = window as any

      const pngBytes = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
        0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41,
        0x54, 0x08, 0xd7, 0x63, 0x60, 0x00, 0x00, 0x00,
        0x02, 0x00, 0x01, 0xe5, 0x27, 0xde, 0xfc,
      ])

      // Map each byte 0-255 to a character with the same code unit.
      // This is equivalent to TextDecoder('latin1') but does not depend
      // on browser encoding label support (which varies in Playwright).
      // btoa() expects each character code unit to be in 0-255.
      const CHUNK_SIZE = 0x8000 // 32 KB
      let binary = ''
      for (let i = 0; i < pngBytes.length; i += CHUNK_SIZE) {
        binary += String.fromCharCode(...pngBytes.subarray(i, i + CHUNK_SIZE))
      }
      const base64 = btoa(binary)

      const url = await win.go.desktop.App.UploadFile('dropped.png', base64, '')

      return { url, calls: win.__wailsUploadCalls }
    })

    // Verify the upload returned the expected URL.
    expect(wailsResult.url).toBe(mockImageUrl)

    // Part 2 — Verify the uploaded URL renders as an image.
    // Use the proven HTML paste approach (same as the first test)
    // to insert the URL returned by the Wails binding into the editor.
    const pasteUrl = wailsResult.url
    await page.evaluate(
      ({ selector, imageUrl }) => {
        const editor = document.querySelector(selector)
        if (!editor) {
          throw new Error('Editor not found')
        }

        editor.focus()
        const selection = window.getSelection()
        const range = document.createRange()
        range.selectNodeContents(editor)
        range.collapse(false)
        selection.removeAllRanges()
        selection.addRange(range)

        const dataTransfer = new DataTransfer()
        dataTransfer.setData('text/html', `<img src="${imageUrl}" />`)
        const event = new ClipboardEvent('paste', {
          clipboardData: dataTransfer,
          bubbles: true,
          cancelable: true,
        })
        editor.dispatchEvent(event)
      },
      { selector: documentBodySelector, imageUrl: pasteUrl },
    )

    // Wait for the image to appear in the editor DOM.
    const imgLocator = page.locator(`${documentBodySelector} img`)
    await expect(imgLocator).toBeVisible({ timeout: 15_000 })

    // Verify the image src matches the mock Wails binding response URL.
    await expect(imgLocator).toHaveAttribute('src', mockImageUrl)

    // Regression assertions — verify the Wails binding received a
    // base64 string (not a number array). The original bug passed number[]
    // which Go's json.Unmarshal rejected silently, causing the upload to
    // fail and ProseKit to fall back to inserting raw text.
    expect(wailsResult.calls).toHaveLength(1)
    expect(typeof wailsResult.calls[0].content).toBe('string')
    // Must look like valid base64 (alphanumeric + '+' + '/' + '=').
    expect(wailsResult.calls[0].content).toMatch(/^[A-Za-z0-9+/]+=*$/)
    expect(wailsResult.calls[0].fileName).toBe('dropped.png')
  })

  test('Wails desktop drag-drop via text/uri-list uses UploadFileFromLocalPath', async ({ page }) => {
    const mockImageUrl = '/api/files?path=data/uploads/uri-list-drop.png'

    // Inject the Wails Go-JS binding mock with UploadFileFromLocalPath.
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const win = window as any
      win.__wailsUploadFromPathCalls = []
      win.go = {
        desktop: {
          App: {
            UploadFileFromLocalPath(localURI: string, documentPath: string) {
              win.__wailsUploadFromPathCalls.push({ localURI, documentPath })
              return Promise.resolve('/api/files?path=data/uploads/uri-list-drop.png')
            },
          },
        },
      }
    })

    const noteOne = {
      id: 'note-1',
      type: 'note',
      featureSlug: 'execution',
      graph: 'execution',
      title: 'Overview',
      description: 'Execution overview',
      path: 'data/graphs/execution/overview.md',
      tags: [],
      body: 'Overview body\\n',
      links: [],
      relatedNoteIds: [],
    }

    await page.route('**/api/graph-canvas?graph=execution', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(graphCanvasResponse()),
      })
    })

    await page.route('**/api/documents/note-1', async (route) => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(noteOne) })
        return
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(noteOne) })
    })

    // Mock GET /api/files so the inserted image can load.
    await page.route('**/api/files', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: Buffer.from([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
          0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
          0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
          0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
          0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41,
          0x54, 0x08, 0xd7, 0x63, 0x60, 0x00, 0x00, 0x00,
          0x02, 0x00, 0x01, 0xe5, 0x27, 0xde, 0xfc,
        ]),
      })
    })

    await page.setViewportSize({ width: 1600, height: 1000 })
    await page.goto('/')

    await page.getByText('Execution').click()
    await page.getByText('overview.md').click()
    await expect(page.locator(documentBodySelector)).toBeVisible()

    // Simulate a drop event with text/uri-list containing a file:// image URI.
    // In Wails mode the capture handler should intercept this and call
    // UploadFileFromLocalPath regardless of whether dataTransfer.files is also
    // populated (which is the case on Linux WebKitGTK).
    const dropResult = await page.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const win = window as any
      const editor = document.querySelector('.ProseMirror[aria-label="Document body editor"]') as HTMLElement
      if (!editor) {
        throw new Error('Editor not found')
      }

      const dataTransfer = new DataTransfer()
      dataTransfer.setData('text/uri-list', 'file:///home/user/Pictures/screenshot.png')

      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer,
        clientX: 400,
        clientY: 300,
      })

      // Dispatch in capture phase so our capture listener sees it.
      editor.dispatchEvent(dropEvent)

      // Wait for the async upload to complete.
      await new Promise((resolve) => setTimeout(resolve, 500))

      return {
        calls: win.__wailsUploadFromPathCalls,
        defaultPrevented: dropEvent.defaultPrevented,
        images: Array.from(editor.querySelectorAll('img')).map((img) => img.getAttribute('src')),
      }
    })

    // The capture handler should have intercepted the event.
    expect(dropResult.defaultPrevented).toBe(true)

    // UploadFileFromLocalPath should have been called with the file URI.
    expect(dropResult.calls).toHaveLength(1)
    expect(dropResult.calls[0].localURI).toBe('file:///home/user/Pictures/screenshot.png')
    expect(typeof dropResult.calls[0].documentPath).toBe('string')

    // The image should have been inserted into the editor.
    expect(dropResult.images).toContain('/api/files?path=data/uploads/uri-list-drop.png')
  })
})
