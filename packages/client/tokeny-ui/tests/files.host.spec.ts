/** Filesystem tests use isolated roots and exercise real files and junctions. */
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { listFiles, readPreview } from '../src/files.ts'

describe('tokenyUI workspace explorer', () => {
  let root: string
  const limits = { maxEntries: 10, maxPreviewBytes: 1024 }
  const signal = () => new AbortController().signal
  beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'tokeny-ui-files-')) })
  afterEach(async () => { await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }) })

  it('lists real folders first and reads nested UTF-8 files', async () => {
    await mkdir(join(root, 'src'))
    await writeFile(join(root, 'README.md'), '# Tokeny')
    await writeFile(join(root, 'src', 'hello.ts'), '你好，Tokeny\n')
    expect(await listFiles(root, '', limits, signal())).toEqual({ entries: [
      { name: 'src', path: 'src', kind: 'directory' },
      { name: 'README.md', path: 'README.md', kind: 'file' },
    ], truncated: false })
    expect(await readPreview(root, 'src/hello.ts', limits, signal())).toMatchObject({ kind: 'text', content: '你好，Tokeny\n' })
  })

  it('rejects traversal, absolute paths, Windows streams and unknown files', async () => {
    for (const path of ['../outside', '/etc/passwd', 'C:/Windows/win.ini', '\\\\server\\share', 'file:stream', 'src/../outside']) {
      await expect(readPreview(root, path, limits, signal())).rejects.toThrow()
    }
    await expect(readPreview(root, 'missing.txt', limits, signal())).rejects.toThrow()
    await expect(readPreview(root, '', limits, signal())).rejects.toThrow('Only regular files')
  })

  it('does not follow directory links, including links to other registered paths', async () => {
    const target = join(root, 'target')
    await mkdir(target)
    await writeFile(join(target, 'private.txt'), 'must not be read through a link')
    await symlink(target, join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir')
    expect((await listFiles(root, '', limits, signal())).entries.find(e => e.name === 'linked')?.kind).toBe('link')
    await expect(listFiles(root, 'linked', limits, signal())).rejects.toThrow('Symbolic links')
    await expect(readPreview(root, 'linked/private.txt', limits, signal())).rejects.toThrow('Symbolic links')
  })

  it('reports limits and binary data without exposing partial content', async () => {
    await writeFile(join(root, 'large.txt'), 'x'.repeat(1025))
    await writeFile(join(root, 'binary.dat'), new Uint8Array([0, 1, 2]))
    await writeFile(join(root, 'legacy.txt'), new Uint8Array([0xff, 0xfe]))
    expect(await readPreview(root, 'large.txt', limits, signal())).toEqual({ kind: 'too-large', bytes: 1025 })
    expect(await readPreview(root, 'binary.dat', limits, signal())).toEqual({ kind: 'binary', bytes: 3 })
    expect(await readPreview(root, 'legacy.txt', limits, signal())).toEqual({ kind: 'binary', bytes: 2 })
    const listing = await listFiles(root, '', { ...limits, maxEntries: 1 }, signal())
    expect(listing.entries).toHaveLength(1)
    expect(listing.truncated).toBe(true)
  })

  it('honors cancellation before returning directory or file content', async () => {
    await writeFile(join(root, 'hello.txt'), 'hello')
    const cancelled = AbortSignal.abort(new Error('cancelled'))
    await expect(listFiles(root, '', limits, cancelled)).rejects.toThrow('cancelled')
    await expect(readPreview(root, 'hello.txt', limits, cancelled)).rejects.toThrow('cancelled')
  })
})
