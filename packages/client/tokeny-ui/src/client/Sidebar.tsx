/** Activity rail and the file/session panel, preserving Harness's sidebar extension slots. */
import { useState } from 'react'
import {
  IconFolderClose16,
  IconNewChatOutline16,
  IconPlusOutline16,
  Modal,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { SidebarProps } from './contract.ts'
import { activeWorkspace } from './contract.ts'
import { ProjectSessions } from './ProjectSessions.tsx'
import css from './Shell.module.css'

/**
 * Render Tokeny's persistent activity rail and collapsible workspace panel.
 * @param props - Sidebar slot, store, runtime, and injected action shares.
 * @returns navigation and the original settings/plugin entry points.
 */
export function Sidebar({
  collapsed,
  useStore,
  useSessions,
  useWorkspaces,
  actions,
  renderSlot,
  startSession,
  openSession,
  archiveSession,
  renameSession,
  t,
}: SidebarProps) {
  const panel = useStore(s => s.panel)
  const workspaces = useWorkspaces(s => s)
  const sessions = useSessions(s => s)
  const workspace = activeWorkspace(workspaces, sessions)
  const [managing, setManaging] = useState(false)
  return (
    <div className={css.sidebar}>
      <nav className={css.rail} aria-label="Tokeny">
        <button
          className={css.railButton}
          data-active={panel === 'sessions' && !collapsed}
          title={t('sessions')}
          aria-label={t('sessions')}
          aria-pressed={panel === 'sessions' && !collapsed}
          onClick={() => {
            actions.showPanel('sessions')
          }}
        >
          <IconNewChatOutline16 size={22} />
        </button>
        <button
          className={css.railButton}
          data-active={panel === 'files' && !collapsed}
          title={t('files')}
          aria-label={t('files')}
          aria-pressed={panel === 'files' && !collapsed}
          onClick={() => {
            actions.showPanel('files')
          }}
        >
          <IconFolderClose16 size={22} />
        </button>
        <div className={css.railDivider} />
        <button
          className={css.railButton}
          title={t('newSession')}
          aria-label={t('newSession')}
          onClick={() => {
            startSession(workspace?.workspaceId)
          }}
        >
          <IconPlusOutline16 size={20} />
        </button>
        <div className={css.railBottom}>
          {renderSlot('sidebar.footer.action', { wide: false })}
          <div role="group" aria-label={t('settings')} title={t('settings')}>
            {renderSlot('sidebar.settings', { wide: false })}
          </div>
        </div>
      </nav>
      <section className={css.workspacePanel} hidden={collapsed}>
        <div className={css.panelTabs} role="tablist" aria-label={t('workspace')}>
          <button
            role="tab"
            id="tokeny-files-tab"
            aria-controls="tokeny-files-panel"
            aria-selected={panel === 'files'}
            onClick={() => {
              actions.showPanel('files')
            }}
          >
            {t('files')}
          </button>
          <button
            role="tab"
            id="tokeny-sessions-tab"
            aria-controls="tokeny-sessions-panel"
            aria-selected={panel === 'sessions'}
            onClick={() => {
              actions.showPanel('sessions')
            }}
          >
            {t('sessions')}
          </button>
          <span className={css.tabSpacer} />
          <button
            className={css.iconButton}
            title={t('newSession')}
            aria-label={t('newSession')}
            onClick={() => {
              startSession(workspace?.workspaceId)
            }}
          >
            <IconPlusOutline16 />
          </button>
        </div>
        <div
          className={css.panelBody}
          id="tokeny-files-panel"
          role="tabpanel"
          aria-labelledby="tokeny-files-tab"
          hidden={panel !== 'files'}
        >
          {renderSlot('tokenyUI.sidebar.files', { workspaceId: workspace?.workspaceId })}
        </div>
        <div
          className={css.panelBody}
          id="tokeny-sessions-panel"
          role="tabpanel"
          aria-labelledby="tokeny-sessions-tab"
          hidden={panel !== 'sessions'}
        >
          <ProjectSessions
            key={workspace?.workspaceId ?? ''}
            workspace={workspace}
            sessions={sessions}
            archived={workspaces.archivedSessionIds}
            openSession={openSession}
            archiveSession={archiveSession}
            renameSession={renameSession}
            t={t}
          />
          <button
            className={css.manageProjects}
            onClick={() => {
              setManaging(true)
            }}
          >
            {t('manage')}
          </button>
        </div>
        {workspace !== undefined && (
          <div className={css.workspacePath} title={workspace.path}>
            {workspace.path}
          </div>
        )}
      </section>
      <Modal
        open={managing}
        onClose={() => {
          setManaging(false)
        }}
        title={t('manage')}
        closeLabel={t('close')}
      >
        <div className={css.management}>
          {renderSlot('sidebar.workspaces', {
            wide: true,
            expandSidebar: () => {
              actions.showPanel('sessions')
            },
          })}
        </div>
      </Modal>
    </div>
  )
}
