/** Resolve the displayed project from pending navigation or the native main-session binding. */
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { DesktopWorkspace, DesktopWorkspaceState } from './types.ts'

type SessionListPhaseSource = {
  getSnapshot: () => { phase: 'pending' | 'ready' }
  subscribe: (listener: () => void) => () => void
}

/**
 * Keep the target project's files and sessions isolated while its connection is pending.
 * @param workspaces - Workspace catalog snapshot.
 * @param currentSessionId - Native renderer's selected Session identity.
 * @param target - Pending project navigation, when present.
 * @param confirmed - Last native-confirmed project, retained when its current Session is closed.
 * @returns the displayed Workspace, or absence without a matching selection.
 */
export function activeWorkspace(
  workspaces: DesktopWorkspaceState,
  currentSessionId: string | undefined,
  target: WorkspaceId | null,
  confirmed: WorkspaceId | null,
): DesktopWorkspace | undefined {
  if (target !== null) return workspaces.items.find(workspace => workspace.workspaceId === target)
  if (currentSessionId !== undefined) {
    const current = workspaces.items.find(workspace => workspace.sessionIds.some(id => id === currentSessionId))
    if (current !== undefined) return current
  }
  return workspaces.items.find(workspace => workspace.workspaceId === confirmed)
}

/**
 * Resolve the Workspace that owns one session from the authoritative
 * membership projection.
 *
 * Session selection can briefly report an ungrouped or stale id while the
 * native adapter hands off between sessions. Navigation must therefore use
 * the clicked row's id, rather than deriving its owner from the currently
 * selected session; otherwise a row in the default Workspace becomes a
 * no-op and appears to disappear.
 * @param workspaces - Workspace catalog snapshot.
 * @param sessionId - Session id from a rendered sidebar row.
 * @returns the owning Workspace, when the session is accounted there.
 */
export function workspaceForSession(
  workspaces: DesktopWorkspaceState,
  sessionId: string,
): DesktopWorkspace | undefined {
  return workspaces.items.find(workspace => workspace.sessionIds.some(id => id === sessionId))
}

/**
 * Wait for the first complete session baseline before resolving a Workspace.
 * A Workspace list can become ready before session.list; treating that gap as
 * an empty Workspace would create a new blank session and hide its history.
 * @param source - session list observable.
 * @param signal - aborts the wait when a newer navigation supersedes it.
 * @returns false when navigation was superseded before the baseline arrived.
 */
export function waitForSessionListReady(
  source: SessionListPhaseSource,
  signal: AbortSignal,
): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false)
  if (source.getSnapshot().phase === 'ready') return Promise.resolve(true)
  return new Promise<boolean>((resolve) => {
    let settled = false
    let unsubscribe = () => {}
    const finish = (value: boolean) => {
      if (settled) return
      settled = true
      unsubscribe()
      signal.removeEventListener('abort', onAbort)
      resolve(value)
    }
    const onAbort = () => { finish(false) }
    signal.addEventListener('abort', onAbort, { once: true })
    unsubscribe = source.subscribe(() => {
      if (source.getSnapshot().phase === 'ready') finish(true)
    })
    // A synchronous store update can land between the initial check and the
    // subscription; check once more after subscribing to avoid a stuck wait.
    if (source.getSnapshot().phase === 'ready') finish(true)
  })
}
