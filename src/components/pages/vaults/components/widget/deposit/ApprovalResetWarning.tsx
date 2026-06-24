import type { ReactElement } from 'react'

type TApprovalResetWarningProps = {
  tokenSymbol?: string
  spenderName?: string
  onManageApproval: () => void
}

export function ApprovalResetWarning({ tokenSymbol, onManageApproval }: TApprovalResetWarningProps): ReactElement {
  const resolvedTokenSymbol = tokenSymbol || 'This token'

  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-5 text-red-500">
          <span className="font-semibold">{resolvedTokenSymbol} approval must be revoked.</span>
        </p>
        <button
          type="button"
          onClick={onManageApproval}
          className="shrink-0 self-start text-sm font-semibold text-red-500 underline transition-colors hover:text-red-400 sm:self-center"
        >
          Manage approval
        </button>
      </div>
    </div>
  )
}
