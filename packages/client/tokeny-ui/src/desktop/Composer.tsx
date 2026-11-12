/** Additive layout adapter for native workspace and agent-preset controls. */
import { useLayoutEffect, useRef } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import { installComposerLayout } from './ComposerLayout.ts'

function ComposerControls(_props: PropsRuntime<'shell.overlay'>) {
  const marker = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const root = marker.current?.closest<HTMLElement>('[data-tokeny-ui]')
    if (root === undefined || root === null) return
    return installComposerLayout(root)
  }, [])
  return <span ref={marker} hidden data-tokeny-composer-adapter />
}

/**
 * Keep native composer controls inside the card's visible top area, including before a Session exists.
 * @param ctx - plugin context owning the reversible overlay contribution.
 */
export function registerComposerControls(ctx: Context): void {
  ctx.effect(() => ctx.slots.inject('shell.overlay', () => ctx.slots.register(
    { name: 'shell.overlay', id: 'tokenyUI.composer.controls', order: 100 },
    ComposerControls,
  )), 'tokenyUI: native composer control placement')
}
