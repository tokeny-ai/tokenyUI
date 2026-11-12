/** Searchable project popover matching the centered Tokeny title-bar controls. */
import { useEffect, useRef, useState } from 'react'
import {
  IconCheckOutline16,
  IconChevronDownOutline14,
  IconFolderClose16,
  IconPlusOutline16,
  Menu,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-client-runtime/client'
import type { ShellProps } from './contract.ts'
import css from './Shell.module.css'

type ProjectSwitcherProps = {
  items: readonly WorkspaceView[]
  current: WorkspaceId | undefined
  disabled: boolean
  onSelect: (id: WorkspaceId) => void
  onAdd: () => void
  onNewSession: () => void
  t: ShellProps['t']
}

/**
 * Search and switch projects without changing the runtime's workspace order.
 * @param props - Project data and the root's action callbacks.
 * @returns the project switcher and creation menu.
 */
export function ProjectSwitcher({ items, current, disabled, onSelect, onAdd, onNewSession, t }: ProjectSwitcherProps) {
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
        <IconChevronDownOutline14 />
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
            className={css.createButton}
            aria-label={t('create')}
            aria-haspopup="menu"
            aria-expanded={creating}
            disabled={disabled}
            onClick={() => {
              setCreating(!creating)
            }}
          >
            <IconPlusOutline16 />
            <span>{t('create')}</span>
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
                <IconFolderClose16 />
                <span>
                  <strong>{item.title}</strong>
                  <small title={item.path}>{item.path}</small>
                </span>
                {item.workspaceId === current && <IconCheckOutline16 />}
              </button>
            ))}
            {results.length === 0 && <p className={css.treeMessage}>{t('noMatches')}</p>}
          </div>
          <button
            className={css.addProject}
            role="menuitem"
            onClick={() => {
              close()
              onAdd()
            }}
          >
            <IconPlusOutline16 />
            {t('add')}
          </button>
        </div>
      )}
    </div>
  )
}
