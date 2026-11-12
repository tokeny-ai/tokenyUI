/** Persistent companion choices shared by the settings panel and every composer. */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { PetSkinId } from './catalog.ts'

/** Browser-wide companion choices. */
export interface PetPreferences {
  enabled: boolean
  skinId: PetSkinId
  sleeping: boolean
}

/** Live preferences plus the result of the latest browser-storage write. */
export interface PetState extends PetPreferences {
  saveError: boolean
}

const storageKey = 'dsh.tokenyUI.pet'
const defaults: PetPreferences = { enabled: true, skinId: 'orange-cat', sleeping: false }
const skinIds: readonly PetSkinId[] = [
  'orange-cat', 'tokeny-cow', 'octopus', 'ai-robot', 'rover-vacuum', 'marshmallow-ghost', 'rainbow-cloud',
]

function restore(value: unknown): PetPreferences {
  if (typeof value !== 'object' || value === null) return { ...defaults }
  const source = value as Record<string, unknown>
  return {
    enabled: typeof source.enabled === 'boolean' ? source.enabled : defaults.enabled,
    skinId: skinIds.includes(source.skinId as PetSkinId) ? source.skinId as PetSkinId : defaults.skinId,
    sleeping: typeof source.sleeping === 'boolean' ? source.sleeping : defaults.sleeping,
  }
}

/**
 * Create one plugin-owned preference source; persistence listeners start explicitly.
 * @returns observable preferences, narrow mutation callbacks, and owned persistence.
 */
export function createPetController() {
  let initial = { ...defaults }
  try {
    const raw = localStorage.getItem(storageKey)
    if (raw !== null) initial = restore(JSON.parse(raw) as unknown)
  } catch {
    // Unavailable storage or invalid saved JSON leaves the default companion usable.
  }
  const state = createSnapshotStore<PetState>({ ...initial, saveError: false })
  const save = () => {
    const { enabled, skinId, sleeping } = state.getSnapshot()
    let saveError = false
    try {
      localStorage.setItem(storageKey, JSON.stringify({ enabled, skinId, sleeping }))
    } catch {
      // Quota and private-mode failures affect persistence, not the current companion.
      saveError = true
    }
    if (state.getSnapshot().saveError !== saveError) state.update((s) => { s.saveError = saveError })
  }
  return {
    state,
    setEnabled: (enabled: boolean) => { state.update((s) => { s.enabled = enabled }); save() },
    setSkinId: (skinId: PetSkinId) => { state.update((s) => { s.skinId = skinId }); save() },
    setSleeping: (sleeping: boolean) => { state.update((s) => { s.sleeping = sleeping }); save() },
    retry: save,
    startPersistence: () => {
      const onStorage = (event: StorageEvent) => {
        if (event.key !== storageKey) return
        try {
          state.set({ ...restore(event.newValue === null ? null : JSON.parse(event.newValue) as unknown), saveError: false })
        } catch {
          // A malformed cross-window update does not replace live preferences.
        }
      }
      window.addEventListener('storage', onStorage)
      return () => { window.removeEventListener('storage', onStorage) }
    },
  }
}
