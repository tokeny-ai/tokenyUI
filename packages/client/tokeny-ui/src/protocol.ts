/** JSON payloads for the plugin-owned workspace explorer channel. */
import { z } from 'zod'

/** Both operations address a registered workspace and a root-relative path. */
export const fileRequest = z.object({ workspaceId: z.string().min(1).max(256), path: z.string().max(4096) }).strict()

/** Directory responses include an explicit limit indicator. Links are displayed but never followed. */
export const directoryResponse = z.object({
  entries: z.array(
    z.object({ name: z.string(), path: z.string(), kind: z.enum(['directory', 'file', 'link', 'other']) }),
  ),
  truncated: z.boolean(),
})

/** Preview content is UTF-8 text only; binary and oversized files report a status without content. */
export const previewResponse = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('text'), content: z.string(), bytes: z.number() }),
  z.object({ kind: z.literal('binary'), bytes: z.number() }),
  z.object({ kind: z.literal('too-large'), bytes: z.number() }),
])

/** One directory level, in folders-first order. */
export type DirectoryResult = z.infer<typeof directoryResponse>
/** Read-only file preview result. */
export type PreviewResult = z.infer<typeof previewResponse>
