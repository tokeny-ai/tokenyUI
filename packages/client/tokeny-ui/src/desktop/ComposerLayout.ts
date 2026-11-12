/** Measure native composer controls without changing their React ownership. */
import './Composer.module.css'

type Binding = {
  row: HTMLElement
  card: HTMLElement
  stack: HTMLElement
  dispose: () => void
}

const controlsAttribute = 'data-tokeny-composer-controls'
const cardAttribute = 'data-tokeny-composer-card'
const stackAttribute = 'data-tokeny-composer-stack'

function setPixels(element: HTMLElement, name: string, value: number): void {
  const pixels = `${Math.round(value * 100) / 100}px`
  if (element.style.getPropertyValue(name) !== pixels) element.style.setProperty(name, pixels)
}

/**
 * Place each blank-session workspace/preset row within its native card's reserved top area.
 * @param root - mounted Tokeny shell; embedded conversations are measured independently.
 * @returns a disposer restoring native layout and cancelling all measurements.
 */
export function installComposerLayout(root: HTMLElement): () => void {
  const bindings = new Map<HTMLElement, Binding>()
  let frame: number | null = null
  let disposed = false
  const schedule = () => {
    if (disposed || frame !== null) return
    frame = requestAnimationFrame(() => {
      frame = null
      reconcile()
    })
  }
  const resize = new ResizeObserver(schedule)
  const bind = (row: HTMLElement, card: HTMLElement, stack: HTMLElement): Binding => {
    row.setAttribute(controlsAttribute, '')
    stack.setAttribute(stackAttribute, '')
    card.setAttribute(cardAttribute, '')
    resize.observe(row)
    resize.observe(card)
    resize.observe(stack)
    return {
      row, card, stack,
      dispose: () => {
        resize.unobserve(row)
        resize.unobserve(card)
        resize.unobserve(stack)
        row.removeAttribute(controlsAttribute)
        stack.removeAttribute(stackAttribute)
        card.removeAttribute(cardAttribute)
        row.style.removeProperty('--tokeny-composer-controls-top')
        row.style.removeProperty('--tokeny-composer-controls-left')
        row.style.removeProperty('--tokeny-composer-controls-width')
        card.style.removeProperty('--tokeny-composer-controls-height')
      },
    }
  }
  const measure = ({ row, card, stack }: Binding) => {
    const width = card.getBoundingClientRect().width
    setPixels(row, '--tokeny-composer-controls-width', width)
    setPixels(card, '--tokeny-composer-controls-height', row.getBoundingClientRect().height)
    const bounds = card.getBoundingClientRect()
    const origin = stack.getBoundingClientRect()
    setPixels(row, '--tokeny-composer-controls-top', bounds.top - origin.top)
    setPixels(row, '--tokeny-composer-controls-left', bounds.left - origin.left)
  }
  function reconcile() {
    const seats = new Set(root.querySelectorAll<HTMLElement>('[data-composer-seat]'))
    for (const [seat, binding] of bindings) {
      if (seats.has(seat)) continue
      binding.dispose()
      bindings.delete(seat)
    }
    for (const seat of seats) {
      const row = seat.querySelector<HTMLElement>('[data-slot="conversation.hero.workspace"]')?.parentElement
      const stack = row?.parentElement
      const card = seat.querySelector<HTMLElement>('[data-slot="conversation.composer.bar"] [data-composer-card]')
      const previous = bindings.get(seat)
      if (previous !== undefined && (previous.row !== row || previous.card !== card || previous.stack !== stack)) {
        previous.dispose()
        bindings.delete(seat)
      }
      if (row === undefined || row === null || stack === undefined || stack === null || card === null) continue
      let current = bindings.get(seat)
      if (current === undefined) {
        current = bind(row, card, stack)
        bindings.set(seat, current)
      }
      measure(current)
    }
  }
  const mutation = new MutationObserver(schedule)
  mutation.observe(root, { childList: true, subtree: true })
  window.addEventListener('resize', schedule)
  reconcile()
  return () => {
    disposed = true
    if (frame !== null) cancelAnimationFrame(frame)
    mutation.disconnect()
    resize.disconnect()
    window.removeEventListener('resize', schedule)
    for (const binding of bindings.values()) binding.dispose()
    bindings.clear()
  }
}
