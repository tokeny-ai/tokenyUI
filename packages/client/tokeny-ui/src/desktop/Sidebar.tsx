/** Tokeny navigation column composed with the installed Harness sidebar seats. */
import type { Context } from '@deepseek-ai/cordis'
import { useState } from 'react'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  HostObservable,
  PropsHooks,
  PropsLocale,
  PropsRenderSlots,
  PropsRuntime,
  PropsStore,
} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type { SidebarPanelMetadata } from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { Menu } from '@deepseek-ai/dsh-client-ui-primitives'
import type { DesktopSelectionSources, DesktopSessionState } from './types.ts'
import type { createDesktopStore } from './store.ts'
import { activeWorkspace } from './workspace.ts'
import css from './Sidebar.module.css'

type SlotName =
  | 'sidebar.brand.mark'
  | 'sidebar.brand.name'
  | 'sidebar.toggle.badge'
  | 'sidebar.panellist'
  | 'sidebar.panellist.actions'
  | 'sidebar.workspaces.session.row.action'
  | 'sidebar.session.row.leading'
  | 'sidebar.session.row.trailing'
  | 'sidebar.settings'
  | 'sidebar.footer.action'
type Panel = SidebarPanelMetadata
type SidebarSources = DesktopSelectionSources & {
  panels: HostObservable<readonly Panel[]>
  entryPins: HostObservable<readonly string[]>
  entryActions: HostObservable<boolean>
}
type SidebarInjected = {
  toggleSidebar: () => void
  startSession: () => void
  selectPanel: (id: MainPanelId | null) => void
  setPinned: (id: string, pinned: boolean) => void
  openSession: (id: SessionId) => void
  openSessionMenu: (id: SessionId, title: string, point: { x: number; y: number }) => void
}

/** Four shares derived from the sidebar owner, declared child seats, locale and injected sources. */
type SidebarProps = PropsRuntime<'sidebar'> &
  PropsRenderSlots<SlotName> &
  PropsLocale<'tokenyUI'> &
  PropsHooks<SidebarSources> &
  PropsStore<ReturnType<typeof createDesktopStore>> &
  SidebarInjected

function Sidebar({
  collapsed,
  drawer,
  usePanels,
  useEntryPins,
  useEntryActions,
  usePanelInfo,
  useRemoteAccess,
  useSessions,
  useWorkspaces,
  useContextMenu,
  useMainSession,
  useStore,
  renderSlot,
  toggleSidebar,
  startSession,
  selectPanel,
  setPinned,
  openSession,
  openSessionMenu,
  t,
}: SidebarProps) {
  const wide = drawer || !collapsed
  const panels = usePanels(rows => rows)
  const unpinned = useEntryPins(ids => ids)
  const hasEntryActions = useEntryActions(value => value)
  const activePanelId = usePanelInfo(info => info.activePanelId)
  const isWorkspace = activePanelId === null || activePanelId === 'conversation'
  const canStartSession = useRemoteAccess('session/create')
  const [more, setMore] = useState(false)
  const [search, setSearch] = useState<{ workspaceId: string | undefined; value: string }>({
    workspaceId: undefined,
    value: '',
  })
  const sessions = useSessions(state => state)
  const workspaces = useWorkspaces(state => state)
  const { target, confirmed } = useStore(state => state.workspaceInfo)
  const currentId = useMainSession(id => id)
  const project = activeWorkspace(workspaces, currentId, target, confirmed)
  const query = search.workspaceId === project?.workspaceId ? search.value : ''
  const menu = useContextMenu()
  const archived = new Set(workspaces.archivedSessionIds)
  const pinned = new Set(workspaces.pinnedSessionIds)
  const summaries: Partial<DesktopSessionState['byId']> = sessions.byId
  const rows = (project?.sessionIds ?? [])
    .flatMap((id) => {
      const row = summaries[id]
      return row === undefined ? [] : [row]
    })
    .filter(
      row =>
        row.origin !== 'subagent' &&
        !archived.has(row.id) &&
        (!row.blank || row.id === currentId) &&
        row.displayTitle.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
    )
    .sort(
      (a, b) => Number(pinned.has(b.id)) - Number(pinned.has(a.id)) || b.updatedAt - a.updatedAt,
    )
  return (
    <div
      className={css.sidebar}
      data-wide={wide}
      role={drawer ? 'dialog' : undefined}
      aria-modal={drawer && !collapsed ? true : undefined}
      aria-label={t('workspace')}
    >
      <div className={css.brandRow}>
        <div className={css.brandMark}>{renderSlot('sidebar.brand.mark', { size: 25 })}</div>
        {wide && <div className={css.brandName}>{renderSlot('sidebar.brand.name', {})}</div>}
        <button
          type="button"
          className={css.toggle}
          data-sidebar-toggle
          aria-label={t('togglePanel')}
          title={t('togglePanel')}
          onClick={toggleSidebar}
        >
          <svg width="17" height="17" viewBox="0 0 20 20" aria-hidden="true">
            <rect
              x="3"
              y="4"
              width="14"
              height="12"
              rx="2"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
            />
            <path d="M8 4v12" stroke="currentColor" strokeWidth="1.3" />
          </svg>
          {renderSlot('sidebar.toggle.badge', {})}
        </button>
      </div>
      {canStartSession && isWorkspace && (
        <button
          type="button"
          className={css.newSession}
          title={t('newSession')}
          aria-label={t('newSession')}
          onClick={startSession}
        >
          <span className={css.newIcon} aria-hidden="true">
            ＋
          </span>
          {wide && <span>{t('newSession')}</span>}
        </button>
      )}
      <nav className={css.panels} aria-label={t('workspace')}>
        <button
          type="button"
          className={css.panelButton}
          data-tokeny-workspace-tab
          title={t('workspace')}
          aria-label={t('workspace')}
          aria-current={isWorkspace ? 'page' : undefined}
          onClick={() => {
            selectPanel(null)
          }}
        >
          <span className={css.panelIcon} aria-hidden="true">
            <svg width={wide ? 17 : 20} height={wide ? 17 : 20} viewBox="0 0 20 20" fill="none">
              <rect x="2.5" y="3" width="15" height="14" rx="2" stroke="currentColor" />
              <path d="M7.5 3v14M8 8h9" stroke="currentColor" />
            </svg>
          </span>
          {wide && <span>{t('workspace')}</span>}
        </button>
        {panels
          .filter(
            panel =>
              panel.id !== 'conversation' &&
              (panel.id === 'plugins' || !unpinned.includes(panel.id)),
          )
          .map(panel => (
            <button
              key={panel.id}
              type="button"
              className={css.panelButton}
              title={panel.label}
              aria-label={panel.label}
              aria-current={activePanelId === panel.id ? 'page' : undefined}
              onClick={() => {
                selectPanel(panel.id)
              }}
            >
              <span className={css.panelIcon} aria-hidden="true">
                {renderSlot(
                  'sidebar.panellist',
                  { size: wide ? 17 : 20, active: activePanelId === panel.id },
                  { only: panel.id },
                )}
              </span>
              {wide && <span>{panel.label}</span>}
            </button>
          ))}
        {hasEntryActions && (
          <Menu
            open={more}
            onClose={() => {
              setMore(false)
            }}
            portal
            autoFocus
            anchor={
              <button
                type="button"
                className={css.panelButton}
                title={t('morePanels')}
                aria-label={t('morePanels')}
                aria-haspopup="menu"
                aria-expanded={more}
                onClick={() => {
                  setMore(!more)
                }}
              >
                <span className={css.panelIcon} aria-hidden="true">
                  ···
                </span>
                {wide && <span>{t('morePanels')}</span>}
              </button>
            }
          >
            {renderSlot('sidebar.panellist.actions', {
              entries: panels
                .filter(panel => panel.id !== 'plugins')
                .map(panel => ({
                  id: panel.id,
                  label: panel.label,
                  pinned: !unpinned.includes(panel.id),
                  active: panel.id === activePanelId,
                })),
              onOpen: (id: string) => {
                const panel = panels.find(entry => entry.id === id)
                if (panel !== undefined) selectPanel(panel.id)
              },
              onPinnedChange: setPinned,
              onDismiss: () => {
                setMore(false)
              },
            })}
          </Menu>
        )}
      </nav>
      <div
        className={css.workspaces}
        data-tokeny-sessions={isWorkspace ? '' : undefined}
        data-workspace-id={isWorkspace ? project?.workspaceId : undefined}
      >
        {wide && isWorkspace && (
          <>
            <div className={css.sessionsHeader}>{t('sessions')}</div>
            <input
              className={css.sessionSearch}
              aria-label={t('searchSessions')}
              placeholder={t('searchSessions')}
              value={query}
              onChange={(event) => {
                setSearch({ workspaceId: project?.workspaceId, value: event.target.value })
              }}
            />
            <div className={css.sessionList} role="list" aria-label={t('sessions')}>
              {rows.map(row => (
                <div
                  key={row.id}
                  className={css.sessionRow}
                  role="listitem"
                  data-session-id={row.id}
                  data-current={row.id === currentId}
                  {...menu.getTriggerProps({
                    kind: 'session',
                    value: { sessionId: row.id, displayTitle: row.displayTitle },
                  })}
                >
                  <button
                    type="button"
                    className={css.sessionOpen}
                    title={row.displayTitle}
                    aria-current={row.id === currentId ? 'page' : undefined}
                    onClick={() => {
                      openSession(row.id)
                    }}
                  >
                    <span className={css.sessionStatus}>
                      {row.running ? (
                        <span className={css.runningDot} title={t('running')} />
                      ) : (
                        renderSlot('sidebar.session.row.leading', { sessionId: row.id })
                      )}
                    </span>
                    <span className={css.sessionTitle}>
                      {row.title || (row.blank ? t('newSession') : row.displayTitle)}
                    </span>
                    {!row.blank && (
                      <span className={css.sessionDecoration}>
                        {renderSlot('sidebar.session.row.trailing', { sessionId: row.id })}
                        {pinned.has(row.id) && <span aria-label={t('pinned')}>◇</span>}
                      </span>
                    )}
                  </button>
                  <div className={css.sessionActions}>
                    <button
                      type="button"
                      title={t('sessionActions')}
                      aria-label={`${t('sessionActions')}: ${row.displayTitle}`}
                      onClick={(event) => {
                        const rect = event.currentTarget.getBoundingClientRect()
                        openSessionMenu(row.id, row.displayTitle, { x: rect.left, y: rect.bottom })
                      }}
                    >
                      ···
                    </button>
                    {renderSlot('sidebar.workspaces.session.row.action', {
                      sessionId: row.id,
                      displayTitle: row.displayTitle,
                    })}
                  </div>
                </div>
              ))}
              {rows.length === 0 && (
                <div className={css.empty}>
                  {t(project === undefined ? 'choose' : query.trim() ? 'noMatches' : 'noSessions')}
                </div>
              )}
            </div>
          </>
        )}
      </div>
      <div className={css.footer}>
        {renderSlot('sidebar.footer.action', { wide })}
        {renderSlot('sidebar.settings', { wide })}
      </div>
    </div>
  )
}

/**
 * Register the desktop navigation column after layout and workspace UI are ready.
 * @param ctx - Cordis context injecting slots, layout, context menus and locale.
 * @param store - Shell store shared with the root project controls.
 * @param selection - Native current binding and workspace-scoped navigation callbacks.
 */
export function applySidebar(
  ctx: Context,
  store: ReturnType<typeof createDesktopStore>,
  selection: DesktopSelectionSources & Pick<SidebarInjected, 'startSession' | 'openSession'>,
): void {
  const slots = ctx.slots
  const layout = ctx.layout
  const locale = ctx.locale
  const panels = createSnapshotStore<readonly Panel[]>([])
  const unpinned = createSnapshotStore<readonly string[]>([])
  const entryActions = {
    getSnapshot: () => slots.entriesOfSlot('sidebar.panellist.actions').length > 0,
    subscribe: (listener: () => void) => slots.subscribe('sidebar.panellist.actions', listener),
  }
  const sync = () => {
    const next = slots
      .entriesOfSlot('sidebar.panellist')
      .map(({ options }) => ({
        id: options.id as MainPanelId,
        label: resolveSlotLabel(options.label) ?? (options.id as string),
        order: options.order ?? 0,
      }))
      .sort((a, b) => a.order - b.order)
    const previous = panels.getSnapshot()
    if (
      previous.length === next.length &&
      previous.every(
        (panel, index) =>
          panel.id === next[index]?.id &&
          panel.label === next[index]?.label &&
          panel.order === next[index]?.order,
      )
    )
      return
    panels.set(next)
  }
  ctx.effect(() => slots.subscribe('sidebar.panellist', sync), 'tokenyUI: desktop panels')
  ctx.effect(() => locale.subscribe(sync), 'tokenyUI: desktop panel labels')
  slots.inject('sidebar', () => {
    const dispose = slots.register(
      {
        name: 'sidebar',
        locale: 'tokenyUI',
        store,
        children: {
          'sidebar.brand.mark': { kind: 'single', scope: 'root' },
          'sidebar.brand.name': { kind: 'single', scope: 'root' },
          'sidebar.toggle.badge': { kind: 'single', scope: 'root' },
          'sidebar.panellist': { kind: 'list', scope: 'root' },
          'sidebar.panellist.actions': { kind: 'list', scope: 'root' },
          'sidebar.workspaces.session.row.action': { kind: 'list', scope: 'root' },
          'sidebar.session.row.leading': { kind: 'list', scope: 'root', inline: true },
          'sidebar.session.row.trailing': { kind: 'list', scope: 'root', inline: true },
          'sidebar.settings': { kind: 'single', scope: 'root' },
          'sidebar.footer.action': { kind: 'list', scope: 'root' },
        },
        inject: () => ({
          hooks: { panels, entryPins: unpinned, entryActions, mainSession: selection.mainSession },
          toggleSidebar: () => {
            layout.toggleSidebar()
          },
          startSession: () => {
            selection.startSession()
          },
          openSession: selection.openSession,
          openSessionMenu: (
            sessionId: SessionId,
            displayTitle: string,
            point: { x: number; y: number },
          ) => {
            ctx.contextMenus.open({ kind: 'session', value: { sessionId, displayTitle } }, point)
          },
          selectPanel: (id: MainPanelId | null) => {
            layout.selectPanel(id)
          },
          setPinned: (id: string, pinned: boolean) => {
            const current = unpinned.getSnapshot()
            if (id === 'plugins' || pinned !== current.includes(id)) return
            unpinned.set(pinned ? current.filter(entry => entry !== id) : [...current, id])
          },
        }),
      },
      Sidebar,
    )
    sync()
    return dispose
  })
}
