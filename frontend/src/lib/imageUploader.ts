import type { Uploader } from 'prosekit/extensions/file'

const CHUNK_SIZE = 0x8000 // 32 KB — stays under the call stack limit

/**
 * Converts an ArrayBuffer to a base64 string. Uses chunked String.fromCharCode
 * to avoid exceeding the call stack limit on large files. This avoids
 * TextDecoder('latin1') which is not supported in all webview environments
 * (e.g., the Wails desktop app on Linux with WebKitGTK).
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const uint8Array = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < uint8Array.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...uint8Array.subarray(i, i + CHUNK_SIZE))
  }
  return btoa(binary)
}

/**
 * Access the Wails `window.go.desktop.App` object. Returns null when the
 * frontend is not running inside a Wails v2 webview.
 */
function getWailsApp(): Record<string, unknown> | null {
  if (typeof window === 'undefined') return null
  const go = (window as Record<string, unknown>).go as Record<string, unknown> | undefined
  const app = go?.desktop?.App as Record<string, unknown> | undefined
  return app ?? null
}

/**
 * Access the Wails Go binding for the App.UploadFile method. Returns null when
 * the frontend is not running inside a Wails v2 webview.
 */
export function getWailsUpload(): ((fileName: string, content: string, documentPath: string) => Promise<string>) | null {
  const app = getWailsApp()
  const upload = app?.UploadFile as ((fileName: string, content: string, documentPath: string) => Promise<string>) | undefined
  return upload ?? null
}

/**
 * Access the Wails Go binding for the App.UploadFileFromLocalPath method.
 * Returns null when the frontend is not running inside a Wails v2 webview.
 * This method reads a file directly from disk (by file:// URI) instead of
 * accepting pre-read content. It is used for drag-and-drop on Linux where
 * WebKitGTK delivers file URIs via text/uri-list instead of populating
 * dataTransfer.files.
 */
export function getWailsUploadFromPath(): ((localURI: string, documentPath: string) => Promise<string>) | null {
  const app = getWailsApp()
  const upload = app?.UploadFileFromLocalPath as ((localURI: string, documentPath: string) => Promise<string>) | undefined
  return upload ?? null
}

export interface WailsGraphFileNoteResponse {
  id: string
  type: string
  graph: string
  title: string
  path: string
  fileName: string
}

/**
 * Access the Wails Go binding for the App.CreateGraphFileNoteFromPath method.
 * Returns null when the frontend is not running inside a Wails v2 webview.
 * This method reads a file from a local file:// URI, saves it to the graph
 * directory, and creates a note document with the file embedded.
 */
export function getWailsCreateGraphFileNote(): ((localURI: string, graphPath: string) => Promise<WailsGraphFileNoteResponse>) | null {
  const app = getWailsApp()
  const create = app?.CreateGraphFileNoteFromPath as ((localURI: string, graphPath: string) => Promise<WailsGraphFileNoteResponse>) | undefined
  return create ?? null
}

/**
 * Uploads a file via the Wails Go-JS binding. This bypasses the HTTP layer and
 * calls the Go Backend.UploadFile method directly, which is necessary because
 * Wails v2's asset server does not properly handle multipart form data POST
 * requests.
 */
function uploadViaWailsBinding(
  file: File,
  documentPath: string | undefined,
  onProgress: (progress: { loaded: number; total: number }) => void,
  wailsUpload: (fileName: string, content: string, documentPath: string) => Promise<string>,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.addEventListener('loadend', async () => {
      if (!reader.result || typeof reader.result !== 'object') {
        reject(new Error('Failed to read file'))
        return
      }

      try {
        const arrayBuffer = reader.result as ArrayBuffer
        // Convert to a base64 string because Go's json.Unmarshal expects
        // []byte to be encoded as a base64 JSON string, not a JSON array
        // of numbers. Passing number[] causes a JSON type error on the Go
        // side that silently rejects the Wails binding call.
        const base64 = arrayBufferToBase64(arrayBuffer)
        const url = await wailsUpload(file.name, base64, documentPath ?? '')
        onProgress({ loaded: file.size, total: file.size })
        resolve(url)
      } catch (error) {
        reject(new Error('Wails upload failed', { cause: error }))
      }
    })

    reader.addEventListener('error', () => {
      reject(new Error('Failed to read file'))
    })

    reader.readAsArrayBuffer(file)
  })
}

/**
 * Uploads a file via XHR POST with multipart form data. This is the standard
 * browser-based upload path used when the app is opened in a browser.
 */
function uploadViaXHR(
  file: File,
  documentPath: string | undefined,
  onProgress: (progress: { loaded: number; total: number }) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const formData = new FormData()
    formData.append('file', file)

    const uploadURL = documentPath
      ? `/api/files?documentPath=${encodeURIComponent(documentPath)}`
      : '/api/files'

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        onProgress({
          loaded: event.loaded,
          total: event.total,
        })
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status === 201) {
        try {
          const json = JSON.parse(xhr.responseText) as { url: string }
          resolve(json.url)
        } catch (error) {
          reject(new Error('Failed to parse response', { cause: error }))
        }
      } else {
        let message = `Upload failed with status ${xhr.status}`
        try {
          const json = JSON.parse(xhr.responseText) as { error?: string }
          if (json.error) {
            message = json.error
          }
        } catch {
          // Ignore non-JSON error bodies.
        }
        reject(new Error(message))
      }
    })

    xhr.addEventListener('error', () => {
      reject(new Error('Upload failed'))
    })

    xhr.open('POST', uploadURL, true)
    xhr.send(formData)
  })
}

/**
 * Creates an uploader that posts files to the Flow backend and returns the URL
 * of the uploaded file.
 *
 * In Wails desktop mode, the upload goes through the Go-JS binding (bypassing
 * the HTTP layer which does not support multipart form data through the Wails
 * asset server). In browser mode, a standard XHR POST with FormData is used.
 *
 * When `documentPath` is provided the file is stored alongside the note's
 * Markdown file so images stay co-located with the document that references
 * them. Without it the file lands in data/uploads/ for backward compatibility.
 */
export function createFlowImageUploader(
  getDocumentPath: () => string | undefined,
): Uploader<string> {
  return ({ file, onProgress }): Promise<string> => {
    const documentPath = getDocumentPath()
    const wailsUpload = getWailsUpload()

    if (wailsUpload) {
      return uploadViaWailsBinding(file, documentPath, onProgress, wailsUpload)
    }

    return uploadViaXHR(file, documentPath, onProgress)
  }
}
