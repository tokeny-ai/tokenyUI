/** Plugin-lifetime projection of Harness themes and Tokeny's neutral shell palette. */
import type { ThemeSnapshot, ThemeTokenOverrides } from '@deepseek-ai/dsh-client-ui-theme/client'

/** Semantic colors used by both the shell and existing Harness panels. */
export const tokenyTokens: ThemeTokenOverrides = {
  '--dsw-alias-bg-base': { light: '#ffffff', dark: '#111620' },
  '--dsw-alias-bg-layer-1': { light: '#fdfdfe', dark: '#1e2533' },
  '--dsw-alias-bg-layer-2': { light: '#f8f8fb', dark: '#252d3d' },
  '--dsw-alias-bg-layer-3': { light: '#ffffff', dark: '#2d3748' },
  '--dsw-specific-sidebar-fill': { light: '#fbfbfc', dark: '#151a23' },
  '--dsw-specific-sidebar-nav-item-hover': { light: '#f0f0f5', dark: '#2d3748' },
  '--dsw-specific-sidebar-nav-item-active': { light: '#e8e8ee', dark: '#343944' },
  '--dsw-alias-label-primary': { light: '#1c1c22', dark: '#f1f5f9' },
  '--dsw-alias-label-secondary': { light: '#4b4b55', dark: '#94a3b8' },
  '--dsw-alias-label-tertiary': { light: '#6b6b75', dark: '#64748b' },
  '--dsw-alias-border-l2': { light: '#e5e5eb', dark: '#2d3748' },
  '--dsw-alias-tokeny-bar': { light: '#fafafc', dark: '#111620' },
  '--dsw-alias-tokeny-switcher': { light: '#ffffff', dark: '#2d3748' },
}

/**
 * Apply resolved theme snapshots, restoring prior DOM values when the shell unloads.
 * @returns update and disposal callbacks owned by the plugin effect.
 */
export function createThemeProjection(): { update: (snapshot: ThemeSnapshot) => void; dispose: () => void } {
  const body = document.body
  const originalScheme = document.documentElement.style.colorScheme
  const originalDark = body.getAttribute('data-ds-dark-theme')
  const themeColor = document.createElement('meta')
  themeColor.name = 'theme-color'
  const previous = new Map<string, { value: string; priority: string }>()
  const applied = new Map<string, { value: string; priority: string }>()
  const restoreToken = (name: string, original: { value: string; priority: string }) => {
    if (original.value === '') body.style.removeProperty(name)
    else body.style.setProperty(name, original.value, original.priority)
  }
  return {
    update: (snapshot) => {
      document.documentElement.style.colorScheme = snapshot.active.colorScheme
      body.toggleAttribute('data-ds-dark-theme', snapshot.active.colorScheme === 'dark')
      for (const [name, original] of applied) restoreToken(name, original)
      applied.clear()
      for (const [name, value] of Object.entries(snapshot.active.tokens)) {
        const original = previous.get(name) ?? {
          value: body.style.getPropertyValue(name),
          priority: body.style.getPropertyPriority(name),
        }
        previous.set(name, original)
        applied.set(name, original)
        body.style.setProperty(name, value)
      }
      themeColor.content = getComputedStyle(body).backgroundColor
      if (!themeColor.isConnected) document.head.append(themeColor)
    },
    dispose: () => {
      for (const [name, original] of applied) restoreToken(name, original)
      document.documentElement.style.colorScheme = originalScheme
      if (originalDark === null) body.removeAttribute('data-ds-dark-theme')
      else body.setAttribute('data-ds-dark-theme', originalDark)
      themeColor.remove()
    },
  }
}
