/** tokenyUI host: workspace-scoped, read-only explorer RPC. */
import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-client-connection'
import { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import { fileRequest } from './protocol.ts'
import { listFiles, readPreview, type FileLimits } from './files.ts'

/** Plugin identity shown in the Harness plugin inventory. */
export const name = 'tokenyUI'
/** Services needed to authorize and route workspace reads. */
export const inject = ['connection', 'workspaceRegistry']
/** File explorer deployment limits. */
export type Config = FileLimits
/** Validated bounds for directory responses and preview allocation. */
export const Config: Schema<Config> = Schema.object({
  maxEntries: Schema.number()
    .min(1)
    .max(20000)
    .step(1)
    .default(2000)
    .description('Maximum entries displayed per directory.'),
  maxPreviewBytes: Schema.number()
    .min(1024)
    .max(4194304)
    .step(1)
    .default(262144)
    .description('Maximum UTF-8 preview size in bytes.'),
})

/**
 * Register the explorer channel for trusted Harness browser clients.
 * @param ctx - Plugin context with Connection and Workspace registry.
 * @param config - Validated file limits.
 */
export function apply(ctx: Context, config: Config): void {
  ctx.connection.rpc.handle(
    '/tokeny-ui',
    async (endpoint, payload, signal) => {
      try {
        const input = fileRequest.parse(payload)
        const workspace = ctx.workspaceRegistry.get(WorkspaceId(input.workspaceId))
        if (workspace === undefined) throw new Error('The workspace no longer exists.')
        if (endpoint === 'list') return { ok: true, value: await listFiles(workspace.path, input.path, config, signal) }
        if (endpoint === 'read')
          return { ok: true, value: await readPreview(workspace.path, input.path, config, signal) }
        throw new Error('Unknown tokenyUI file operation.')
      } catch (error) {
        return {
          ok: false,
          error: { code: 'internal', message: error instanceof Error ? error.message : String(error), details: {} },
        }
      }
    },
    { authority: 'trusted-host' },
  )
}
