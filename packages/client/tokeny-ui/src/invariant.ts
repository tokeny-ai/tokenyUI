/** Package-owned invariant companion for tokenyUI. */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

/** Cordis companion identity. */
export const name = 'tokeny-ui-invariant'
/** Service owning companion registrations. */
export const inject = ['invariants']

// No runtime invariant: read-only RPC and browser viewing preferences own no event-stream relationship.
const install: InvariantInstaller = () => {}

/**
 * Reserve the package's invariant ownership.
 * @param ctx - Context carrying the invariant registry.
 * @returns registration disposer.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register('@tokeny-ai/dsh-client-tokeny-ui', install))
