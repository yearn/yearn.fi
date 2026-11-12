import { widgetErrorCategory } from '@yearn/vault-widget/internal/utils/analytics'
import { cl } from '@yearn/vault-widget/internal/utils/index'

export function TransactionMessage({
  message,
  isError = true,
  fallback = 'Something went wrong. Check your wallet for details.',
  className
}: {
  message?: string
  isError?: boolean
  fallback?: string
  className?: string
}) {
  if (!message?.trim()) return null
  const original = message.trim()
  const category = widgetErrorCategory({ message: original })
  const summaries: Record<string, string> = {
    rejected: 'You declined the request in your wallet.',
    insufficient_funds: 'Insufficient funds to cover the transaction and network fee.'
  }
  const description = original
    .split(/\r?\n\s*\r?\n/)[0]
    .replace(/\r?\n/g, ' ')
    .trim()
  const summary = isError
    ? (summaries[category] ??
      (description.length <= 240 && !/0x[a-f\d]{40,}/i.test(description) ? description : fallback))
    : original

  return (
    <div className={cl('mb-4 w-full min-w-0 text-sm text-text-secondary', className)}>
      <p className="whitespace-pre-line break-words">{summary}</p>
      {isError && category !== 'rejected' && summary !== original ? (
        <details className="mt-2 text-left text-xs">
          <summary className="cursor-pointer text-center underline underline-offset-2">Error details</summary>
          <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface-secondary p-3 font-mono text-xs">
            {original}
          </pre>
        </details>
      ) : null}
    </div>
  )
}
