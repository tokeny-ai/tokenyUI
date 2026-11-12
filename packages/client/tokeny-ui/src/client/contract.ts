/** Props derived from Harness slots, locale, runtime, and the shared shell store. */
import type { PropsLocale, PropsRenderSlots, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  WorkspaceId,
  WorkspaceView,
  SessionId,
  SessionListState,
  WorkspaceListState,
} from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { DirectoryResult, PreviewResult } from '../protocol.ts'
import type { createShellStore, FileSelection } from './stores.ts'
import type { TokenyKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Tokeny shell and file explorer strings. */
    tokenyUI: TokenyKey
  }
  interface SlotMap {
    /** File explorer under the replacement sidebar. */
    'tokenyUI.sidebar.files': { kind: 'single'; scope: 'root'; owner: { workspaceId: WorkspaceId | undefined } }
    /** Read-only preview beside the conversation. */
    'tokenyUI.preview': { kind: 'single'; scope: 'root'; owner: FileSelection }
  }
}

/** Shell callbacks resolved by the plugin's Cordis apply closure. */
export type ShellInjected = {
  selectProject: (id: WorkspaceId) => Promise<void>
  addProject: (path: string) => Promise<void>
  browse: () => Promise<string | null>
  startSession: (id?: WorkspaceId) => void
}
/** Current-project session actions share the runtime's authoritative selection. */
export type SessionsInjected = {
  openSession: (id: SessionId) => void
  archiveSession: (id: SessionId) => Promise<void>
  renameSession: (id: SessionId, title: string) => Promise<void>
}
/** File operations use the plugin's own RPC channel. */
export type FilesInjected = {
  listFiles: (workspaceId: WorkspaceId, path: string, signal: AbortSignal) => Promise<DirectoryResult>
  readFile: (workspaceId: WorkspaceId, path: string, signal: AbortSignal) => Promise<PreviewResult>
}
/** Shared store and locale seats. */
export type ShellSeats = PropsStore<ReturnType<typeof createShellStore>> & PropsLocale<'tokenyUI'>
/** Root props: runtime, declared child slots, store, locale, and injected actions. */
export type ShellProps = PropsRuntime<'root'> &
  PropsRenderSlots<'sidebar' | 'conversation' | 'details' | 'shell.overlay' | 'tokenyUI.preview'> &
  ShellSeats &
  ShellInjected
/** Sidebar props preserve the original workspace/settings extension points. */
export type SidebarProps = PropsRuntime<'sidebar'> &
  PropsRenderSlots<'sidebar.workspaces' | 'sidebar.settings' | 'sidebar.footer.action' | 'tokenyUI.sidebar.files'> &
  ShellSeats &
  Pick<ShellInjected, 'startSession'> &
  SessionsInjected
/** File explorer props. */
export type FilesProps = PropsRuntime<'tokenyUI.sidebar.files'> & ShellSeats & Pick<FilesInjected, 'listFiles'>
/** Read-only preview props. */
export type PreviewProps = PropsRuntime<'tokenyUI.preview'> & ShellSeats & Pick<FilesInjected, 'readFile'>

/**
 * Derive the active project from authoritative session membership or the runtime's recent project.
 * @param workspaces - Workspace hook snapshot.
 * @param sessions - Session hook snapshot.
 * @returns the current registered workspace, if any.
 */
export function activeWorkspace(workspaces: WorkspaceListState, sessions: SessionListState): WorkspaceView | undefined {
  const current = sessions.current
  if (current !== undefined) return workspaces.items.find(w => w.sessionIds.includes(current))
  return workspaces.items.find(w => w.workspaceId === workspaces.recentWorkspaceId)
}
