// @vitest-environment jsdom
/** Workspace navigation keeps the confirmed project visible across transient selection gaps. */
import { expect, it } from 'vitest'
import { activeWorkspace, waitForSessionListReady, workspaceForSession } from '../src/desktop/workspace.ts'
import type { DesktopWorkspaceState } from '../src/desktop/types.ts'

function state(sessionIds: Record<string, string[]>): DesktopWorkspaceState {
  return {
    items: Object.entries(sessionIds).map(([workspaceId, ids]) => ({
      workspaceId,
      path: `/${workspaceId}`,
      title: workspaceId,
      sessionIds: ids,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })),
    archivedSessionIds: [],
    state: 'idle',
    phase: 'ready',
  } as unknown as DesktopWorkspaceState
}

it('falls back to the confirmed workspace when the current session is temporarily ungrouped', () => {
  const workspaces = state({ first: ['s-first'], second: ['s-second'] })
  const selected = activeWorkspace(workspaces, 's-unaccounted', 'first' as never, 'second' as never)
  expect(selected?.workspaceId).toBe('first')

  const confirmed = activeWorkspace(workspaces, 's-unaccounted', null, 'second' as never)
  expect(confirmed?.workspaceId).toBe('second')
})

it('resolves a clicked session from its owning workspace during selection hand-off', () => {
  const workspaces = state({ 'default-workspace': ['s-default'], other: ['s-other'] })
  // The native current binding can still point at an ungrouped session while
  // the user clicks a row. The clicked id remains authoritative.
  expect(workspaceForSession(workspaces, 's-default')?.workspaceId).toBe('default-workspace')
  expect(workspaceForSession(workspaces, 's-missing')).toBeUndefined()
})

it('waits for the session baseline before allowing workspace navigation to resolve', async () => {
  let phase: 'pending' | 'ready' = 'pending'
  const listeners = new Set<() => void>()
  const source = {
    getSnapshot: () => ({ phase }),
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  const controller = new AbortController()
  const ready = waitForSessionListReady(source, controller.signal)
  let settled = false
  void ready.then(() => { settled = true })
  await Promise.resolve()
  expect(settled).toBe(false)

  phase = 'ready'
  for (const listener of listeners) listener()
  await expect(ready).resolves.toBe(true)
})

it('cancels a pending session baseline wait when navigation is superseded', async () => {
  const controller = new AbortController()
  const source = {
    getSnapshot: () => ({ phase: 'pending' as const }),
    subscribe: () => () => {},
  }
  const pending = waitForSessionListReady(source, controller.signal)
  controller.abort()
  await expect(pending).resolves.toBe(false)
})
