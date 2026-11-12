/** Current-project conversation list with runtime-owned navigation and mutations. */
import { useState } from 'react'
import { IconEllipsisOutline16, IconNewChatOutline16, Menu, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SessionId, SessionListState, WorkspaceView } from '@deepseek-ai/dsh-client-runtime/client'
import type { SidebarProps } from './contract.ts'
import css from './Shell.module.css'

type Props = Pick<SidebarProps, 'openSession' | 'archiveSession' | 'renameSession' | 't'> & {
  workspace: WorkspaceView | undefined
  sessions: SessionListState
  archived: readonly SessionId[]
}

/**
 * Show the selected project's sessions, with search, rename, and archive controls.
 * @param props - Runtime snapshots and injected session callbacks.
 * @returns current-project navigation.
 */
export function ProjectSessions({
  workspace,
  sessions,
  archived,
  openSession,
  renameSession,
  archiveSession,
  t,
}: Props) {
  const [query, setQuery] = useState('')
  const [menu, setMenu] = useState<SessionId | null>(null)
  const [editing, setEditing] = useState<SessionId | null>(null)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rows = (workspace?.sessionIds ?? [])
    .map(id => sessions.byId[id])
    .filter(row => row !== undefined)
    .filter(row => !archived.includes(row.id) && (!row.blank || row.id === sessions.current))
    .filter(row =>
      (row.blank ? t('newSession') : row.displayTitle).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
    )
    .sort((a, b) => b.updatedAt - a.updatedAt)
  const run = async (operation: () => Promise<void>) => {
    setError(null)
    setBusy(true)
    try {
      await operation()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className={css.sessions}>
      <input
        className={css.sessionSearch}
        aria-label={t('searchSessions')}
        placeholder={t('searchSessions')}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
        }}
      />
      {error !== null && (
        <p className={css.treeMessage} role="alert">
          {error}
        </p>
      )}
      <div className={css.sessionList} role="list" aria-label={t('sessions')}>
        {rows.map(row => (
          <div key={row.id} role="listitem" className={css.sessionRow} data-active={row.id === sessions.current}>
            <button
              className={css.sessionLink}
              aria-current={row.id === sessions.current ? 'page' : undefined}
              onClick={() => {
                openSession(row.id)
              }}
            >
              <IconNewChatOutline16 />
              <span>{row.blank ? t('newSession') : row.displayTitle}</span>
              {row.running && <span className={css.runningDot} role="status" aria-label={t('running')} />}
            </button>
            <Menu
              open={menu === row.id}
              onClose={() => {
                setMenu(null)
              }}
              portal
              compact
              align="end"
              anchor={
                <button
                  className={css.iconButton}
                  disabled={busy}
                  aria-label={t('sessionActions')}
                  aria-haspopup="menu"
                  aria-expanded={menu === row.id}
                  onClick={() => {
                    setMenu(menu === row.id ? null : row.id)
                  }}
                >
                  <IconEllipsisOutline16 />
                </button>
              }
              items={[
                { id: 'rename', label: t('rename') },
                { id: 'archive', label: t('archive') },
              ]}
              onSelect={(id) => {
                setMenu(null)
                if (id === 'rename') {
                  setTitle(row.displayTitle)
                  setEditing(row.id)
                } else void run(() => archiveSession(row.id))
              }}
            />
          </div>
        ))}
        {rows.length === 0 && <p className={css.treeMessage}>{query === '' ? t('noSessions') : t('noMatches')}</p>}
      </div>
      <Modal
        open={editing !== null}
        onClose={() => {
          if (!busy) setEditing(null)
        }}
        title={t('rename')}
        closeLabel={t('close')}
      >
        <form
          className={css.projectForm}
          onSubmit={(event) => {
            event.preventDefault()
            const id = editing
            if (id !== null)
              void run(async () => {
                await renameSession(id, title.trim())
                setEditing(null)
              })
          }}
        >
          <label htmlFor="tokeny-session-title">{t('sessionName')}</label>
          <input
            id="tokeny-session-title"
            autoFocus
            value={title}
            onChange={(event) => {
              setTitle(event.target.value)
            }}
            disabled={busy}
          />
          <div className={css.formActions}>
            <span />
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setEditing(null)
              }}
            >
              {t('cancel')}
            </button>
            <button type="submit" className={css.primary} disabled={busy || title.trim() === ''}>
              {t('save')}
            </button>
          </div>
          {error !== null && (
            <p className={css.error} role="alert">
              {error}
            </p>
          )}
        </form>
      </Modal>
    </div>
  )
}
