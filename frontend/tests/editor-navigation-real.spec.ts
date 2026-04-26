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
  id: string
  file: string
  graph: string
  title: string
  description: string
  body: string
}): Promise<string> {
  const output = await runFlow(binaryPath, workspacePath, [
    'create',
    'note',
    '--file', options.file,
    '--id', options.id,
    '--graph', options.graph,
    '--title', options.title,
    '--description', options.description,
    '--body', options.body,
  ])

  const createdPathMatch = output.match(/Created\s+note\s+document\s+at\s+(.+)$/m)
  if (createdPathMatch?.[1] === undefined) {
    throw new Error(`Unable to parse created document path from output:\n${output}`)
  }

  return resolveWorkspaceDocumentPath(workspacePath, createdPathMatch[1].trim())
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

      const overviewFilePath = await createNote(binaryPath, workspacePath, {
        id: 'note-1',
        file: 'overview',
        graph: 'execution',
        title: 'Overview',
        description: 'Execution overview',
        body: 'Overview body\n',
      })

      await createNote(binaryPath, workspacePath, {
        id: 'note-2',
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
      await expect(page.locator('.graph-canvas-overlay-node[data-nodeid="note-1"]')).toBeVisible()

      await page.locator('.graph-canvas-overlay-node[data-nodeid="note-1"]').click()
      await page.getByRole('button', { name: 'Document', exact: true }).click()
      await expect(page.getByLabel('Graph node document panel')).toBeVisible()
      await expect(page.locator(documentBodySelector)).toBeVisible()

      await insertBlankParagraph(page)

      await page.locator('.graph-canvas-overlay-node[data-nodeid="note-2"]').click()
      await page.getByRole('button', { name: 'Document', exact: true }).click()
      await expect(page.getByRole('textbox', { name: 'Document title' })).toHaveValue('Follow Up')

      await expect.poll(async () => readFile(overviewFilePath, 'utf8')).toContain('<p><br></p>')

      await page.locator('.graph-canvas-overlay-node[data-nodeid="note-1"]').click()
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