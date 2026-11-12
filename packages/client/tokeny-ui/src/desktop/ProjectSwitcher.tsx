/** Searchable title-bar project selector for the desktop shell. */
import { useEffect, useRef, useState } from 'react'
import { Menu } from '@deepseek-ai/dsh-client-ui-primitives'
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { DesktopWorkspace, Translate } from './types.ts'
import css from './Sidebar.module.css'

/** Project selection and creation callbacks supplied by the root entry. */
export interface ProjectSwitcherProps {
  items: readonly DesktopWorkspace[]
  current: WorkspaceId | undefined
  disabled: boolean
  onSelect: (id: WorkspaceId) => void
  onAdd: () => void
  onNewSession: () => void
  t: Translate
}

/**
 * Render project search and the new-project/new-session menu.
 * @param props - Registered Workspaces and navigation callbacks.
 * @returns the centered project controls.
 */
export function ProjectSwitcher({
  items,
  current,
  disabled,
  onSelect,
  onAdd,
  onNewSession,
  t,
}: ProjectSwitcherProps) {
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const results = items.filter(item =>
    `${item.title} ${item.path}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  )
  const close = () => {
    setOpen(false)
    trigger.current?.focus()
  }
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => {
      document.removeEventListener('pointerdown', outside)
    }
  }, [open])
  return (
    <div ref={root} className={css.projectControls}>
      <button
        ref={trigger}
        type="button"
        className={css.projectButton}
        aria-label={t('project')}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          setOpen(!open)
          setQuery('')
          setHighlight(0)
        }}
      >
        <span>{items.find(item => item.workspaceId === current)?.title ?? t('choose')}</span>
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
          <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </button>
      <Menu
        open={creating}
        onClose={() => {
          setCreating(false)
        }}
        portal
        compact
        anchor={
          <button
            type="button"
            className={css.createButton}
            aria-label={t('create')}
            aria-haspopup="menu"
            aria-expanded={creating}
            disabled={disabled}
            onClick={() => {
              setCreating(!creating)
            }}
          >
            <span aria-hidden="true">＋</span>
            {t('create')}
          </button>
        }
        items={[
          { id: 'session', label: t('newSession') },
          { id: 'project', label: t('add') },
        ]}
        onSelect={(id) => {
          setCreating(false)
          if (id === 'project') onAdd()
          else onNewSession()
        }}
      />
      {open && (
        <div
          className={css.projectPopover}
          role="dialog"
          aria-label={t('project')}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              event.stopPropagation()
              close()
            }
          }}
        >
          <input
            autoFocus
            className={css.projectSearch}
            aria-label={t('searchProjects')}
            placeholder={t('searchProjects')}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setHighlight(0)
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault()
                setHighlight(index =>
                  Math.max(0, Math.min(results.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))),
                )
              }
              if (event.key === 'Enter' && results[highlight] !== undefined) {
                event.preventDefault()
                onSelect(results[highlight].workspaceId)
                close()
              }
            }}
          />
          <div className={css.projectResults} role="menu" aria-label={t('project')}>
            {results.map((item, index) => (
              <button
                key={item.workspaceId}
                type="button"
                role="menuitem"
                aria-label={item.title}
                className={css.projectOption}
                data-highlight={index === highlight}
                onMouseEnter={() => {
                  setHighlight(index)
                }}
                onClick={() => {
                  onSelect(item.workspaceId)
                  close()
                }}
              >
                <svg width="17" height="17" viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M2.5 5h5l2 2h8v9h-15z" fill="none" stroke="currentColor" strokeWidth="1.3" />
                </svg>
                <span>
                  <strong>{item.title}</strong>
                  <small title={item.path}>{item.path}</small>
                </span>
                {item.workspaceId === current && <span aria-hidden="true">✓</span>}
              </button>
            ))}
            {results.length === 0 && <p className={css.empty}>{t('noMatches')}</p>}
          </div>
          <button
            type="button"
            className={css.addProject}
            onClick={() => {
              close()
              onAdd()
            }}
          >
            <span aria-hidden="true">＋</span>
            {t('add')}
          </button>
        </div>
      )}
    </div>
  )
}
