/** Lazy workspace tree; each expanded directory owns and cancels its own request. */
import { useEffect, useState } from 'react'
import {
  IconChevronDownOutline14,
  IconChevronRightOutline14,
  IconCodeOutline16,
  IconFolderClose16,
  IconFolderOpen16,
  IconPanelLeftOutline16,
  IconRefreshOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { DirectoryResult } from '../protocol.ts'
import type { FilesProps } from './contract.ts'
import css from './Shell.module.css'

type DirectoryProps = Pick<FilesProps, 'listFiles' | 't'> & {
  workspaceId: NonNullable<FilesProps['workspaceId']>
  path: string
  depth: number
  selected: string | undefined
  onSelect: (path: string) => void
  expanded: readonly string[]
  toggleFolder: (path: string) => void
}

function TreeEntry(props: DirectoryProps & { entry: DirectoryResult['entries'][number] }) {
  const { entry, t, depth, selected, onSelect } = props
  const expanded = props.expanded.includes(entry.path)
  const folder = entry.kind === 'directory'
  const disabled = entry.kind !== 'directory' && entry.kind !== 'file'
  const activate = () => {
    if (folder) props.toggleFolder(entry.path)
    else if (!disabled) onSelect(entry.path)
  }
  return (
    <div
      role="treeitem"
      aria-label={entry.name}
      aria-expanded={folder ? expanded : undefined}
      aria-selected={selected === entry.path}
      aria-disabled={disabled || undefined}
    >
      <div
        className={css.treeRow}
        tabIndex={0}
        title={disabled ? t('unsupported') : entry.path}
        style={{ paddingLeft: 10 + depth * 16 }}
        data-selected={selected === entry.path}
        data-disabled={disabled}
        onClick={activate}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            activate()
          }
          if (folder && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
            event.preventDefault()
            if (expanded !== (event.key === 'ArrowRight')) props.toggleFolder(entry.path)
          }
        }}
      >
        <span className={css.disclosure}>
          {folder && (expanded ? <IconChevronDownOutline14 /> : <IconChevronRightOutline14 />)}
        </span>
        {folder ? expanded ? <IconFolderOpen16 /> : <IconFolderClose16 /> : <IconCodeOutline16 />}
        <span>{entry.name}</span>
      </div>
      {expanded && (
        <div role="group">
          <Directory {...props} path={entry.path} depth={depth + 1} />
        </div>
      )}
    </div>
  )
}

function Directory(props: DirectoryProps) {
  const { workspaceId, path, listFiles, t } = props
  const [result, setResult] = useState<DirectoryResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const request = new AbortController()
    setResult(null)
    setError(null)
    void listFiles(workspaceId, path, request.signal).then(
      (value) => {
        if (!request.signal.aborted) setResult(value)
      },
      (cause: unknown) => {
        if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : String(cause))
      },
    )
    return () => {
      request.abort()
    }
  }, [workspaceId, path, listFiles, retry])
  if (error !== null)
    return (
      <div className={css.treeMessage} role="alert">
        {error}
        <button
          onClick={() => {
            setRetry(retry + 1)
          }}
        >
          {t('retry')}
        </button>
      </div>
    )
  if (result === null)
    return (
      <p className={css.treeMessage} role="status">
        {t('loading')}
      </p>
    )
  return (
    <>
      {result.entries.length === 0 && <p className={css.treeMessage}>{t('empty')}</p>}
      {result.entries.map(entry => (
        <TreeEntry key={entry.path} {...props} entry={entry} />
      ))}
      {result.truncated && (
        <p className={css.treeMessage} role="status">
          {t('truncated')}
        </p>
      )}
    </>
  )
}

/**
 * Browse the selected project's real directories, keeping stale requests out of subsequent projects.
 * @param props - Files slot shares and the read-only listing callback.
 * @returns the lazy tree with refresh and collapse controls.
 */
export function FileExplorer({ workspaceId, listFiles, useStore, actions, t }: FilesProps) {
  const selection = useStore(s => s.file)
  const folders = useStore(s => s.folders)
  const [revision, setRevision] = useState(0)
  if (workspaceId === undefined)
    return (
      <div className={css.emptyFiles}>
        <IconFolderOpen16 size={28} />
        <p>{t('noProject')}</p>
      </div>
    )
  return (
    <div className={css.explorer}>
      <div className={css.fileToolbar}>
        <span>{t('workspace')}</span>
        <button
          className={css.iconButton}
          aria-label={t('refresh')}
          title={t('refresh')}
          onClick={() => {
            setRevision(revision + 1)
          }}
        >
          <IconRefreshOutline16 />
        </button>
        <button
          className={css.iconButton}
          aria-label={t('collapse')}
          title={t('collapse')}
          onClick={() => {
            actions.collapseFolders(workspaceId)
          }}
        >
          <IconPanelLeftOutline16 />
        </button>
      </div>
      <div
        className={css.tree}
        role="tree"
        aria-label={t('files')}
        onKeyDown={(event) => {
          if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
          const rows = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[tabindex="0"]'))
          const index = rows.indexOf(document.activeElement as HTMLElement)
          const next =
            event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? rows.length - 1
                : index + (event.key === 'ArrowDown' ? 1 : -1)
          if (rows[next] !== undefined) {
            event.preventDefault()
            rows[next].focus()
          }
        }}
      >
        <Directory
          key={`${workspaceId}:${revision}`}
          workspaceId={workspaceId}
          path=""
          depth={0}
          listFiles={listFiles}
          t={t}
          selected={selection?.workspaceId === workspaceId ? selection.path : undefined}
          onSelect={(path) => {
            actions.selectFile({ workspaceId, path })
          }}
          expanded={folders[workspaceId] ?? []}
          toggleFolder={(path) => {
            actions.toggleFolder(workspaceId, path)
          }}
        />
      </div>
    </div>
  )
}
