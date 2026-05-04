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

test.describe('Graph editor navigation repro', () => {
  test('preserves pending document edits when switching graph canvas nodes and coming back', async ({ page }) => {
    let noteOne = {
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
    const noteTwo = {
      id: 'note-2',
      type: 'note',
      featureSlug: 'execution',
      graph: 'execution',
      title: 'Follow Up',
      description: 'Execution follow-up',
      path: 'data/graphs/execution/follow-up.md',
      tags: [],
      body: 'Follow up body\n',
      links: [],
      relatedNoteIds: [],
    }

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

    await page.route('**/api/graph-canvas?graph=execution', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(graphCanvasResponse()),
      })
    })

    await page.route('**/api/documents/note-1', async (route) => {
      if (route.request().method() === 'PUT') {
        const payload = JSON.parse(route.request().postData() ?? '{}') as { title?: string }
        noteOne = {
          ...noteOne,
          title: payload.title ?? noteOne.title,
        }
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(noteOne),
      })
    })

    await page.route('**/api/documents/note-2', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(noteTwo),
      })
    })

    await page.setViewportSize({ width: 1600, height: 1000 })
    await page.goto('/')

    await page.getByText('Execution').click()
    await expect(page.locator('.graph-canvas-overlay-node[data-nodeid="note-1"]')).toBeVisible()

    await page.locator('.graph-canvas-overlay-node[data-nodeid="note-1"]').click()
    await page.getByRole('button', { name: 'Document', exact: true }).click()
    await expect(page.getByLabel('Document thread')).toBeVisible()

    await page.getByRole('textbox', { name: 'Document title' }).fill('Overview updated')

    await page.getByText('follow-up.md').click()
    await expect(page.getByRole('textbox', { name: 'Document title' })).toHaveValue('Follow Up')

    await expect.poll(() => noteOne.title).toBe('Overview updated')

    await page.getByText('overview.md').click()
    await expect(page.getByRole('textbox', { name: 'Document title' })).toHaveValue('Overview updated')
  })
})