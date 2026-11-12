/** Map Tokeny's original semantic RGB colors onto Harness's public theme aliases. */
import type { ThemeTokenOverrides, ThemeTokens } from '@deepseek-ai/dsh-client-ui-theme/client'
import type { TokenyThemeDefinition } from './catalog.ts'

const aliases = {
  '--dsw-alias-bg-base': 'bg-base',
  '--dsw-alias-bg-layer-1': 'bg-surface',
  '--dsw-alias-bg-layer-2': 'bg-elevated',
  '--dsw-alias-bg-layer-3': 'bg-overlay',
  '--dsw-alias-bg-module-platform': 'bg-elevated',
  '--dsw-alias-bg-document-preview': 'bg-base',
  '--dsw-alias-label-primary': 'content-primary',
  '--dsw-alias-label-primary-bluish': 'content-primary',
  '--dsw-alias-label-primary-dimmed': 'content-secondary',
  '--dsw-alias-label-primary-foreground': 'brand-fg',
  '--dsw-alias-label-primary-inverted': 'content-inverse',
  '--dsw-alias-label-secondary': 'content-secondary',
  '--dsw-alias-label-tertiary': 'content-tertiary',
  '--dsw-alias-label-dimmed': 'content-muted',
  '--dsw-alias-label-caption': 'content-muted',
  '--dsw-alias-label-document-preview': 'content-primary',
  '--dsw-alias-border-l1': 'border-subtle',
  '--dsw-alias-border-l2': 'border-default',
  '--dsw-alias-border-l3': 'border-strong',
  '--dsw-alias-border-l4': 'border-strong',
  '--dsw-alias-interactive-bg-hover': 'interactive-hover',
  '--dsw-alias-interactive-bg-hover-solid': 'interactive-hover',
  '--dsw-alias-interactive-bg-active': 'interactive-active',
  '--dsw-alias-state-business-primary': 'brand-default',
  '--dsw-alias-state-success-primary': 'status-success',
  '--dsw-alias-state-error-primary': 'status-error',
  '--dsw-alias-state-warn-primary': 'status-warning',
  '--dsw-alias-state-warn-label': 'status-warning',
  '--dsw-alias-state-idle-primary': 'status-info',
  '--dsw-alias-button-primary-fill': 'brand-default',
  '--dsw-alias-button-primary-hover': 'brand-hover',
  '--dsw-alias-button-elevated-fill': 'bg-elevated',
  '--dsw-alias-button-floating-fill': 'bg-elevated',
  '--dsw-alias-button-floating-hover': 'interactive-hover',
  '--dsw-alias-button-tool-bar-fill': 'bg-surface',
  '--dsw-alias-button-tool-bar-hover': 'interactive-hover',
  '--dsw-alias-link': 'link-color',
  '--dsw-alias-markdown-inline-code': 'code-inline-bg',
  '--dsw-alias-markdown-code-block': 'bg-surface',
  '--dsw-alias-markdown-code-block-banner': 'bg-elevated',
  '--dsw-alias-menu-icon': 'content-secondary',
  '--dsw-alias-menu-group-header-fill': 'bg-elevated',
  '--dsw-alias-scrollbar-bg-l1': 'scrollbar-thumb',
  '--dsw-alias-scrollbar-bg-l2': 'scrollbar-thumb',
  '--dsw-alias-scrollbar-hover-l1': 'scrollbar-thumb-hover',
  '--dsw-alias-scrollbar-hover-l2': 'scrollbar-thumb-hover',
  '--dsw-alias-toast-bg': 'bg-elevated',
  '--dsw-alias-toast-label': 'content-primary',
  '--dsw-menu-surface-fill': 'bg-elevated',
  '--dsw-specific-menu': 'bg-elevated',
  '--dsw-specific-sidebar-fill': 'layout-sidebar',
  '--dsw-specific-sidebar-nav-item-hover': 'interactive-hover',
  '--dsw-specific-sidebar-nav-item-active': 'interactive-active',
  '--dsw-specific-input-major': 'bg-surface',
  '--dsw-specific-bubble': 'user-bubble-bg',
  '--dsw-specific-bubble-highlight': 'interactive-active',
  '--dsw-focus-ring-color': 'brand-default',
  '--dsw-alias-tokeny-bar': 'layout-titlebar',
  '--dsw-alias-tokeny-switcher': 'layout-switcher',
  '--dsw-alias-tokeny-panel': 'layout-panel',
} as const

function paletteTokens(palette: TokenyThemeDefinition): ThemeTokens {
  return Object.fromEntries(Object.entries(aliases).map(([alias, token]) => [alias, `rgb(${palette.tokens[token]})`]))
}

/**
 * Compose one native override layer with a complete light/dark value pair per alias.
 * @param light - Selected light Tokeny palette.
 * @param dark - Selected dark Tokeny palette.
 * @returns native theme overrides, leaving native font and icon settings untouched.
 */
export function tokenyThemeOverrides(light: TokenyThemeDefinition, dark: TokenyThemeDefinition): ThemeTokenOverrides {
  const lightTokens = paletteTokens(light)
  const darkTokens = paletteTokens(dark)
  return Object.fromEntries(Object.keys(aliases).map(alias => [alias, { light: lightTokens[alias], dark: darkTokens[alias] }]))
}
