/** Data used by the desktop shell's project controls. */
import type { TokenyKey } from '../client/locales.ts'
import type { SessionListState, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceSnapshot, WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Desktop shell and project selector copy. */
    tokenyUI: TokenyKey
  }
}

/** Workspace metadata published by the desktop Workspace Controller. */
export type DesktopWorkspace = WorkspaceView

/** Session metadata needed to derive the main-view project. */
export type DesktopSessionSummary = SessionSummary

/** Workspace hook snapshot, including its startup readiness. */
export type DesktopWorkspaceState = WorkspaceSnapshot

/** Session hook snapshot, including local main-view references. */
export type DesktopSessionState = SessionListState

/** Localized shell labels supplied by the framework locale seat. */
export type Translate = (key: TokenyKey) => string

/** Native renderer selection; reference counts may temporarily retain two main views. */
export type DesktopSelectionSources = {
  mainSession: HostObservable<string | undefined>
}
