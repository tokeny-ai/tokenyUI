/** Left workspace navigator composed from Harness's file-tree Factory and file Remote. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-client-connection/client'
import type { PropsLocale, PropsRuntime, PropsRenderFactories } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-api-workspace-files/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type {
  FileTreeInput,
  TreeEntry,
  TreeDirectoryState,
} from '@deepseek-ai/dsh-client-ui-sidebar-files/client'
import css from './FileExplorer.module.css'

const zh = {
  title: '工作空间',
  refresh: '刷新文件树',
  collapse: '折叠文件夹',
  noWorkspace: '选择项目后查看文件',
  noSession: '打开项目中的会话以查看文件',
  unavailable: '文件树插件未加载',
}
const en: Record<keyof typeof zh, string> = {
  title: 'Workspace',
  refresh: 'Refresh files',
  collapse: 'Collapse folders',
  noWorkspace: 'Select a project to browse files',
  noSession: 'Open a session in this project to browse files',
  unavailable: 'The file tree plugin is unavailable',
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Left workspace file navigator labels. */
    'tokenyUI.files': keyof typeof zh
  }
  interface SlotMap {
    /** Workspace navigator beside the conversation. */
    'tokenyUI.files': {
      kind: 'single'
      scope: 'root'
      owner: { workspaceId?: string; sessionId?: SessionId }
    }
  }
}

type Listing = {
  entries: readonly { name: string; type: 'directory' | 'file' | 'other' }[]
  truncated: boolean
}
type FilesInjected = {
  listDirectory: (id: SessionId, path: string, signal: AbortSignal) => Promise<Listing>
  openFile: (id: SessionId, path: string) => void
}
type FilesProps = PropsRuntime<'tokenyUI.files'> &
  PropsRenderFactories &
  PropsLocale<'tokenyUI.files'> &
  FilesInjected
type WorkspaceTreeProps = Pick<FilesProps, 'renderFactorySlot' | 't' | 'listDirectory' | 'openFile'> & {
  sessionId: SessionId
  root: string
}
type Level = { entries: Listing['entries']; state: TreeDirectoryState }

function RefreshIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M13 6a5 5 0 1 0 .1 3M13 2.5V6H9.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CollapseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="5" y="2.5" width="8.5" height="8.5" rx="1.5" stroke="currentColor" />
      <path d="M2.5 5v7a1.5 1.5 0 0 0 1.5 1.5h7M7.5 6.75h3.5" stroke="currentColor" strokeLinecap="round" />
    </svg>
  )
}

function WorkspaceTree({
  sessionId,
  root,
  t,
  listDirectory,
  openFile,
  renderFactorySlot,
}: WorkspaceTreeProps) {
  const treeRoot = root.replace(/\/$/, '')
  const [levels, setLevels] = useState<Partial<Record<string, Level>>>({})
  const [expanded, setExpanded] = useState<readonly string[]>([])
  const [current, setCurrent] = useState<string>()
  const pending = useRef(new Map<string, AbortController>())
  const active = useRef(true)
  const list = useCallback(
    (path: string) => {
      pending.current.get(path)?.abort()
      const request = new AbortController()
      pending.current.set(path, request)
      setLevels(previous => ({
        ...previous,
        [path]: {
          entries: previous[path]?.entries ?? [],
          state: previous[path] === undefined ? { loading: true } : {},
        },
      }))
      void listDirectory(sessionId, path === treeRoot ? root : path, request.signal).then(
        (value) => {
          if (!active.current || request.signal.aborted) return
          pending.current.delete(path)
          const prefix = `${path}/`
          const children = new Set(
            value.entries.filter(entry => entry.type === 'directory').map(entry => entry.name),
          )
          const removed = (child: string) =>
            child.startsWith(prefix) && !children.has(child.slice(prefix.length).split('/')[0])
          for (const [child, operation] of pending.current) {
            if (!removed(child)) continue
            operation.abort()
            pending.current.delete(child)
          }
          setLevels(previous => ({
            ...Object.fromEntries(Object.entries(previous).filter(([child]) => !removed(child))),
            [path]: { entries: value.entries, state: value.truncated ? { truncated: true } : {} },
          }))
          setExpanded(previous => previous.filter(child => !removed(child)))
        },
        (error: unknown) => {
          if (!active.current || request.signal.aborted) return
          pending.current.delete(path)
          setLevels(previous => ({
            ...previous,
            [path]: {
              entries: previous[path]?.entries ?? [],
              state: { failure: error instanceof Error ? error.message : String(error) },
            },
          }))
        },
      )
    },
    [sessionId, root, treeRoot, listDirectory],
  )
  useEffect(() => {
    active.current = true
    list(treeRoot)
    return () => {
      active.current = false
      for (const request of pending.current.values()) request.abort()
      pending.current.clear()
    }
  }, [treeRoot, list])

  const entries = useMemo(
    () =>
      Object.entries(levels).flatMap(([path, level]) =>
        level?.entries.map(entry => ({
          path: `${path.replace(/\/$/, '')}/${entry.name}`,
          name: entry.name,
          meta: { kind: entry.type },
        })) ?? [],
      ),
    [levels],
  )
  const directories = useMemo(
    () => Object.fromEntries(
      Object.entries(levels).flatMap(([path, level]) => level === undefined ? [] : [[path, level.state]]),
    ),
    [levels],
  )
  const onToggle = useCallback(
    (entry: TreeEntry, open: boolean) => {
      setExpanded(previous =>
        open
          ? [...previous.filter(path => path !== entry.path), entry.path]
          : previous.filter(path => path !== entry.path),
      )
      if (open) list(entry.path)
    },
    [list],
  )
  const onOpen = useCallback(
    (entry: TreeEntry) => {
      setCurrent(entry.path)
      openFile(sessionId, entry.path)
    },
    [openFile, sessionId],
  )
  const input: FileTreeInput = { root: treeRoot, entries, directories, expanded, current, onToggle, onOpen }

  return (
    <section className={css.navigator} data-tokeny-files>
      <header className={css.header}>
        <span title={root}>{t('title')}</span>
        <button
          type="button"
          title={t('refresh')}
          aria-label={t('refresh')}
          onClick={() => {
            list(treeRoot)
            for (const path of expanded) list(path)
          }}
        >
          <RefreshIcon />
        </button>
        <button
          type="button"
          title={t('collapse')}
          aria-label={t('collapse')}
          onClick={() => {
            setExpanded([])
          }}
        >
          <CollapseIcon />
        </button>
      </header>
      <div className={css.path} title={root}>
        {root.split('/').filter(Boolean).at(-1) ?? root}
      </div>
      <div className={css.tree} aria-label={t('title')}>
        {renderFactorySlot('sidebar.files.tree', input, {
          fallback: <p className={css.empty}>{t('unavailable')}</p>,
        })}
      </div>
    </section>
  )
}

function FileExplorer(props: FilesProps) {
  const sessions = props.useSessions(state => state)
  const session = props.sessionId === undefined ? undefined : sessions.byId[props.sessionId]
  const root = session?.cwd?.replace(/\\/g, '/')
  if (session === undefined || root === undefined || root === '')
    return (
      <section className={css.navigator}>
        <header className={css.header}>{props.t('title')}</header>
        <p className={css.empty}>{props.t(props.workspaceId === undefined ? 'noWorkspace' : 'noSession')}</p>
      </section>
    )
  return (
    <WorkspaceTree
      key={`${session.id}:${root}`}
      sessionId={session.id}
      root={root}
      t={props.t}
      renderFactorySlot={props.renderFactorySlot}
      listDirectory={props.listDirectory}
      openFile={props.openFile}
    />
  )
}

/**
 * Register the navigator using native directory reads and the existing preview panel.
 * @param ctx - Browser context with file Remote and right-sidebar navigation.
 */
export function registerFiles(ctx: Context): void {
  ctx.effect(() => ctx.locale.register('tokenyUI.files', { zh, en }), 'tokenyUI: file labels')
  const callbacks: FilesInjected = {
    listDirectory: async (id, path, signal) => {
      const result = await ctx.remote.workspaceFiles.list(id, path, signal)
      if (!result.ok) throw new Error(result.error.message)
      return result.value
    },
    openFile: (id, path) => {
      const encoded = path
        .split('/')
        .map(segment => encodeURIComponent(segment).replace(/%3A/gi, ':'))
        .join('/')
      const address = `dsh-resource://file/session/${encodeURIComponent(id)}/${encoded}`
      ctx.sidebarRight.openResource(address)
    },
  }
  ctx.effect(
    () =>
      ctx.slots.inject('tokenyUI.files', () =>
        ctx.slots.register(
          { name: 'tokenyUI.files', locale: 'tokenyUI.files', inject: () => callbacks },
          FileExplorer,
        ),
      ),
    'tokenyUI: left file navigator',
  )
}
