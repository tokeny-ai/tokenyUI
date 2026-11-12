/** tokenyUI browser assembly: reversible shell, palette, and file explorer contributions. */
import type { ClientContext, WorkspaceId } from '@deepseek-ai/dsh-client-runtime/client'
import type { BoundActions } from '@deepseek-ai/dsh-client-ui-slots'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import type { FilesInjected, SessionsInjected, ShellInjected } from './contract.ts'
import { directoryResponse, previewResponse } from '../protocol.ts'
import { createShellStore } from './stores.ts'
import { Shell } from './Shell.tsx'
import { Sidebar } from './Sidebar.tsx'
import { FileExplorer } from './FileExplorer.tsx'
import { FilePreview } from './FilePreview.tsx'
import { en, zh } from './locales.ts'
import { createThemeProjection, tokenyTokens } from './theme.ts'

/** Services read by the shell's composition callbacks. */
export const inject = ['slots', 'sessions', 'workspaces', 'locale', 'theme', 'connection']

/**
 * Replace the profile's layout and sidebar through their existing slots.
 * @param ctx - Browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  const store = createShellStore()
  const connection = ctx.get('connection') as ConnectionHandle
  let panels: BoundActions<typeof store> | undefined
  let navigation = 0
  let disposed = false
  ctx.effect(
    () => () => {
      disposed = true
      navigation++
    },
    'tokenyUI: pending navigation',
  )
  const requirePanels = () => {
    if (panels === undefined) throw new Error('tokenyUI: root panel actions are not mounted.')
    return panels
  }
  const selectProject = async (id: WorkspaceId) => {
    const request = ++navigation
    const workspaceState = ctx.workspaces.list.getSnapshot()
    const workspace = workspaceState.items.find(w => w.workspaceId === id)
    if (workspace === undefined) throw new Error('The workspace no longer exists.')
    const sessionState = ctx.sessions.list.getSnapshot()
    const current = sessionState.current
    const existing =
      current !== undefined && workspace.sessionIds.includes(current)
        ? current
        : workspace.sessionIds.find(
          sessionId =>
            sessionState.byId[sessionId] !== undefined && !workspaceState.archivedSessionIds.includes(sessionId),
        )
    const session = existing ?? (await ctx.workspaces.connectWorkspace(id))
    if (!disposed && request === navigation) ctx.sessions.open(session)
  }
  const shell: ShellInjected = {
    selectProject,
    addProject: async (path) => {
      const workspace = await ctx.workspaces.create({ path })
      if (!disposed) await selectProject(workspace.workspaceId)
    },
    browse: () => ctx.workspaces.pickDirectory(),
    startSession: (id) => {
      navigation++
      ctx.workspaces.startSession(id)
    },
  }
  const sessionActions: SessionsInjected = {
    openSession: (id) => {
      navigation++
      ctx.sessions.open(id)
    },
    archiveSession: id => ctx.workspaces.archiveSession(id),
    renameSession: async (id, title) => {
      const session = ctx.sessions.binding(id)?.session
      if (session === undefined) throw new Error('The session no longer exists.')
      const result = await session.rename(title)
      if (!result.ok) throw new Error(result.error.message)
    },
  }
  const files: FilesInjected = {
    listFiles: async (workspaceId, path, signal) => {
      const result = await connection.rpc.call('/tokeny-ui', 'list', { workspaceId, path }, signal)
      if (!result.ok) throw new Error(result.error.message)
      return directoryResponse.parse(result.value)
    },
    readFile: async (workspaceId, path, signal) => {
      const result = await connection.rpc.call('/tokeny-ui', 'read', { workspaceId, path }, signal)
      if (!result.ok) throw new Error(result.error.message)
      return previewResponse.parse(result.value)
    },
  }
  ctx.effect(() => ctx.locale.register('tokenyUI', { zh, en }), 'tokenyUI: locale')
  ctx.effect(() => ctx.theme.overrideTokens('tokenyUI', tokenyTokens), 'tokenyUI: palette')
  ctx.effect(() => {
    const projection = createThemeProjection()
    projection.update(ctx.theme.getTheme())
    const off = ctx.on('theme/change', (snapshot) => {
      projection.update(snapshot)
    })
    return () => {
      off()
      projection.dispose()
    }
  }, 'tokenyUI: theme projection')
  ctx.effect(
    () =>
      ctx.reflect.provide('layout', {
        toggleSidebar: () => {
          requirePanels().toggleSidebar()
        },
        openDetails: () => {
          requirePanels().openDetails()
        },
        closeDetails: () => {
          requirePanels().closeDetails()
        },
      }),
    'tokenyUI: layout service',
  )
  ctx.effect(
    () =>
      ctx.slots.register(
        {
          name: 'root',
          store,
          locale: 'tokenyUI',
          children: {
            sidebar: { kind: 'single', scope: 'root' },
            conversation: { kind: 'single', scope: 'session-maybe' },
            details: { kind: 'single', scope: 'session' },
            'shell.overlay': { kind: 'list', scope: 'root' },
            'tokenyUI.preview': { kind: 'single', scope: 'root' },
          },
          inject: (actions: BoundActions<typeof store>) => {
            panels = actions
            return shell
          },
        },
        Shell,
      ),
    'tokenyUI: root',
  )
  ctx.slots.inject('sidebar', () =>
    ctx.slots.register(
      {
        name: 'sidebar',
        store,
        locale: 'tokenyUI',
        children: {
          'sidebar.workspaces': { kind: 'single', scope: 'root' },
          'sidebar.settings': { kind: 'single', scope: 'root' },
          'sidebar.footer.action': { kind: 'list', scope: 'root' },
          'tokenyUI.sidebar.files': { kind: 'single', scope: 'root' },
        },
        inject: () => ({ startSession: shell.startSession, ...sessionActions }),
      },
      Sidebar,
    ),
  )
  ctx.slots.inject('tokenyUI.sidebar.files', () =>
    ctx.slots.register(
      {
        name: 'tokenyUI.sidebar.files',
        store,
        locale: 'tokenyUI',
        inject: () => ({ listFiles: files.listFiles }),
      },
      FileExplorer,
    ),
  )
  ctx.slots.inject('tokenyUI.preview', () =>
    ctx.slots.register(
      {
        name: 'tokenyUI.preview',
        store,
        locale: 'tokenyUI',
        inject: () => ({ readFile: files.readFile }),
      },
      FilePreview,
    ),
  )
}
