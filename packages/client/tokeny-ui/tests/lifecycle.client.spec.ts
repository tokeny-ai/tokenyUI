// @vitest-environment jsdom
/** Shell replacement retracts owned slots, theme writes, and services before remounting. */
import { Context } from '@deepseek-ai/cordis'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { ThemeRuntime } from '@deepseek-ai/dsh-client-ui-theme/client'
import { expect, it } from 'vitest'
import { apply, inject } from '../src/client/index.ts'
import type {} from '../src/client/contract.ts'

it('can unload and remount without leaving slots, palette overrides or theme metadata', async () => {
  const ctx = new Context()
  const originalBody = document.body.getAttribute('style')
  const originalScheme = document.documentElement.style.colorScheme
  document.body.style.setProperty('--dsw-alias-bg-base', '#123456')
  try {
    await ctx.plugin(SlotRegistry).await()
    ctx.provide('locale', new LocaleRuntime(ctx))
    // Navigation and settings persistence are external to this registration-lifetime scenario.
    ctx.provide('sessions', {} as never)
    ctx.provide('workspaces', {} as never)
    ctx.provide('connection', {} as never)
    const theme = new ThemeRuntime(ctx, {
      getSnapshot: () => ({ value: { preference: 'light' } }),
      subscribe: () => () => {},
      set: async () => {},
    } as never)
    ctx.provide('theme', theme)
    const slots = ctx.get('slots') as SlotRegistry

    for (let mount = 0; mount < 2; mount++) {
      const fiber = ctx.plugin({ inject, apply })
      await fiber.await()
      expect(slots.entries('root')).toHaveLength(1)
      expect(slots.entries('sidebar')).toHaveLength(1)
      expect(slots.entries('tokenyUI.sidebar.files')).toHaveLength(1)
      expect(slots.entries('tokenyUI.preview')).toHaveLength(1)
      expect(ctx.get('layout')).toBeDefined()
      expect(document.head.querySelectorAll('meta[name="theme-color"]')).toHaveLength(1)
      theme.setTheme('dark')
      expect(document.body.hasAttribute('data-ds-dark-theme')).toBe(true)
      expect(document.body.style.getPropertyValue('--dsw-alias-bg-base')).toBe('#111620')

      await fiber.dispose()
      expect(slots.entries('root')).toHaveLength(0)
      expect(slots.spec('sidebar')).toBeUndefined()
      expect(slots.spec('tokenyUI.preview')).toBeUndefined()
      expect(slots.spec('tokenyUI.sidebar.files')).toBeUndefined()
      expect(ctx.get('layout')).toBeUndefined()
      expect(theme.getTheme().active.tokens['--dsw-alias-bg-base']).toBeUndefined()
      expect(document.body.style.getPropertyValue('--dsw-alias-bg-base')).toBe('#123456')
      expect(document.head.querySelectorAll('meta[name="theme-color"]')).toHaveLength(0)
      theme.setTheme('light')
      expect(document.documentElement.style.colorScheme).toBe(originalScheme)
    }
  } finally {
    await ctx.fiber.dispose()
    if (originalBody === null) document.body.removeAttribute('style')
    else document.body.setAttribute('style', originalBody)
    document.documentElement.style.colorScheme = originalScheme
  }
})
