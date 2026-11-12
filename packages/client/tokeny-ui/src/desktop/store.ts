/** Desktop shell geometry; session state remains in Harness controllers. */
import { defineStore } from '@deepseek-ai/dsh-client-store'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client'

/** Create the root store shared with the layout service. */
export function createDesktopStore() {
  return defineStore({
    init: () => ({
      panelInfo: { activePanelId: null as MainPanelId | null },
      workspaceInfo: { target: null as WorkspaceId | null, confirmed: null as WorkspaceId | null },
      layoutInfo: {
        sidebar: 230,
        files: 250,
        filesExpanded: true,
        viewportWidth: window.innerWidth,
        rightbar: null as number | null,
        rightbarShown: false,
        rightbarTrack: false,
        rightbarFullscreen: false,
      },
    }),
    actions: {
      setWorkspaceTarget: (s, id: WorkspaceId | null) => {
        s.workspaceInfo.target = id
      },
      confirmWorkspace: (s, id: WorkspaceId) => {
        s.workspaceInfo.confirmed = id
        if (s.workspaceInfo.target === id) s.workspaceInfo.target = null
      },
      retainWorkspaces: (s, ids: readonly WorkspaceId[]) => {
        if (s.workspaceInfo.confirmed !== null && !ids.includes(s.workspaceInfo.confirmed))
          s.workspaceInfo.confirmed = null
        if (s.workspaceInfo.target !== null && !ids.includes(s.workspaceInfo.target))
          s.workspaceInfo.target = null
      },
      selectPanel: (s, id: MainPanelId | null) => {
        s.panelInfo.activePanelId = id
      },
      retainMainPanels: (s, ids: readonly string[]) => {
        if (s.panelInfo.activePanelId !== null && !ids.includes(s.panelInfo.activePanelId))
          s.panelInfo.activePanelId = null
      },
      toggleSidebar: (s) => {
        s.layoutInfo.sidebar = s.layoutInfo.sidebar === 0 ? 230 : 0
      },
      toggleFiles: (s) => {
        if (s.layoutInfo.sidebar === 0) {
          s.layoutInfo.sidebar = 230
          s.layoutInfo.filesExpanded = true
        } else s.layoutInfo.filesExpanded = !s.layoutInfo.filesExpanded
      },
      setSidebar: (s, width: number) => {
        s.layoutInfo.sidebar = Math.min(420, Math.max(190, width))
      },
      setFiles: (s, width: number) => {
        s.layoutInfo.files = Math.min(480, Math.max(180, width))
      },
      setViewportWidth: (s, width: number) => {
        s.layoutInfo.viewportWidth = width
      },
      setRightbar: (s, width: number) => {
        s.layoutInfo.rightbar = Math.min(s.layoutInfo.viewportWidth * 0.6, Math.max(300, width))
      },
      openRightbar: (s, track: boolean, fullscreen: boolean) => {
        s.layoutInfo.rightbar ??= Math.max(300, Math.round(s.layoutInfo.viewportWidth * 0.35))
        s.layoutInfo.rightbarShown = true
        s.layoutInfo.rightbarTrack = track
        s.layoutInfo.rightbarFullscreen = fullscreen
      },
      closeRightbar: (s) => {
        s.layoutInfo.rightbarShown = false
        s.layoutInfo.rightbarTrack = false
        s.layoutInfo.rightbarFullscreen = false
      },
    },
  })
}
