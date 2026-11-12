/** Narrow companion callbacks and their framework-bound observable source. */
import type { PropsHooks } from '@deepseek-ai/dsh-client-ui-slots'
import type { createPetController } from './preferences.ts'

/** Plain mutations available to the companion and its settings. */
export type PetCallbacks = Pick<ReturnType<typeof createPetController>, 'setEnabled' | 'setSkinId' | 'setSleeping' | 'retry'>

/** Preference hook synthesized by the Harness slot renderer. */
export type PetHooks = PropsHooks<{ pet: ReturnType<typeof createPetController>['state'] }>
