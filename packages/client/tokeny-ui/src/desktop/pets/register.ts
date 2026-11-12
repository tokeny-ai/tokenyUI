/** Composer companion assembly using the Harness's additive input dock. */
import type { Context } from '@deepseek-ai/cordis'
import { createPetController } from './preferences.ts'
import { InputPet } from './InputPet.tsx'
import { PetSettings } from './PetSettings.tsx'
import { zh, en } from './locales.ts'

/**
 * Register the companion and its appearance controls without replacing native input.
 * @param ctx - browser context with locale and slot services.
 */
export function registerPet(ctx: Context): void {
  const controller = createPetController()
  const { state, startPersistence, ...callbacks } = controller
  ctx.effect(startPersistence, 'tokenyUI: companion preference synchronization')
  ctx.effect(() => ctx.locale.register('tokenyUI.pet', { zh, en }), 'tokenyUI: companion labels')
  const inject = () => ({ ...callbacks, hooks: { pet: state } })
  ctx.effect(() => ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
    name: 'conversation.input.dock', id: 'tokenyUI.pet', order: 100, locale: 'tokenyUI.pet', inject,
  }, InputPet)), 'tokenyUI: input companion')
  ctx.effect(() => ctx.slots.inject('tokenyUI.themes.extra', () => ctx.slots.register({
    name: 'tokenyUI.themes.extra', id: 'tokenyUI.pet.settings', order: 100, locale: 'tokenyUI.pet', inject,
  }, PetSettings)), 'tokenyUI: companion settings')
}
