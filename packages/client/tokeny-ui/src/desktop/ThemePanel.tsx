/** Tokeny palette picker composed with optional appearance controls from other plugin domains. */
import { useEffect, useRef, type CSSProperties } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type { HostObservable, PropsHooks, PropsLocale, PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ThemePreference } from '@deepseek-ai/dsh-client-ui-theme/client'
import type { DesktopThemeController, TokenyThemeState } from './theme.ts'
import { TOKENY_THEMES, type TokenyThemeDefinition } from './themes/catalog.ts'
import { en, zh } from './theme-locales.ts'
import css from './ThemePanel.module.css'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /** Modal theme settings opened by the shell's appearance button. */
    'tokenyUI.themes': { kind: 'single'; scope: 'root'; owner: { onClose: () => void } }
    /** Additional appearance settings, such as the input companion. */
    'tokenyUI.themes.extra': { kind: 'list'; scope: 'root' }
  }
}

type ThemeSources = { appearance: HostObservable<TokenyThemeState> }
type ThemeInjected = Pick<DesktopThemeController, 'selectTheme' | 'setPreference' | 'retrySave'>
type ThemeProps = PropsRuntime<'tokenyUI.themes'> & PropsLocale<'tokenyUI.themes'> & PropsRenderSlots<'tokenyUI.themes.extra'> & PropsHooks<ThemeSources> & ThemeInjected

function Swatch({ theme }: { theme: TokenyThemeDefinition }) {
  const style = {
    '--tokeny-swatch-base': `rgb(${theme.tokens['bg-base']})`,
    '--tokeny-swatch-surface': `rgb(${theme.tokens['bg-surface']})`,
    '--tokeny-swatch-elevated': `rgb(${theme.tokens['bg-elevated']})`,
    '--tokeny-swatch-brand': `rgb(${theme.tokens['brand-default']})`,
  } as CSSProperties
  return <span className={css.swatch} style={style} aria-hidden="true"><span /><span /><span /><span /></span>
}

function ThemePanel({ useAppearance, selectTheme, setPreference, retrySave, onClose, renderSlot, t }: ThemeProps) {
  const state = useAppearance(value => value)
  const close = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLElement>(null)
  useEffect(() => {
    const previous = document.activeElement
    close.current?.focus()
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus() }
  }, [])
  return <div className={css.mask} onPointerDown={(event) => { if (event.currentTarget === event.target) onClose() }}>
    <section ref={panel} className={css.panel} role="dialog" aria-modal="true" aria-labelledby="tokeny-theme-title" data-tokeny-theme-panel onKeyDown={(event) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose() }
      if (event.key === 'Tab') {
        const controls = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]') ?? []).filter(control => control.offsetParent !== null)
        const first = controls[0], last = controls.at(-1)
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }}>
      <header className={css.header}><h2 id="tokeny-theme-title">{t('title')}</h2><button ref={close} type="button" className={css.close} aria-label={t('close')} onClick={onClose}><svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.5" /></svg></button></header>
      <div className={css.content}>
        <div className={css.label}>{t('mode')}</div>
        <div className={css.modes} role="group" aria-label={t('mode')}>
          {(['light', 'dark', 'system'] as const).map((mode: ThemePreference) => <button key={mode} type="button" className={css.mode} aria-pressed={state.preference === mode} onClick={() => { setPreference(mode) }}>{t(mode === 'light' ? 'modeLight' : mode === 'dark' ? 'modeDark' : 'modeSystem')}</button>)}
        </div>
        <p className={css.hint}>{t('hint')}</p>
        {([false, true] as const).map(isDark => <section className={css.section} key={String(isDark)}><h3>{t(isDark ? 'darkThemes' : 'lightThemes')}</h3><div className={css.grid}>
          {TOKENY_THEMES.filter(theme => theme.isDark === isDark).map(theme => <button key={theme.id} type="button" className={css.card} data-theme-id={theme.id} aria-label={t(theme.id)} aria-pressed={state.activeId === theme.id} onClick={() => { selectTheme(theme.id) }}><Swatch theme={theme} /><span className={css.name}><span>{t(theme.id)}</span>{state.activeId === theme.id && <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-label={t('selected')}><path d="m3 8 3 3 7-7" stroke="currentColor" strokeWidth="1.6" /></svg>}</span></button>)}
        </div></section>)}
        {state.saveFailed && <div className={css.error} role="alert"><span>{t('saveError')}</span><button type="button" onClick={retrySave}>{t('retry')}</button></div>}
        {renderSlot('tokenyUI.themes.extra', {})}
      </div>
    </section>
  </div>
}

/**
 * Bind the theme picker to its controller after the shell declares the modal slot.
 * @param ctx - Plugin context with slots and locale.
 * @param controller - Palette source and callbacks owned by the shell lifetime.
 */
export function registerThemePanel(ctx: Context, controller: DesktopThemeController): void {
  ctx.effect(() => ctx.locale.register('tokenyUI.themes', { zh, en }), 'tokenyUI: theme labels')
  ctx.effect(() => ctx.slots.inject('tokenyUI.themes', () => ctx.slots.register({
    name: 'tokenyUI.themes', locale: 'tokenyUI.themes',
    children: { 'tokenyUI.themes.extra': { kind: 'list', scope: 'root' } },
    inject: () => ({
      hooks: { appearance: controller.source },
      selectTheme: controller.selectTheme,
      setPreference: controller.setPreference,
      retrySave: controller.retrySave,
    }),
  }, ThemePanel)), 'tokenyUI: theme picker')
}
