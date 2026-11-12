/** Panel preferences and file selection shared by the shell and navigation. */
import { defineStore, type EngineStoreHandle, type WorkspaceId } from '@deepseek-ai/dsh-client-runtime/client'

/** A preview selection belongs to exactly one workspace. */
export type FileSelection = { workspaceId: WorkspaceId; path: string }
type ShellState = {
  panel: 'files' | 'sessions'
  expanded: boolean
  width: number
  details: boolean
  file: FileSelection | null
  folders: Record<string, string[]>
}
type ShellActions = {
  toggleSidebar: (state: ShellState) => void
  showPanel: (state: ShellState, panel: ShellState['panel']) => void
  resize: (state: ShellState, width: number) => void
  openDetails: (state: ShellState) => void
  closeDetails: (state: ShellState) => void
  selectFile: (state: ShellState, selection: FileSelection) => void
  closeFile: (state: ShellState) => void
  toggleFolder: (state: ShellState, workspaceId: WorkspaceId, path: string) => void
  collapseFolders: (state: ShellState, workspaceId: WorkspaceId) => void
}

/**
 * Create one plugin-lifetime shell store; sessions remain owned by the Harness runtime.
 * @returns a store handle to share between root and sidebar registrations.
 */
export function createShellStore(): EngineStoreHandle<ShellState, ShellActions> {
  return defineStore({
    persist: 'tokenyUI.shell.v1',
    init: (): ShellState => ({ panel: 'files', expanded: true, width: 360, details: false, file: null, folders: {} }),
    actions: {
      toggleSidebar: (s) => {
        s.expanded = !s.expanded
      },
      showPanel: (s, panel: ShellState['panel']) => {
        s.panel = panel
        s.expanded = true
      },
      resize: (s, width: number) => {
        s.width = Math.min(720, Math.max(340, width))
      },
      openDetails: (s) => {
        s.details = true
        s.file = null
      },
      closeDetails: (s) => {
        s.details = false
      },
      selectFile: (s, selection: FileSelection) => {
        s.file = selection
        s.details = false
      },
      closeFile: (s) => {
        s.file = null
      },
      toggleFolder: (s, workspaceId: WorkspaceId, path: string) => {
        const paths = s.folders[workspaceId] ?? []
        s.folders[workspaceId] = paths.includes(path) ? paths.filter(p => p !== path) : [...paths, path]
      },
      collapseFolders: (s, workspaceId: WorkspaceId) => {
        s.folders[workspaceId] = []
      },
    },
  })
}
