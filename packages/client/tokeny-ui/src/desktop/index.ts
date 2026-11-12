/** Desktop 0.2.2 composition using public Harness services and slots. */
import type { Context } from '@deepseek-ai/cordis'
import type { ILayout, MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { ShortcutCommandId } from '@deepseek-ai/dsh-client-shortcuts/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { createDesktopStore } from './store.ts'
import { createDesktopTheme } from './theme.ts'
import { registerThemePanel } from './ThemePanel.tsx'
import { registerPet } from './pets/register.ts'
import { Root } from './Root.tsx'
import { applySidebar } from './Sidebar.tsx'
import { registerComposerControls } from './Composer.tsx'
import { registerFiles } from './FileExplorer.tsx'
import { en, zh } from '../client/locales.ts'
import { activeWorkspace, waitForSessionListReady, workspaceForSession } from './workspace.ts'

/** Infrastructure required before publishing the layout service. */
export const inject = ['slots', 'theme', 'locale', 'shortcuts']

/** Install the desktop shell without modifying the app archive or official brand. */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register('tokenyUI', { en, zh }), 'tokenyUI: shell labels')
  const handle = createDesktopStore()
  const instance = handle.create()
  const store = { ...handle, create: () => instance }
  let navigation = new AbortController()
  let openingProject = false
  let projectRequest = 0
  const layout: ILayout = {
    panelInfo: {
      getSnapshot: () => instance.getSnapshot().panelInfo,
      subscribe: (listener: () => void) => instance.subscribe(listener),
    },
    selectPanel: (id: MainPanelId | null) => {
      if (id !== null && !ctx.slots.entries('main').some(entry => entry.options.key === id))
        throw new Error(`Unknown main panel: ${id}`)
      navigation.abort()
      if (!openingProject) instance.actions.setWorkspaceTarget(null)
      instance.actions.selectPanel(id)
    },
    beginNavigation: () => {
      navigation.abort()
      navigation = new AbortController()
      projectRequest++
      instance.actions.setWorkspaceTarget(null)
      return navigation.signal
    },
    toggleSidebar: () => {
      instance.actions.toggleSidebar()
    },
    openRightbar: (track: boolean, fullscreen: boolean) => {
      instance.actions.openRightbar(track, fullscreen)
    },
    closeRightbar: () => {
      instance.actions.closeRightbar()
    },
  }
  ctx.effect(() => {
    const offInfo = ctx.slots.provideRoot({
      hooks: { panelInfo: layout.panelInfo },
    })
    const offService = ctx.reflect.provide('layout', layout)
    return () => {
      navigation.abort()
      offInfo()
      void offService()
    }
  }, 'tokenyUI: desktop layout service')
  ctx.effect(() => {
    const theme = createDesktopTheme(ctx.theme)
    registerThemePanel(ctx, theme)
    theme.update(ctx.theme.getTheme())
    const off = ctx.on('theme/change', (snapshot) => {
      theme.update(snapshot)
    })
    return () => {
      off()
      theme.dispose()
    }
  }, 'tokenyUI: desktop theme')
  registerPet(ctx)
  registerComposerControls(ctx)
  ctx.inject(['layout', 'uiWorkspace', 'uiSession', 'sessions', 'workspaces'], (child) => {
    const ui = child.uiWorkspace
    const sessions = child.sessions
    const workspaces = child.workspaces
    const binding = child.uiSession.adapter.current
    // Desktop 0.2.2 exposes the authoritative sessions service in newer
    // profiles. Older installed profiles only expose the native workspace
    // adapter's session opener; keep that compatibility path so a plugin
    // update cannot turn a project switch into a runtime error.
    const openExistingSession = (sessionId: SessionId): void => {
      if (typeof sessions.open === 'function') {
        sessions.open(sessionId)
        return
      }
      const legacy = ui as unknown as { openSession?: (id: SessionId) => void }
      if (typeof legacy.openSession === 'function') {
        legacy.openSession(sessionId)
        return
      }
      throw new Error('The desktop host does not expose a session opener.')
    }
    const mainSession = {
      getSnapshot: () => binding.getSnapshot().key,
      subscribe: (listener: () => void) => binding.subscribe(listener),
    }
    const displayedWorkspace = () =>
      activeWorkspace(
        workspaces.list.getSnapshot(),
        mainSession.getSnapshot(),
        instance.getSnapshot().workspaceInfo.target,
        instance.getSnapshot().workspaceInfo.confirmed,
      )
    const settleProject = () => {
      const target = instance.getSnapshot().workspaceInfo.target
      const state = workspaces.list.getSnapshot()
      const current = mainSession.getSnapshot()
      const selected = state.items.find(item => item.sessionIds.some(id => id === current))
      if (selected !== undefined) instance.actions.confirmWorkspace(selected.workspaceId)
      if (state.phase === 'ready') {
        if (target !== null && !state.items.some(item => item.workspaceId === target))
          layout.beginNavigation()
        instance.actions.retainWorkspaces(state.items.map(item => item.workspaceId))
      }
    }
    child.effect(() => mainSession.subscribe(settleProject), 'tokenyUI: native project selection')
    child.effect(() => workspaces.list.subscribe(settleProject), 'tokenyUI: project membership')
    settleProject()
    const selectProject = async (id: WorkspaceId) => {
      const workspaceState = workspaces.list.getSnapshot()
      const workspace = workspaceState.items.find(item => item.workspaceId === id)
      if (workspace === undefined) throw new Error('The workspace no longer exists.')
      const signal = layout.beginNavigation()
      instance.actions.setWorkspaceTarget(id)
      if (!await waitForSessionListReady(sessions.list, signal)) return
      // Workspace membership can be refreshed while the session baseline is
      // pending. Re-read both projections after the wait so a removed or
      // archived row cannot be selected and then clear the current view.
      const currentWorkspaceState = workspaces.list.getSnapshot()
      const currentWorkspace = currentWorkspaceState.items.find(item => item.workspaceId === id)
      if (currentWorkspace === undefined) {
        if (!signal.aborted) instance.actions.setWorkspaceTarget(null)
        return
      }
      const rows: Partial<ReturnType<typeof sessions.list.getSnapshot>['byId']> =
        sessions.list.getSnapshot().byId
      const archived = new Set(currentWorkspaceState.archivedSessionIds)
      const current = currentWorkspace.sessionIds.find(
        sessionId => sessionId === mainSession.getSnapshot() && !archived.has(sessionId),
      )
      const recent = current ??
        currentWorkspace.sessionIds
          .flatMap((sessionId) => {
            const row = rows[sessionId]
            return row === undefined || row.origin === 'subagent' || archived.has(sessionId) ? [] : [row]
          })
          .sort((a, b) => b.updatedAt - a.updatedAt).at(0)?.id
      try {
        const sessionId = recent ?? await ui.connectWorkspace(id)
        if (signal.aborted) return
        openingProject = true
        try {
          // The workspace adapter is only needed to create/connect a blank
          // session. Selecting an existing session must use the sessions
          // controller so its persisted selection cannot be cleared by a
          // transient workspace-draft reconciliation.
          openExistingSession(sessionId)
        } finally {
          openingProject = false
        }
        settleProject()
      } catch (error) {
        if (signal.aborted) return
        instance.actions.setWorkspaceTarget(null)
        throw error
      }
    }
    const startSession = (id?: WorkspaceId) => {
      const target = id ?? displayedWorkspace()?.workspaceId
      if (target === undefined) {
        ui.startSession()
        return
      }
      const attempt = ui.openWorkspace(target)
      const request = projectRequest
      instance.actions.setWorkspaceTarget(target)
      void attempt.catch((reason: unknown) => {
        if (projectRequest === request) console.warn('tokenyUI: new session failed:', reason)
      }).finally(() => {
        if (projectRequest === request) instance.actions.setWorkspaceTarget(null)
      })
    }
    const openSession = (id: SessionId) => {
      const state = workspaces.list.getSnapshot()
      // Resolve ownership from the clicked row. During the native adapter's
      // hand-off, currentSession can be undefined or temporarily belong to a
      // different group; deriving the owner from it made default-workspace
      // rows fail this guard and look as if their session had disappeared.
      const workspace = workspaceForSession(state, id)
      if (workspace !== undefined && !state.archivedSessionIds.includes(id)) {
        // Keep the project context stable while the native session binding
        // catches up. During that hand-off the current id can briefly be
        // absent from workspace membership; clearing the confirmed project
        // here would make every sibling session disappear from the sidebar.
        instance.actions.confirmWorkspace(workspace.workspaceId)
          // Existing-session navigation must go through the authoritative
          // sessions service. The native workspace adapter also manages its
          // transient workspace draft; calling it for a row that already
          // exists can clear the default workspace's selection while the
          // adapter reconciles that draft. `sessions.open` only changes the
          // selected session and preserves the workspace membership.
          openExistingSession(id)
      }
    }
    child.inject(['contextMenus'], (sidebarContext) => {
      applySidebar(sidebarContext, store, { mainSession, startSession, openSession })
    })
    child.effect(
      () =>
        child.slots.register(
          {
            name: 'root',
            locale: 'tokenyUI',
            store,
            children: {
              sidebar: { kind: 'single', scope: 'root' },
              main: { kind: 'keyed', scope: 'root' },
              rightbar: { kind: 'single', scope: 'root' },
              'shell.bottom': { kind: 'single', scope: 'root' },
              'shell.overlay': { kind: 'list', scope: 'root' },
              'shell.leading': { kind: 'single', scope: 'root' },
              'tokenyUI.files': { kind: 'single', scope: 'root' },
              'tokenyUI.themes': { kind: 'single', scope: 'root' },
            },
            inject: () => ({
              hooks: { mainSession },
              selectProject,
              addProject: async (path: string) => {
                const signal = layout.beginNavigation()
                const workspace = await workspaces.create({ path }).catch((error: unknown) => {
                  if (!signal.aborted) throw error
                  return undefined
                })
                if (workspace === undefined || signal.aborted) return
                await selectProject(workspace.workspaceId)
              },
              browse: () => ui.pickDirectory(),
              startSession,
            }),
          },
          Root,
        ),
      'tokenyUI: desktop root',
    )
    const retainPanels = () => {
      instance.actions.retainMainPanels(
        child.slots
          .entries('main')
          .flatMap(entry => (entry.options.key === undefined ? [] : [entry.options.key])),
      )
    }
    child.effect(
      () => child.slots.subscribe('main', retainPanels),
      'tokenyUI: main panel lifecycle',
    )
    retainPanels()
  })
  ctx.inject(['remote', 'remote.workspaceFiles', 'sidebarRight'], (child) => {
    registerFiles(child)
  })
  ctx.effect(
    () =>
      ctx.shortcuts.register({
        id: 'sidebar.left.toggle' as ShortcutCommandId,
        label: () => ctx.locale.bind('tokenyUI')('togglePanel'),
        aliases: ['sidebar', 'toggle left sidebar'],
        defaults: {
          'desktop:windows': { code: 'KeyB', modifiers: ['primary'] },
          'desktop:linux': { code: 'KeyB', modifiers: ['primary'] },
          'desktop:macos': { code: 'KeyB', modifiers: ['primary'] },
        },
        regions: ['page', 'editable'],
        modals: ['sidebar'],
        resolve: ({ modal }) =>
          modal !== null && modal !== 'sidebar'
            ? { status: 'pass' }
            : {
              status: 'handled',
              run: () => {
                layout.toggleSidebar()
              },
            },
      }),
    'tokenyUI: sidebar shortcut',
  )
}
