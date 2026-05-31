/** Image file extensions that are treated as images even when the browser
 *  does not report a MIME type (common on Linux with WebKitGTK when dragging
 *  from a file manager). */
export const IMAGE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico', '.tiff', '.tif',
])

/** Returns true when the file name has a recognised image extension. */
export function hasImageExtension(name: string): boolean {
  const lower = name.toLowerCase()
  const lastDot = lower.lastIndexOf('.')
  if (lastDot === -1) return false
  return IMAGE_EXTENSIONS.has(lower.slice(lastDot))
}
