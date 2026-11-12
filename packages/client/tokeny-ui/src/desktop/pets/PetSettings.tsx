/** Companion controls rendered in the Tokeny appearance panel's extension slot. */
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { skins, type PetSkinId } from './catalog.ts'
import type { PetCallbacks, PetHooks } from './types.ts'
import css from './Pet.module.css'

type SettingsProps = PropsRuntime<'tokenyUI.themes.extra'> & PropsLocale<'tokenyUI.pet'> & PetCallbacks & PetHooks

/**
 * Render persistent visibility, skin, and sleeping choices.
 * @param props - framework preferences, translated labels, and preference callbacks.
 * @returns controls shared with every enabled composer companion.
 */
export function PetSettings({ t, usePet, setEnabled, setSkinId, setSleeping, retry }: SettingsProps) {
  const preferences = usePet(s => s)
  return (
    <section className={css.settings} data-tokeny-pet-settings>
      <h3>{t('title')}</h3>
      <label className={css.option}>
        <input type="checkbox" checked={preferences.enabled} onChange={(event) => { setEnabled(event.target.checked) }} />
        <span>{t('enabled')}</span>
      </label>
      <label className={css.option}>
        <span>{t('skin')}</span>
        <select aria-label={t('skin')} value={preferences.skinId} onChange={(event) => { setSkinId(event.target.value as PetSkinId) }}>
          {skins.map(skin => <option key={skin.id} value={skin.id}>{t(skin.id)}</option>)}
        </select>
      </label>
      <label className={css.option}>
        <input type="checkbox" checked={preferences.sleeping} onChange={(event) => { setSleeping(event.target.checked) }} />
        <span>{t('sleeping')}</span>
      </label>
      <p className={css.hint}>{t('hint')}</p>
      {preferences.saveError && <p className={css.error} role="status">{t('saveError')} <button type="button" onClick={retry}>{t('retry')}</button></p>}
    </section>
  )
}
