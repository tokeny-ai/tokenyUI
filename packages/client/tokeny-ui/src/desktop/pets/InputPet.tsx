/** Additive companion rail above the original Harness composer card. */
import { useEffect, useRef, useState } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import { Menu } from '@deepseek-ai/dsh-client-ui-primitives'
import { animations, skinsById, type PetAction } from './catalog.ts'
import { SpritePlayer } from './SpritePlayer.tsx'
import { usePetMotion } from './usePetMotion.ts'
import type { PetCallbacks, PetHooks } from './types.ts'
import css from './Pet.module.css'

type PetProps = PropsRuntime<'conversation.input.dock'> & PropsLocale<'tokenyUI.pet'> & PetCallbacks & PetHooks

function Companion(props: PetProps) {
  const { t, session, input, sessionId, useSessionStatus, setEnabled, setSleeping } = props
  const preferences = props.usePet(s => s)
  const waiting = useSessionStatus(state => state.get(sessionId)?.pendingInteraction !== undefined)
  const activity = waiting ? 'attention' : input.phase === 'adjudicating' || input.phase === 'submitting' || input.phase === 'sending'
    ? 'working' : session.running ? 'thinking' : 'idle'
  const [menu, setMenu] = useState(false)
  const previousFocus = useRef<HTMLElement | null>(null)
  const [walkRequest, setWalkRequest] = useState(0)
  const [gesture, setGesture] = useState<{ action: PetAction; serial: number } | null>(null)
  const [sleepPhase, setSleepPhase] = useState<PetAction | null>(preferences.sleeping ? 'sleep' : null)
  const previousSleep = useRef(preferences.sleeping)
  const serial = useRef(0)
  const motion = usePetMotion({ idle: activity === 'idle' && !preferences.sleeping && !menu && gesture === null, walkRequest })
  const skin = skinsById[preferences.skinId]
  useEffect(() => {
    const changed = previousSleep.current !== preferences.sleeping
    previousSleep.current = preferences.sleeping
    if (changed) {
      setGesture(null)
      setSleepPhase(motion.animationAllowed ? preferences.sleeping ? 'sleepStart' : 'wake' : preferences.sleeping ? 'sleep' : null)
    } else if (!motion.animationAllowed) setSleepPhase(preferences.sleeping ? 'sleep' : null)
  }, [preferences.sleeping, motion.animationAllowed])
  useEffect(() => {
    if (sleepPhase !== 'sleepStart' && sleepPhase !== 'wake') return
    const duration = animations[sleepPhase].frames.reduce((sum, frame) => sum + frame.durationMs, 0)
    const timer = setTimeout(() => { setSleepPhase(preferences.sleeping ? 'sleep' : null) }, duration)
    return () => { clearTimeout(timer) }
  }, [sleepPhase, preferences.sleeping])
  useEffect(() => {
    if (gesture === null) return
    const duration = animations[gesture.action].frames.reduce((sum, frame) => sum + frame.durationMs, 0)
    const timer = setTimeout(() => { setGesture(null) }, motion.animationAllowed ? duration : 800)
    return () => { clearTimeout(timer) }
  }, [gesture, motion.animationAllowed])
  const action = sleepPhase ?? (preferences.sleeping ? 'sleep' : gesture?.action ?? (motion.walkAction !== 'idle' ? motion.walkAction : activity))
  const interact = () => {
    if (preferences.sleeping) setSleeping(false)
    else setGesture({ action: 'pet', serial: ++serial.current })
  }
  const openMenu = () => {
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setMenu(true)
  }
  const name = t(skin.id)
  const hint = t(preferences.sleeping ? 'wake' : 'pet')
  return (
    <div ref={motion.railRef} className={css.rail} data-tokeny-pet-rail>
      <div ref={motion.positionRef} className={css.position}>
        <Menu open={menu} onClose={() => { setMenu(false) }} portal side="top" autoFocus
          returnFocus={() => previousFocus.current}
          items={[
            { id: 'pet', label: t('pet'), disabled: preferences.sleeping },
            { id: 'walk', label: t('walk'), disabled: preferences.sleeping || activity !== 'idle' },
            { id: 'sleep', label: t(preferences.sleeping ? 'wake' : 'sleep') },
            { id: 'hide', label: t('hide') },
          ]}
          onSelect={(id) => {
            setMenu(false)
            if (id === 'pet') interact()
            if (id === 'walk') setWalkRequest(request => request + 1)
            if (id === 'sleep') setSleeping(!preferences.sleeping)
            if (id === 'hide') setEnabled(false)
          }}
          anchor={
            <button type="button" className={css.pet} data-tokeny-pet data-tokeny-pet-skin={skin.id}
              data-tokeny-pet-sleeping={preferences.sleeping || undefined}
              aria-label={`${name} · ${hint}`} aria-description={t(activity)} title={`${name} · ${t('hint')}`}
              aria-haspopup="menu" aria-expanded={menu}
              onMouseDown={(event) => { event.preventDefault(); event.stopPropagation() }}
              onClick={(event) => { event.stopPropagation(); interact() }}
              onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); openMenu() }}
              onKeyDown={(event) => {
                if (event.key === 'ContextMenu' || event.key === 'F10' && event.shiftKey) {
                  event.preventDefault(); event.stopPropagation(); openMenu()
                }
              }}>
              <span key={gesture?.serial ?? 0} className={css.bounce} data-bounce={action === 'pet' && motion.animationAllowed || undefined}>
                <SpritePlayer src={skin.src} action={action} paused={!motion.animationAllowed || motion.editorFocused && action === 'idle'} />
              </span>
              {preferences.sleeping && <span className={css.sleeping} aria-hidden="true">zzz</span>}
            </button>
          } />
      </div>
    </div>
  )
}

/**
 * Omit the whole rail when disabled so the original composer keeps its geometry.
 * @param props - native composer owner, framework preferences, and narrow callbacks.
 * @returns the enabled companion rail.
 */
export function InputPet(props: PetProps) {
  const enabled = props.usePet(s => s.enabled)
  return enabled ? <Companion {...props} /> : null
}
