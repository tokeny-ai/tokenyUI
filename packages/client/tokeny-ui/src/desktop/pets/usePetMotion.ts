/** Local surface motion; session state remains in the native composer owner. */
import { useEffect, useRef, useState } from 'react'
import type { PetAction } from './catalog.ts'

function left(width: number, progress: number) {
  return 16 + Math.max(0, width - 96) * progress
}

/**
 * Move along the input card while respecting focus, visibility, and reduced motion.
 * @param options - current companion activity and explicit walk request.
 * @returns surface refs, current walking action, and whether animation is allowed.
 */
export function usePetMotion({ idle, walkRequest }: { idle: boolean; walkRequest: number }) {
  const railRef = useRef<HTMLDivElement>(null)
  const positionRef = useRef<HTMLDivElement>(null)
  const progress = useRef(0.82)
  const consumedRequest = useRef(0)
  const [width, setWidth] = useState(0)
  const [intersecting, setIntersecting] = useState(true)
  const [walkAction, setWalkAction] = useState<PetAction>('idle')
  const [surface, setSurface] = useState(() => ({
    focused: document.hasFocus(), visible: document.visibilityState !== 'hidden',
    reduced: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false, editorFocused: false,
  }))
  useEffect(() => {
    const rail = railRef.current
    if (rail === null) return
    const refresh = () => { setWidth(rail.clientWidth) }
    refresh()
    const observer = new ResizeObserver(refresh)
    observer.observe(rail)
    const visibility = typeof IntersectionObserver === 'undefined' ? undefined : new IntersectionObserver((entries) => {
      setIntersecting(entries.some(entry => entry.isIntersecting))
    })
    visibility?.observe(rail)
    return () => { observer.disconnect(); visibility?.disconnect() }
  }, [])
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const refresh = () => {
      const dock = railRef.current?.closest('[data-slot="conversation.input.dock"]')
      const card = (dock?.parentElement ?? railRef.current?.parentElement)?.querySelector('[data-composer-card]')
      setSurface({
        focused: document.hasFocus(), visible: document.visibilityState !== 'hidden', reduced: media?.matches ?? false,
        editorFocused: card?.contains(document.activeElement) ?? false,
      })
    }
    refresh()
    window.addEventListener('focus', refresh)
    window.addEventListener('blur', refresh)
    document.addEventListener('visibilitychange', refresh)
    document.addEventListener('focusin', refresh)
    document.addEventListener('focusout', refresh)
    media?.addEventListener('change', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      window.removeEventListener('blur', refresh)
      document.removeEventListener('visibilitychange', refresh)
      document.removeEventListener('focusin', refresh)
      document.removeEventListener('focusout', refresh)
      media?.removeEventListener('change', refresh)
    }
  }, [])
  const animationAllowed = surface.focused && surface.visible && intersecting && !surface.reduced
  const automatic = idle && animationAllowed && !surface.editorFocused && width >= 360
  useEffect(() => {
    const element = positionRef.current
    if (element === null) return
    element.style.transform = `translate3d(${left(width, progress.current)}px,0,0)`
    setWalkAction('idle')
    const explicit = walkRequest !== consumedRequest.current
    consumedRequest.current = walkRequest
    if (!animationAllowed || !idle || width < 96) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let frame: number | undefined
    let disposed = false
    const schedule = () => {
      if (automatic) timer = setTimeout(() => { walk(false) }, 14000)
    }
    const walk = (manual: boolean) => {
      const start = progress.current
      const target = start > 0.5 ? 0.18 : 0.82
      const distance = Math.abs(target - start) * Math.max(0, width - 96)
      const duration = Math.max(800, distance / (manual ? 100 : 24) * 1000)
      let started: number | undefined
      setWalkAction(target > start ? 'walkRight' : 'walkLeft')
      const tick = (time: number) => {
        if (disposed) return
        started ??= time
        const fraction = Math.min(1, (time - started) / duration)
        const eased = fraction * fraction * (3 - 2 * fraction)
        progress.current = start + (target - start) * eased
        element.style.transform = `translate3d(${left(width, progress.current)}px,0,0)`
        if (fraction < 1) frame = requestAnimationFrame(tick)
        else { setWalkAction('idle'); schedule() }
      }
      frame = requestAnimationFrame(tick)
    }
    if (explicit) walk(true)
    else schedule()
    return () => {
      disposed = true
      clearTimeout(timer)
      if (frame !== undefined) cancelAnimationFrame(frame)
    }
  }, [width, idle, automatic, animationAllowed, walkRequest])
  return { railRef, positionRef, walkAction, animationAllowed, editorFocused: surface.editorFocused }
}
