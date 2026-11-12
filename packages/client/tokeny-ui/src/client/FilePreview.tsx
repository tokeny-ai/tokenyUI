/** Text-only preview; content never becomes HTML or executes in the application. */
import { useEffect, useState } from 'react'
import { IconCloseOutline16, IconCodeOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PreviewResult } from '../protocol.ts'
import type { PreviewProps } from './contract.ts'
import css from './Shell.module.css'

/**
 * Render a cancellable preview of one workspace file.
 * @param props - Selected file, store, locale, and injected read callback.
 * @returns a read-only text pane or an explicit preview status.
 */
export function FilePreview({ workspaceId, path, readFile, actions, t }: PreviewProps) {
  const [result, setResult] = useState<PreviewResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const request = new AbortController()
    setResult(null)
    setError(null)
    void readFile(workspaceId, path, request.signal).then(
      (value) => {
        if (!request.signal.aborted) setResult(value)
      },
      (cause: unknown) => {
        if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : String(cause))
      },
    )
    return () => {
      request.abort()
    }
  }, [workspaceId, path, readFile, retry])
  return (
    <section className={css.previewBody} aria-label={t('preview')}>
      <div className={css.previewHeader}>
        <IconCodeOutline16 />
        <span title={path}>{path}</span>
        <button className={css.iconButton} aria-label={t('close')} onClick={actions.closeFile}>
          <IconCloseOutline16 />
        </button>
      </div>
      <div className={css.previewMeta}>
        {t('readOnly')}
        {result !== null && <span>{new Intl.NumberFormat().format(result.bytes)} B</span>}
      </div>
      {error !== null ? (
        <div className={css.treeMessage} role="alert">
          {error}
          <button
            onClick={() => {
              setRetry(retry + 1)
            }}
          >
            {t('retry')}
          </button>
        </div>
      ) : result === null ? (
        <p className={css.treeMessage} role="status">
          {t('loading')}
        </p>
      ) : result.kind === 'text' ? (
        <pre className={css.code}>
          <code>{result.content}</code>
        </pre>
      ) : (
        <p className={css.treeMessage}>{t(result.kind === 'binary' ? 'binary' : 'tooLarge')}</p>
      )}
    </section>
  )
}
