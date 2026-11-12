/** Tokeny-style title bar and workspace columns around Harness's conversation slots. */
import { useEffect, useRef, useState } from 'react'
import { FishLogo, IconPanelLeftOutline16, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ShellProps } from './contract.ts'
import { activeWorkspace } from './contract.ts'
import { ProjectSwitcher } from './ProjectSwitcher.tsx'
import css from './Shell.module.css'

/**
 * Render the replaceable root with a centered project switcher and persistent conversation.
 * @param props - Framework-derived shell props.
 * @returns the complete application frame.
 */
export function Shell(props: ShellProps) {
  const { useStore, useSessions, useWorkspaces, actions, renderSlot, t } = props
  const state = useStore(s => s)
  const sessions = useSessions(s => s)
  const workspaces = useWorkspaces(s => s)
  const workspace = activeWorkspace(workspaces, sessions)
  const [adding, setAdding] = useState(false)
  const [path, setPath] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const drag = useRef<{ x: number; width: number } | null>(null)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  useEffect(() => {
    actions.closeDetails()
  }, [sessions.current, actions])
  useEffect(() => {
    actions.closeFile()
  }, [workspace?.workspaceId, actions])

  const run = async (operation: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await operation()
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      if (mounted.current) setBusy(false)
    }
  }
  const file = state.file?.workspaceId === workspace?.workspaceId ? state.file : null
  const showDetails =
    state.details && sessions.current !== undefined && sessions.byId[sessions.current]?.blank === false
  const panelWidth = state.expanded ? state.width : 0
  return (
    <div className={css.frame} data-tokeny-ui data-expanded={state.expanded}>
      <header className={css.titlebar}>
        <div className={css.brand} role="img" aria-label="DeepSeek Harness">
          <FishLogo size={24} />
        </div>
        <button
          className={css.iconButton}
          aria-label={t('togglePanel')}
          title={t('togglePanel')}
          aria-expanded={state.expanded}
          onClick={actions.toggleSidebar}
        >
          <IconPanelLeftOutline16 />
        </button>
        <div className={css.projectSwitcher}>
          <ProjectSwitcher
            items={workspaces.items}
            current={workspace?.workspaceId}
            disabled={busy || !workspaces.baselinesReady}
            t={t}
            onSelect={(id) => {
              void run(() => props.selectProject(id))
            }}
            onAdd={() => {
              setAdding(true)
              setError(null)
            }}
            onNewSession={() => {
              props.startSession(workspace?.workspaceId)
            }}
          />
        </div>
        <span className={css.hostLabel}>{t('connection')}</span>
      </header>
      <div className={css.workbench}>
        <div className={css.navigation} style={{ width: 56 + panelWidth }}>
          {renderSlot('sidebar', { collapsed: !state.expanded, width: 56 + panelWidth })}
          {state.expanded && (
            <div
              className={css.resize}
              role="separator"
              tabIndex={0}
              aria-orientation="vertical"
              aria-label={t('resize')}
              aria-valuemin={340}
              aria-valuemax={720}
              aria-valuenow={state.width}
              onKeyDown={(event) => {
                if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                  event.preventDefault()
                  actions.resize(state.width + (event.key === 'ArrowLeft' ? -16 : 16))
                }
              }}
              onPointerDown={(event) => {
                drag.current = { x: event.clientX, width: state.width }
                event.currentTarget.setPointerCapture(event.pointerId)
              }}
              onPointerMove={(event) => {
                if (drag.current !== null) actions.resize(drag.current.width + event.clientX - drag.current.x)
              }}
              onPointerUp={(event) => {
                drag.current = null
                event.currentTarget.releasePointerCapture(event.pointerId)
              }}
              onLostPointerCapture={() => {
                drag.current = null
              }}
            />
          )}
        </div>
        <main className={css.conversation}>{renderSlot('conversation', {})}</main>
        <aside className={css.details} data-open={showDetails} aria-hidden={!showDetails}>
          {renderSlot('details', {})}
        </aside>
        {file !== null && <aside className={css.preview}>{renderSlot('tokenyUI.preview', file)}</aside>}
      </div>
      <div className={css.overlays}>{renderSlot('shell.overlay', {})}</div>
      {error !== null && !adding && (
        <div className={css.errorToast} role="alert">
          <span>{error}</span>
          <button
            onClick={() => {
              setError(null)
            }}
          >
            {t('close')}
          </button>
        </div>
      )}
      <Modal
        open={adding}
        onClose={() => {
          if (!busy) setAdding(false)
        }}
        title={t('add')}
        closeLabel={t('close')}
      >
        <form
          className={css.projectForm}
          onSubmit={(event) => {
            event.preventDefault()
            void run(async () => {
              await props.addProject(path.trim())
              if (mounted.current) {
                setAdding(false)
                setPath('')
              }
            })
          }}
        >
          <label htmlFor="tokeny-project-path">{t('path')}</label>
          <input
            id="tokeny-project-path"
            autoFocus
            value={path}
            onChange={(event) => {
              setPath(event.target.value)
            }}
            disabled={busy}
            required
          />
          <p>{t('pathHint')}</p>
          {error !== null && (
            <p className={css.error} role="alert">
              {error}
            </p>
          )}
          <div className={css.formActions}>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                void run(async () => {
                  const picked = await props.browse()
                  if (mounted.current && picked !== null) setPath(picked)
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
            <button className={css.primary} type="submit" disabled={busy || path.trim() === ''}>
              {busy ? t('loading') : t('open')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
