/** Frame animator for Tokeny's 6-column, 18-row companion sprite sheets. */
import { useEffect, useRef, type CSSProperties } from 'react'
import { animations, type PetAction } from './catalog.ts'

/**
 * Render a 64px sprite without updating React for individual animation frames.
 * @param props - sprite URL, action, and surface pause state.
 * @returns the current decorative sprite frame.
 */
export function SpritePlayer({ src, action, paused = false }: { src: string; action: PetAction; paused?: boolean }) {
  const elementRef = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const element = elementRef.current
    if (element === null) return
    const animation = animations[action]
    let timer: ReturnType<typeof setTimeout> | undefined
    let stopped = false
    let intersecting = true
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const canAnimate = () => !stopped && !paused && intersecting && document.visibilityState !== 'hidden' && !reduced?.matches
    const renderFrame = (index: number) => {
      const frame = animation.frames[index]
      element.style.backgroundPosition = `${-(frame.index % 6) * 64}px ${-Math.floor(frame.index / 6) * 64}px`
      if (!canAnimate() || index === animation.frames.length - 1 && !animation.loop) return
      timer = setTimeout(() =>{  renderFrame((index + 1) % animation.frames.length) }, frame.durationMs)
    }
    const refresh = () => {
      clearTimeout(timer)
      timer = undefined
      renderFrame(0)
    }
    const observer = typeof IntersectionObserver === 'undefined' ? undefined : new IntersectionObserver((entries) => {
      const next = entries.some(entry => entry.isIntersecting)
      if (next !== intersecting) { intersecting = next; refresh() }
    })
    observer?.observe(element)
    document.addEventListener('visibilitychange', refresh)
    reduced?.addEventListener('change', refresh)
    refresh()
    return () => {
      stopped = true
      clearTimeout(timer)
      observer?.disconnect()
      document.removeEventListener('visibilitychange', refresh)
      reduced?.removeEventListener('change', refresh)
    }
  }, [action, src, paused])
  const first = animations[action].frames[0].index
  const style: CSSProperties = {
    display: 'block', width: 64, height: 64,
    backgroundImage: `url(${JSON.stringify(src)})`, backgroundSize: '384px 1152px', backgroundRepeat: 'no-repeat',
    backgroundPosition: `${-(first % 6) * 64}px ${-Math.floor(first / 6) * 64}px`,
  }
  return <span ref={elementRef} style={style} aria-hidden="true" data-tokeny-pet-action={action} />
}
