/** Tokeny workspace frame around the installed Harness panels. */
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import type {
  PropsRuntime,
  PropsRenderSlots,
  PropsStore,
  PropsLocale,
  PropsHooks,
} from '@deepseek-ai/dsh-client-ui-slots'
import type { createDesktopStore } from './store.ts'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client'
import { ProjectSwitcher } from './ProjectSwitcher.tsx'
import type { DesktopSelectionSources } from './types.ts'
import { activeWorkspace } from './workspace.ts'
import css from './Root.module.css'

type RootInjected = {
  selectProject: (id: WorkspaceId) => Promise<void>
  addProject: (path: string) => Promise<void>
  browse: () => Promise<string | null>
  startSession: (id?: WorkspaceId) => void
}
type RootProps = PropsRuntime<'root'> &
  PropsRenderSlots<
    | 'sidebar'
    | 'main'
    | 'rightbar'
    | 'shell.bottom'
    | 'shell.overlay'
    | 'shell.leading'
    | 'tokenyUI.files'
    | 'tokenyUI.themes'
  > &
  PropsStore<ReturnType<typeof createDesktopStore>> &
  PropsLocale<'tokenyUI'> &
  PropsHooks<DesktopSelectionSources> &
  RootInjected

function PanelIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2.5" y="3.5" width="15" height="13" rx="2" stroke="currentColor" />
      <path d="M7 4v12" stroke="currentColor" />
    </svg>
  )
}

/** Render the desktop's public slots with project and file controls. */
export function Root(props: RootProps) {
  const {
    useStore,
    useSessions,
    useWorkspaces,
    usePanelInfo,
    useMainSession,
    renderSlot,
    actions,
    t,
  } = props
  const info = useStore(s => s.layoutInfo)
  const { target, confirmed } = useStore(s => s.workspaceInfo)
  const panel = usePanelInfo(s => s.activePanelId)
  const sessions = useSessions(s => s)
  const workspaces = useWorkspaces(s => s)
  const currentId = useMainSession(id => id)
  const workspace = activeWorkspace(workspaces, currentId, target, confirmed)
  const [adding, setAdding] = useState(false)
  const [appearance, setAppearance] = useState(false)
  const [nativeMenuWidth, setNativeMenuWidth] = useState(0)
  const appearanceTrigger = useRef<HTMLButtonElement>(null)
  const [path, setPath] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const live = useRef(true)
  const operation = useRef(0)
  const drag = useRef<{
    x: number
    width: number
    target: 'files' | 'sidebar' | 'rightbar'
  } | null>(null)
  useEffect(() => {
    live.current = true
    const resize = () => {
      actions.setViewportWidth(window.innerWidth)
    }
    resize()
    window.addEventListener('resize', resize)
    return () => {
      live.current = false
      window.removeEventListener('resize', resize)
    }
  }, [actions])
  useEffect(() => {
    const root = document.documentElement
    const property = '--dsh-windows-menu-start'
    const previous = root.style.getPropertyValue(property)
    const priority = root.style.getPropertyPriority(property)
    const narrow = window.matchMedia('(max-width: 760px)')
    const placeMenu = () => {
      root.style.setProperty(property, narrow.matches ? '48px' : '92px')
    }
    let menu: HTMLElement | null = null
    const measureMenu = () => {
      setNativeMenuWidth(menu?.getBoundingClientRect().width ?? 0)
    }
    const observer = new ResizeObserver(measureMenu)
    const bindMenu = () => {
      const next = document.querySelector<HTMLElement>('[data-windows-menu]')
      if (next === menu) return
      if (menu !== null) observer.unobserve(menu)
      menu = next
      if (menu !== null) observer.observe(menu)
      measureMenu()
    }
    const appearance = new MutationObserver(bindMenu)
    appearance.observe(document.body, { childList: true })
    bindMenu()
    placeMenu()
    measureMenu()
    narrow.addEventListener('change', placeMenu)
    return () => {
      observer.disconnect()
      appearance.disconnect()
      narrow.removeEventListener('change', placeMenu)
      if (previous === '') root.style.removeProperty(property)
      else root.style.setProperty(property, previous, priority)
    }
  }, [])
  const current = Object.values(sessions.byId).find(row => row.id === currentId)
  const fileSession = workspace?.sessionIds.some(id => id === currentId) ? current?.id : undefined
  const waitingForProject =
    target !== null && fileSession === undefined && (panel === null || panel === 'conversation')
  useEffect(() => {
    document.title =
      panel === null && current?.title ? `${current.title} — DeepSeek Harness` : 'DeepSeek Harness'
    return () => {
      document.title = 'DeepSeek Harness'
    }
  }, [panel, current?.title])
  const sidebar =
    info.sidebar === 0 ? 56 : Math.min(info.sidebar, Math.max(190, info.viewportWidth * 0.28))
  const reserveRight = info.rightbarShown && info.rightbarTrack
  const availableRight = info.viewportWidth - sidebar - 400
  const canShowRight = availableRight >= 300
  const rightWidth = canShowRight
    ? Math.min(info.rightbar ?? Math.max(300, info.viewportWidth * 0.35), availableRight)
    : 0
  const availableFiles = info.viewportWidth - sidebar - (reserveRight ? rightWidth : 0) - 400
  const filesWidth =
    (panel === null || panel === 'conversation') &&
    info.sidebar !== 0 &&
    info.filesExpanded &&
    availableFiles >= 180
      ? Math.min(info.files, availableFiles)
      : 0
  const run = async (job: () => Promise<void>) => {
    const request = ++operation.current
    setBusy(true)
    setError(null)
    try {
      await job()
    } catch (cause) {
      if (live.current && operation.current === request)
        setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      if (live.current && operation.current === request) setBusy(false)
    }
  }
  const beginDrag = (
    event: PointerEvent<HTMLDivElement>,
    target: 'files' | 'sidebar' | 'rightbar',
    width: number,
  ) => {
    drag.current = { x: event.clientX, width, target }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onDrag = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (d === null) return
    const delta = event.clientX - d.x
    if (d.target === 'files') actions.setFiles(d.width + delta)
    else if (d.target === 'sidebar') actions.setSidebar(d.width + delta)
    else actions.setRightbar(d.width - delta)
  }
  return (
    <div
      className={css.frame}
      data-tokeny-ui
      data-tokeny-version="desktop-0.2.2"
      style={
        {
          '--dsh-windows-sidebar-width': `${sidebar}px`,
          '--tokeny-native-menu-width': `${nativeMenuWidth}px`,
        } as import('react').CSSProperties
      }
    >
      <header className={css.titlebar} data-tokeny-titlebar>
        <div className={css.controls}>
          {renderSlot('shell.leading', {})}
          <button
            className={css.iconButton}
            aria-label={t('togglePanel')}
            title={t('togglePanel')}
            onClick={actions.toggleSidebar}
          >
            <PanelIcon />
          </button>
          <button
            className={css.textButton}
            data-tokeny-files-toggle
            aria-label={t('files')}
            aria-pressed={filesWidth > 0}
            onClick={actions.toggleFiles}
          >
            {t('files')}
          </button>
        </div>
        <div className={css.project}>
          <ProjectSwitcher
            items={workspaces.items}
            current={workspace?.workspaceId}
            disabled={workspaces.phase !== 'ready'}
            t={t}
            onSelect={(id) => {
              void run(() => props.selectProject(id))
            }}
            onAdd={() => {
              setError(null)
              setAdding(true)
            }}
            onNewSession={() => {
              props.startSession(workspace?.workspaceId)
            }}
          />
        </div>
        <div className={css.trailing}>
          <button
            ref={appearanceTrigger}
            className={css.iconButton}
            type="button"
            aria-label={t('themes')}
            title={t('themes')}
            aria-haspopup="dialog"
            aria-expanded={appearance}
            onClick={() => {
              setAppearance(value => !value)
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="M12 3a9 9 0 1 0 0 18h1.4a2.3 2.3 0 0 0 1.2-4.3 1.4 1.4 0 0 1 .7-2.7H17a4 4 0 0 0 4-4c0-4-4-7-9-7Z" />
              <circle cx="7.5" cy="10" r="1" />
              <circle cx="10.5" cy="6.8" r="1" />
              <circle cx="15" cy="7.5" r="1" />
            </svg>
          </button>
        </div>
      </header>
      <div className={css.workbench} data-tokeny-workbench>
        <aside className={css.sidebar} style={{ width: sidebar }}>
          {renderSlot('sidebar', {
            collapsed: info.sidebar === 0,
            width: sidebar,
            drawer: false,
          })}
          {info.sidebar !== 0 && (
            <div
              className={css.resize}
              role="separator"
              aria-orientation="vertical"
              aria-label={t('resize')}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight')
                  actions.setSidebar(sidebar + (e.key === 'ArrowLeft' ? -16 : 16))
              }}
              onPointerDown={(e) => {
                beginDrag(e, 'sidebar', sidebar)
              }}
              onPointerMove={onDrag}
              onPointerUp={() => {
                drag.current = null
              }}
              onLostPointerCapture={() => {
                drag.current = null
              }}
            />
          )}
        </aside>
        {filesWidth > 0 && (
          <aside className={css.files} style={{ width: filesWidth }}>
            {renderSlot('tokenyUI.files', {
              workspaceId: workspace?.workspaceId,
              sessionId: fileSession,
            })}
            <div
              className={css.resize}
              role="separator"
              aria-orientation="vertical"
              aria-label={t('resize')}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight')
                  actions.setFiles(filesWidth + (e.key === 'ArrowLeft' ? -16 : 16))
              }}
              onPointerDown={(e) => {
                beginDrag(e, 'files', filesWidth)
              }}
              onPointerMove={onDrag}
              onPointerUp={() => {
                drag.current = null
              }}
              onLostPointerCapture={() => {
                drag.current = null
              }}
            />
          </aside>
        )}
        <main className={css.main} aria-busy={waitingForProject}>
          <div
            className={css.mainBody}
            data-project-pending={waitingForProject}
            aria-hidden={waitingForProject || undefined}
            ref={(element) => {
              element?.toggleAttribute('inert', waitingForProject)
            }}
          >
            {renderSlot('main', {}, { entryKey: panel ?? 'conversation' })}
          </div>
          {waitingForProject && (
            <div className={css.projectLoading} role="status">
              {t('loading')}
            </div>
          )}
        </main>
        <aside className={css.rightbar} style={{ width: reserveRight ? rightWidth : 0 }}>
          {renderSlot('rightbar', {
            width: rightWidth,
            viewportWidth: info.viewportWidth,
            canShow: canShowRight,
          })}
          {reserveRight && !info.rightbarFullscreen && rightWidth > 0 && (
            <div
              className={`${css.resize} ${css.rightResize}`}
              role="separator"
              aria-orientation="vertical"
              aria-label={t('resize')}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight')
                  actions.setRightbar(rightWidth + (e.key === 'ArrowLeft' ? 16 : -16))
              }}
              onPointerDown={(e) => {
                beginDrag(e, 'rightbar', rightWidth)
              }}
              onPointerMove={onDrag}
              onPointerUp={() => {
                drag.current = null
              }}
              onLostPointerCapture={() => {
                drag.current = null
              }}
            />
          )}
        </aside>
      </div>
      <div className={css.bottom}>{renderSlot('shell.bottom', {})}</div>
      <div className={css.overlays} data-shell-overlay>
        {renderSlot('shell.overlay', {})}
      </div>
      {appearance &&
        renderSlot('tokenyUI.themes', {
          onClose: () => {
            setAppearance(false)
            appearanceTrigger.current?.focus()
          },
        })}
      {error !== null && !adding && (
        <div className={css.toast} role="alert">
          {error}
          <button
            onClick={() => {
              setError(null)
            }}
          >
            {t('close')}
          </button>
        </div>
      )}
      {adding && (
        <div
          className={css.mask}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy) setAdding(false)
          }}
        >
          <section
            className={css.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tokeny-add-title"
            onKeyDown={(e) => {
              if (e.key === 'Escape' && !busy) setAdding(false)
            }}
          >
            <h2 id="tokeny-add-title">{t('add')}</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void run(async () => {
                  await props.addProject(path.trim())
                  if (live.current) {
                    setAdding(false)
                    setPath('')
                  }
                })
              }}
            >
              <label htmlFor="tokeny-path">{t('path')}</label>
              <input
                id="tokeny-path"
                autoFocus
                value={path}
                onChange={(e) => {
                  setPath(e.target.value)
                }}
                disabled={busy}
                required
              />
              <p>{t('pathHint')}</p>
              {error !== null && <p role="alert">{error}</p>}
              <div className={css.formButtons}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    void run(async () => {
                      const value = await props.browse()
                      if (live.current && value !== null) setPath(value)
                    })
                  }}
                >
                  {t('browse')}
                </button>
                <span />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setAdding(false)
                  }}
                >
                  {t('cancel')}
                </button>
                <button type="submit" disabled={busy || path.trim() === ''}>
                  {busy ? t('loading') : t('open')}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}
