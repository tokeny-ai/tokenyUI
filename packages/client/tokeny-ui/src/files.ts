/** Bounded, read-only access beneath a registered local workspace. */
import { constants } from 'node:fs'
import { lstat, open, opendir, realpath } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve, sep, win32 } from 'node:path'
import type { DirectoryResult, PreviewResult } from './protocol.ts'

/** Deployment limits for one explorer request. */
export interface FileLimits {
  /** Maximum entries returned for one directory. */
  maxEntries: number
  /** Largest text file previewed in bytes. */
  maxPreviewBytes: number
}

async function resolveFile(root: string, path: string): Promise<string> {
  if (isAbsolute(path) || win32.isAbsolute(path) || path.includes('\0') || path.includes('\\') || path.includes(':')) {
    throw new Error('The file path must be relative to its workspace.')
  }
  const parts = path === '' ? [] : path.split('/')
  if (parts.some(part => part === '..' || part === '.' || part === '')) throw new Error('Invalid workspace file path.')
  const base = await realpath(root)
  let target = base
  for (const part of parts) {
    target = join(target, part)
    if ((await lstat(target)).isSymbolicLink()) throw new Error('Symbolic links are not opened by the file explorer.')
  }
  const canonical = await realpath(target)
  const child = relative(base, canonical)
  if (child === '..' || child.startsWith(`..${sep}`) || isAbsolute(child))
    throw new Error('The file is outside its workspace.')
  return resolve(canonical)
}

/**
 * List one directory without traversing links or reading file content.
 * @param root - Registered workspace root.
 * @param path - Relative directory path, or an empty string for the root.
 * @param limits - Deployment bounds.
 * @param signal - Request cancellation.
 * @returns a bounded, sorted directory listing.
 */
export async function listFiles(
  root: string,
  path: string,
  limits: FileLimits,
  signal: AbortSignal,
): Promise<DirectoryResult> {
  const directory = await opendir(await resolveFile(root, path))
  const entries: DirectoryResult['entries'] = []
  let truncated = false
  for await (const entry of directory) {
    signal.throwIfAborted()
    if (entries.length === limits.maxEntries) {
      truncated = true
      break
    }
    entries.push({
      name: entry.name,
      path: path === '' ? entry.name : `${path}/${entry.name}`,
      kind: entry.isSymbolicLink() ? 'link' : entry.isDirectory() ? 'directory' : entry.isFile() ? 'file' : 'other',
    })
  }
  entries.sort(
    (a, b) => Number(b.kind === 'directory') - Number(a.kind === 'directory') || a.name.localeCompare(b.name, 'en'),
  )
  return { entries, truncated }
}

/**
 * Preview a regular UTF-8 file; reject links and bound both allocation and reading.
 * @param root - Registered workspace root.
 * @param path - Relative file path.
 * @param limits - Deployment bounds.
 * @param signal - Request cancellation.
 * @returns text, binary status, or size-limit status.
 */
export async function readPreview(
  root: string,
  path: string,
  limits: FileLimits,
  signal: AbortSignal,
): Promise<PreviewResult> {
  const target = await resolveFile(root, path)
  const before = await lstat(target)
  if (!before.isFile()) throw new Error('Only regular files can be previewed.')
  const file = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
  try {
    const info = await file.stat()
    if (!info.isFile() || info.dev !== before.dev || info.ino !== before.ino)
      throw new Error('The file changed while opening it. Refresh and try again.')
    if (info.size > limits.maxPreviewBytes) return { kind: 'too-large', bytes: info.size }
    signal.throwIfAborted()
    const buffer = Buffer.alloc(limits.maxPreviewBytes + 1)
    let bytes = 0
    while (bytes < buffer.length) {
      signal.throwIfAborted()
      const read = await file.read(buffer, bytes, buffer.length - bytes, bytes)
      if (read.bytesRead === 0) break
      bytes += read.bytesRead
    }
    if (bytes > limits.maxPreviewBytes) return { kind: 'too-large', bytes }
    const data = buffer.subarray(0, bytes)
    if (data.includes(0)) return { kind: 'binary', bytes }
    let content: string
    try {
      content = new TextDecoder('utf-8', { fatal: true }).decode(data)
    } catch {
      return { kind: 'binary', bytes }
    } // Non-UTF-8 files have no text preview.
    return { kind: 'text', content, bytes }
  } finally {
    await file.close()
  }
}
