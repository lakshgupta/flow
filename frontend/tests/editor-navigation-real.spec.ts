import { execFile, spawn } from 'node:child_process'
import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

import { expect, test } from '@playwright/test'

const currentFilePath = fileURLToPath(import.meta.url)
const testsRoot = path.dirname(currentFilePath)
const frontendRoot = path.resolve(testsRoot, '..')
const repoRoot = path.resolve(frontendRoot, '..')
const flowBinaryPath = path.join(os.tmpdir(), 'flow-playwright-e2e-bin')
const documentBodySelector = '.ProseMirror[aria-label="Context document editor"]'

let flowBinaryPromise: Promise<string> | null = null

type StartedProcess = {
  child: ReturnType<typeof spawn>
  stop: () => Promise<void>
  output: () => string
}

type CreatedNote = {
  id: string
  path: string
}

function runCommand(command: string, args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { cwd }, (error, stdout, stderr) => {
      if (error !== null) {
        reject(new Error(`${command} ${args.join(' ')} failed\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`))
        return
      }

      resolve(stdout)
    })
  })
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

async function ensureFlowBinary(): Promise<string> {
  if (flowBinaryPromise !== null) {
    return flowBinaryPromise
  }

  flowBinaryPromise = (async () => {
    await runCommand('npm', ['run', 'build'], frontendRoot)
    await runCommand('go', ['build', '-o', flowBinaryPath, './cmd/flow'], repoRoot)
    return flowBinaryPath
  })()

  return flowBinaryPromise
}

async function getFreePort(): Promise<number> {
  const net = await import('node:net')

  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (address === null || typeof address === 'string') {
        server.close(() => reject(new Error('Unable to allocate a loopback port')))
        return
      }

      const { port } = address
      server.close((error) => {
        if (error !== undefined) {
          reject(error)
          return
        }

        resolve(port)
      })
    })
  })
}

async function runFlow(binaryPath: string, workspacePath: string, args: string[]): Promise<string> {
  return runCommand(binaryPath, args, workspacePath)
}

async function resolveWorkspaceDocumentPath(workspacePath: string, relativeOrAbsolutePath: string): Promise<string> {
  const candidates = [
    relativeOrAbsolutePath,
    path.join(workspacePath, relativeOrAbsolutePath),
    path.join(workspacePath, '.flow', relativeOrAbsolutePath),
  ]

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate
    }
  }

  return path.join(workspacePath, '.flow', relativeOrAbsolutePath)
}

async function createNote(binaryPath: string, workspacePath: string, options: {
  file: string
  graph: string
  title: string
  description: string
  body: string
}): Promise<CreatedNote> {
  const output = await runFlow(binaryPath, workspacePath, [
    'create',
    'note',
    '--file', options.file,
    '--graph', options.graph,
    '--title', options.title,
    '--description', options.description,
    '--body', options.body,
  ])

  const createdPathMatch = output.match(/Created\s+note\s+document\s+at\s+(.+)$/m)
  if (createdPathMatch?.[1] === undefined) {
    throw new Error(`Unable to parse created document path from output:\n${output}`)
  }

  const graphPrefix = options.graph.replace(/\/+$/, '')
  const documentID = `${graphPrefix}/${options.file}`

  return {
    id: documentID,
    path: await resolveWorkspaceDocumentPath(workspacePath, createdPathMatch[1].trim()),
  }
}

function startProcess(binaryPath: string, workspacePath: string): StartedProcess {
  const child = spawn(binaryPath, ['gui', '--serve-internal'], {
    cwd: workspacePath,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let stdout = ''
  let stderr = ''
  let exitResolve: (() => void) | null = null
  const exited = new Promise<void>((resolve) => {
    exitResolve = resolve
  })

  child.stdout?.on('data', (chunk: Buffer | string) => {
    stdout += chunk.toString()
  })
  child.stderr?.on('data', (chunk: Buffer | string) => {
    stderr += chunk.toString()
  })
  child.once('exit', () => {
    exitResolve?.()
  })

  return {
    child,
    output: () => `STDOUT:\n${stdout}\nSTDERR:\n${stderr}`,
    stop: async () => {
      if (child.exitCode !== null) {
        await exited
        return
      }

      child.kill('SIGTERM')
      await Promise.race([exited, delay(5_000)])

      if (child.exitCode === null) {
        child.kill('SIGKILL')
        await exited
      }
    },
  }
}

async function waitForServer(url: string, server: StartedProcess): Promise<void> {
  const deadline = Date.now() + 30_000

  while (Date.now() < deadline) {
    if (server.child.exitCode !== null) {
      throw new Error(`GUI server exited before startup.\n${server.output()}`)
    }

    try {
      const response = await fetch(`${url}/api/workspace`)
      if (response.ok) {
        return
      }
    } catch {
      // Keep polling until the server starts or times out.
    }

    await delay(250)
  }

  throw new Error(`Timed out waiting for ${url}.\n${server.output()}`)
}

async function insertBlankParagraph(page: Parameters<typeof test>[0] extends never ? never : any): Promise<void> {
  const html = await page.locator(documentBodySelector).evaluate((element) => {
    if (!(element instanceof HTMLElement)) {
      throw new Error('Missing document body editor')
    }

    element.focus()

    const selection = window.getSelection()
    if (selection === null) {
      throw new Error('Missing editor selection')
    }

    const range = document.createRange()
    range.selectNodeContents(element)
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)

    if (!document.execCommand('insertParagraph')) {
      throw new Error('insertParagraph command failed')
    }

    return element.innerHTML
  })

  expect(html).toContain('<p><br')
}

test.describe('Graph editor navigation with real backend', () => {
  test.describe.configure({ mode: 'serial' })

  test('keeps horizontal canvas layout active instead of auto-resetting', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Layout persistence regression is validated in Chromium')
    test.setTimeout(180_000)

    const binaryPath = await ensureFlowBinary()
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), 'flow-playwright-workspace-'))
    const port = await getFreePort()
    const url = `http://127.0.0.1:${port}`

    let server: StartedProcess | null = null

    try {
      await runFlow(binaryPath, workspacePath, ['init'])
      await runFlow(binaryPath, workspacePath, ['configure', '--gui-port', String(port)])

      const layoutNote1 = await createNote(binaryPath, workspacePath, {
        file: 'layout-note-1',
        graph: 'graph1',
        title: 'Layout Note 1',
        description: 'Layout test note 1',
        body: 'Alpha\n',
      })
      const layoutNote2 = await createNote(binaryPath, workspacePath, {
        file: 'layout-note-2',
        graph: 'graph1',
        title: 'Layout Note 2',
        description: 'Layout test note 2',
        body: 'Beta\n',
      })
      const layoutNote3 = await createNote(binaryPath, workspacePath, {
        file: 'layout-note-3',
        graph: 'graph1',
        title: 'Layout Note 3',
        description: 'Layout test note 3',
        body: 'Gamma\n',
      })

      server = startProcess(binaryPath, workspacePath)
      await waitForServer(url, server)

      await page.setViewportSize({ width: 1600, height: 1000 })
      await page.goto(url)

      await page.getByText(/graph1/i).first().click()
      await expect(page.locator(`.graph-canvas-overlay-node[data-nodeid="${layoutNote1.id}"]`)).toBeVisible()
      await expect(page.locator(`.graph-canvas-overlay-node[data-nodeid="${layoutNote2.id}"]`)).toBeVisible()
      await expect(page.locator(`.graph-canvas-overlay-node[data-nodeid="${layoutNote3.id}"]`)).toBeVisible()

      await page.getByRole('button', { name: 'Switch to horizontal layout' }).click()
      const activeHorizontalButton = page.getByRole('button', { name: 'Switch to user-adjusted layout' })
      await expect(activeHorizontalButton).toHaveAttribute('aria-pressed', 'true')

      // Trigger a canvas data refresh path while horizontal mode is active.
      const firstDescription = page
        .locator(`.graph-canvas-overlay-node[data-nodeid="${layoutNote1.id}"] .graph-canvas-node-description-input`)
      await firstDescription.fill('layout refresh probe')
      await firstDescription.blur()
      await expect(activeHorizontalButton).toHaveAttribute('aria-pressed', 'true')

      await page.waitForTimeout(5_000)
      await expect(activeHorizontalButton).toHaveAttribute('aria-pressed', 'true')
    } finally {
      if (server !== null) {
        await server.stop()
      }

      await rm(workspacePath, { recursive: true, force: true })
    }
  })

  test('supports ctrl/cmd multi-select merge and preserves graph links', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Merge interaction regression is validated in Chromium')
    test.setTimeout(180_000)

    const binaryPath = await ensureFlowBinary()
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), 'flow-playwright-workspace-'))
    const port = await getFreePort()
    const url = `http://127.0.0.1:${port}`

    let server: StartedProcess | null = null

    try {
      await runFlow(binaryPath, workspacePath, ['init'])
      await runFlow(binaryPath, workspacePath, ['configure', '--gui-port', String(port)])

      const mergeTarget = await createNote(binaryPath, workspacePath, {
        file: 'merge-target',
        graph: 'graph1',
        title: 'Merge Target',
        description: 'Target note',
        body: 'Target body\n',
      })
      const mergeIncoming = await createNote(binaryPath, workspacePath, {
        file: 'merge-incoming',
        graph: 'graph1',
        title: 'Merge Incoming',
        description: 'Incoming note',
        body: 'Incoming body\n',
      })
      const mergeOther = await createNote(binaryPath, workspacePath, {
        file: 'merge-other',
        graph: 'graph1',
        title: 'Merge Other',
        description: 'Secondary merge note',
        body: 'Other body\n',
      })
      const mergeOutsideA = await createNote(binaryPath, workspacePath, {
        file: 'merge-outside-a',
        graph: 'graph1',
        title: 'Outside A',
        description: 'Outside target A',
        body: 'Outside A\n',
      })
      const mergeOutsideB = await createNote(binaryPath, workspacePath, {
        file: 'merge-outside-b',
        graph: 'graph1',
        title: 'Outside B',
        description: 'Outside target B',
        body: 'Outside B\n',
      })

      server = startProcess(binaryPath, workspacePath)
      await waitForServer(url, server)

      const linkSeedPayloads = [
        { fromId: mergeTarget.id, toId: mergeOutsideA.id, context: 'target edge' },
        { fromId: mergeOther.id, toId: mergeOutsideB.id, context: 'other edge' },
        { fromId: mergeIncoming.id, toId: mergeOther.id, context: 'incoming edge' },
      ]
      for (const payload of linkSeedPayloads) {
        const response = await fetch(`${url}/api/links`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        expect(response.ok).toBeTruthy()
      }

      await page.setViewportSize({ width: 1600, height: 1000 })
      await page.goto(url)

      await page.getByText(/graph1/i).first().click()
      await expect(page.locator(`.graph-canvas-overlay-node[data-nodeid="${mergeTarget.id}"]`)).toBeVisible()
      await expect(page.locator(`.graph-canvas-overlay-node[data-nodeid="${mergeOther.id}"]`)).toBeVisible()

      const modifierKey = process.platform === 'darwin' ? 'Meta' : 'Control'
      await page.keyboard.down(modifierKey)
      await page.locator(`.graph-canvas-overlay-node[data-nodeid="${mergeTarget.id}"]`).click()
      await page.locator(`.graph-canvas-overlay-node[data-nodeid="${mergeOther.id}"]`).click()
      await page.keyboard.up(modifierKey)

      await expect(
        page.locator(`.graph-canvas-overlay-node[data-nodeid="${mergeTarget.id}"] .canvas-selection-badge`),
      ).toHaveText('1')
      await expect(
        page.locator(`.graph-canvas-overlay-node[data-nodeid="${mergeOther.id}"] .canvas-selection-badge`),
      ).toHaveText('2')
      await expect(page.getByRole('button', { name: 'Merge', exact: true })).toBeVisible()

      const mergeResponsePromise = page.waitForResponse((response) => {
        return response.url().endsWith('/api/documents/merge') && response.request().method() === 'POST'
      })
      await page.getByRole('button', { name: 'Merge', exact: true }).click()
      const mergeResponse = await mergeResponsePromise
      expect(mergeResponse.ok()).toBeTruthy()

      await expect.poll(async () => pathExists(mergeOther.path), { timeout: 15_000 }).toBe(false)
      await expect.poll(async () => readFile(mergeTarget.path, 'utf8'), { timeout: 15_000 }).toContain(`node: ${mergeOutsideA.id}`)
      await expect.poll(async () => readFile(mergeTarget.path, 'utf8'), { timeout: 15_000 }).toContain(`node: ${mergeOutsideB.id}`)
      await expect.poll(async () => readFile(mergeIncoming.path, 'utf8'), { timeout: 15_000 }).toContain(`node: ${mergeTarget.id}`)
      await expect.poll(async () => readFile(mergeIncoming.path, 'utf8'), { timeout: 15_000 }).not.toContain(`node: ${mergeOther.id}`)
    } finally {
      if (server !== null) {
        await server.stop()
      }

      await rm(workspacePath, { recursive: true, force: true })
    }
  })

  test('persists a blank paragraph when switching graph canvas nodes', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Real backend newline regression is stabilized in Chromium')
    test.setTimeout(180_000)

    const binaryPath = await ensureFlowBinary()
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), 'flow-playwright-workspace-'))
    const port = await getFreePort()
    const url = `http://127.0.0.1:${port}`

    let server: StartedProcess | null = null

    try {
      await runFlow(binaryPath, workspacePath, ['init'])
      await runFlow(binaryPath, workspacePath, ['configure', '--gui-port', String(port)])

      const overviewNote = await createNote(binaryPath, workspacePath, {
        file: 'overview',
        graph: 'execution',
        title: 'Overview',
        description: 'Execution overview',
        body: 'Overview body\n',
      })

      const followUpNote = await createNote(binaryPath, workspacePath, {
        file: 'follow-up',
        graph: 'execution',
        title: 'Follow Up',
        description: 'Execution follow-up',
        body: 'Follow up body\n',
      })

      server = startProcess(binaryPath, workspacePath)
      await waitForServer(url, server)

      await page.setViewportSize({ width: 1600, height: 1000 })
      await page.goto(url)

      await page.getByText('Execution').click()
      await expect(page.locator(`.graph-canvas-overlay-node[data-nodeid="${overviewNote.id}"]`)).toBeVisible()
      await expect(page.locator(`.graph-canvas-overlay-node[data-nodeid="${followUpNote.id}"]`)).toBeVisible()

      await page.locator(`.graph-canvas-overlay-node[data-nodeid="${overviewNote.id}"]`).click()
      await page.getByRole('button', { name: 'Document', exact: true }).click()
      await expect(page.getByLabel('Graph node document panel')).toBeVisible()
      await expect(page.locator(documentBodySelector)).toBeVisible()

      await insertBlankParagraph(page)

      await page.locator(`.graph-canvas-overlay-node[data-nodeid="${followUpNote.id}"]`).click()
      await page.getByRole('button', { name: 'Document', exact: true }).click()
      await expect(page.getByRole('textbox', { name: 'Document title' })).toHaveValue('Follow Up')

      await expect.poll(async () => readFile(overviewNote.path, 'utf8')).toContain('<p><br></p>')

      await page.locator(`.graph-canvas-overlay-node[data-nodeid="${overviewNote.id}"]`).click()
      await page.getByRole('button', { name: 'Document', exact: true }).click()
      await expect(page.getByRole('textbox', { name: 'Document title' })).toHaveValue('Overview')
      await expect.poll(async () => page.locator(documentBodySelector).evaluate((element) => element.innerHTML)).toContain('<p><br')
    } finally {
      if (server !== null) {
        await server.stop()
      }

      await rm(workspacePath, { recursive: true, force: true })
    }
  })
})