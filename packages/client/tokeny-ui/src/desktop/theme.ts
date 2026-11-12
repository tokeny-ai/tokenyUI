/** Tokeny palette preferences over Harness's native light/dark/system theme service. */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ThemePreference, ThemeRuntime, ThemeSnapshot } from '@deepseek-ai/dsh-client-ui-theme/client'
import { TOKENY_THEMES, type TokenyThemeDefinition, type TokenyThemeId } from './themes/catalog.ts'
import { tokenyThemeOverrides } from './themes/tokens.ts'

type PalettePreferences = { lightId: TokenyThemeId; darkId: TokenyThemeId }
type PaletteStorage = Pick<Storage, 'getItem' | 'setItem'>
const storageKey = 'tokenyUI.theme.v1'
const themeById: Readonly<Record<string, TokenyThemeDefinition>> = Object.fromEntries(TOKENY_THEMES.map(theme => [theme.id, theme]))

/** JSON data published to the theme panel through a framework-bound selector hook. */
export interface TokenyThemeState extends PalettePreferences {
  preference: ThemePreference
  scheme: 'light' | 'dark'
  activeId: TokenyThemeId
  saveFailed: boolean
}

function readPreferences(storage: PaletteStorage): { preferences: PalettePreferences; failed: boolean } {
  const defaults: PalettePreferences = { lightId: 'light', darkId: 'dark' }
  try {
    const raw = storage.getItem(storageKey)
    if (raw === null) return { preferences: defaults, failed: false }
    const value: unknown = JSON.parse(raw)
    if (value === null || typeof value !== 'object' || !('version' in value) || value.version !== 1) return { preferences: defaults, failed: false }
    const light = 'lightId' in value && TOKENY_THEMES.find(theme => theme.id === value.lightId && !theme.isDark)
    const dark = 'darkId' in value && TOKENY_THEMES.find(theme => theme.id === value.darkId && theme.isDark)
    return { preferences: { lightId: light ? light.id : defaults.lightId, darkId: dark ? dark.id : defaults.darkId }, failed: false }
  } catch {
    // Browser storage and persisted JSON are optional preference input; defaults keep the shell usable.
    return { preferences: defaults, failed: true }
  }
}

/**
 * Create a reversible palette controller and document presenter.
 * @param runtime - Native theme preference owner; only its built-in modes are persisted there.
 * @param storage - Browser-origin palette storage, replaceable by fixtures.
 * @returns observable panel data, selection callbacks, native-snapshot presenter and disposer.
 */
export function createDesktopTheme(
  runtime: Pick<ThemeRuntime, 'getTheme' | 'setTheme' | 'overrideTokens'>,
  storage: PaletteStorage = {
    getItem: key => window.localStorage.getItem(key),
    setItem: (key, value) => { window.localStorage.setItem(key, value) },
  },
) {
  const initial = readPreferences(storage)
  let preferences = initial.preferences
  let saveFailed = initial.failed
  let native = runtime.getTheme()
  const snapshot = (): TokenyThemeState => ({ ...preferences, preference: native.preference, scheme: native.active.colorScheme, activeId: native.active.colorScheme === 'dark' ? preferences.darkId : preferences.lightId, saveFailed })
  const source = createSnapshotStore(snapshot())
  const root = document.documentElement
  const body = document.body
  const previousScheme = root.style.colorScheme
  const previousSource = root.getAttribute('data-ds-theme-source')
  const previousDark = body.getAttribute('data-ds-dark-theme')
  const previousPalette = body.getAttribute('data-tokeny-theme')
  const saved = new Map<string, { value: string; priority: string }>()
  const applied = new Map<string, { value: string; priority: string }>()
  const meta = document.createElement('meta')
  meta.name = 'theme-color'
  let removeOverrides: (() => void) | undefined

  function set(name: string, value: string) {
    const original = saved.get(name) ?? { value: body.style.getPropertyValue(name), priority: body.style.getPropertyPriority(name) }
    saved.set(name, original)
    applied.set(name, original)
    body.style.setProperty(name, value)
  }
  function retract() {
    for (const [name, original] of applied) {
      if (original.value === '') body.style.removeProperty(name)
      else body.style.setProperty(name, original.value, original.priority)
    }
    applied.clear()
  }
  function applyOverrides() {
    const light = themeById[preferences.lightId]
    const dark = themeById[preferences.darkId]
    const previous = removeOverrides
    removeOverrides = runtime.overrideTokens('tokenyUI.palette', tokenyThemeOverrides(light, dark))
    previous?.()
  }
  function update(value: ThemeSnapshot) {
    native = value
    retract()
    const scheme = value.active.colorScheme
    root.style.colorScheme = scheme
    root.setAttribute('data-ds-theme-source', value.preference === 'system' ? 'system' : scheme)
    body.toggleAttribute('data-ds-dark-theme', scheme === 'dark')
    body.setAttribute('data-tokeny-theme', scheme === 'dark' ? preferences.darkId : preferences.lightId)
    for (const [role, size] of Object.entries(value.fontSizes)) set(`--dsh-${role === 'text' ? 'content' : role}-font-size`, `${size}px`)
    for (const [role, family] of Object.entries(value.fontFamilies)) {
      if (family !== '') set(`--dsh-font-family-${role}`, family)
    }
    for (const [name, color] of Object.entries(value.active.tokens)) set(name, color)
    meta.content = getComputedStyle(body).backgroundColor
    if (!meta.isConnected) document.head.append(meta)
    source.set(snapshot())
  }
  function save() {
    try {
      storage.setItem(storageKey, JSON.stringify({ version: 1, ...preferences }))
      saveFailed = false
    } catch {
      // A denied or full browser store leaves the selected palette active for this window.
      saveFailed = true
    }
    source.set(snapshot())
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key !== storageKey) return
    const stored = readPreferences(storage)
    preferences = stored.preferences
    saveFailed = stored.failed
    applyOverrides()
    update(runtime.getTheme())
  }
  window.addEventListener('storage', onStorage)
  applyOverrides()
  update(runtime.getTheme())
  return {
    source,
    update,
    selectTheme(id: TokenyThemeId) {
      const theme = themeById[id]
      preferences = { ...preferences, [theme.isDark ? 'darkId' : 'lightId']: id }
      save()
      applyOverrides()
      runtime.setTheme(theme.isDark ? 'dark' : 'light')
      update(runtime.getTheme())
    },
    setPreference(preference: ThemePreference) {
      runtime.setTheme(preference)
      update(runtime.getTheme())
    },
    retrySave: save,
    dispose() {
      window.removeEventListener('storage', onStorage)
      removeOverrides?.()
      retract()
      root.style.colorScheme = previousScheme
      if (previousSource === null) root.removeAttribute('data-ds-theme-source')
      else root.setAttribute('data-ds-theme-source', previousSource)
      if (previousDark === null) body.removeAttribute('data-ds-dark-theme')
      else body.setAttribute('data-ds-dark-theme', previousDark)
      if (previousPalette === null) body.removeAttribute('data-tokeny-theme')
      else body.setAttribute('data-tokeny-theme', previousPalette)
      meta.remove()
    },
  }
}

/** Theme controller passed only between the plugin's apply functions. */
export type DesktopThemeController = ReturnType<typeof createDesktopTheme>
