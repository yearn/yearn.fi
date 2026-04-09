import { useYearn } from '@shared/contexts/useYearn'
import { IconCross } from '@shared/icons/IconCross'
import { cl } from '@shared/utils'
import {
  clampZapSlippage,
  requiresZapSlippageRiskAcknowledgement,
  ZAP_SLIPPAGE_HARD_CAP,
  ZAP_SLIPPAGE_RISK_ACKNOWLEDGEMENT_TEXT
} from '@shared/utils/slippage'
import { type FC, useEffect, useId, useState } from 'react'

type SettingsPanelProps = {
  isActive: boolean
  onClose?: () => void
  variant?: 'panel' | 'overlay'
}

export const SettingsPanel: FC<SettingsPanelProps> = ({ isActive, onClose, variant = 'panel' }) => {
  const { zapSlippage, setZapSlippage, isAutoStakingEnabled, setIsAutoStakingEnabled } = useYearn()
  const [localSlippage, setLocalSlippage] = useState(zapSlippage)
  const [riskAcknowledgement, setRiskAcknowledgement] = useState('')
  const slippageId = useId()
  const riskAcknowledgementId = useId()
  const maximizeYieldId = useId()

  useEffect(() => {
    if (isActive) {
      setLocalSlippage(zapSlippage)
      setRiskAcknowledgement('')
    }
  }, [isActive, zapSlippage])

  useEffect(() => {
    const sanitizedSlippage = clampZapSlippage(localSlippage)
    const isSlippageDirty = sanitizedSlippage !== zapSlippage
    const needsRiskAcknowledgement = isSlippageDirty && requiresZapSlippageRiskAcknowledgement(sanitizedSlippage)
    const hasValidRiskAcknowledgement =
      !needsRiskAcknowledgement || riskAcknowledgement.trim() === ZAP_SLIPPAGE_RISK_ACKNOWLEDGEMENT_TEXT

    if (isSlippageDirty && hasValidRiskAcknowledgement) {
      setZapSlippage(sanitizedSlippage)
    }
  }, [localSlippage, riskAcknowledgement, setZapSlippage, zapSlippage])

  if (!isActive) {
    return null
  }

  const sanitizedSlippage = clampZapSlippage(localSlippage)
  const isSlippageDirty = sanitizedSlippage !== zapSlippage
  const needsRiskAcknowledgement = isSlippageDirty && requiresZapSlippageRiskAcknowledgement(sanitizedSlippage)
  const hasValidRiskAcknowledgement =
    !needsRiskAcknowledgement || riskAcknowledgement.trim() === ZAP_SLIPPAGE_RISK_ACKNOWLEDGEMENT_TEXT
  const riskAcknowledgementMessage =
    needsRiskAcknowledgement && !hasValidRiskAcknowledgement ? 'Sentence does not match exactly.' : null

  const panelClass =
    variant === 'overlay'
      ? 'bg-surface flex flex-col flex-1 min-h-0'
      : 'bg-surface border border-border rounded-lg flex flex-col flex-1 min-h-0'

  return (
    <div
      className={cl(
        variant === 'overlay'
          ? 'absolute inset-0 z-20 bg-surface border border-border rounded-lg overflow-hidden flex flex-col'
          : 'bg-app rounded-b-lg overflow-hidden relative w-full min-w-0 flex-1 flex flex-col'
      )}
    >
      <div className={panelClass}>
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-border">
          <div className="flex flex-col gap-1">
            <h3 className="text-base font-semibold text-text-primary">Transaction Settings</h3>
            <p className="text-xs text-text-secondary">
              Applies site-wide across all vaults. Slippage covers both quote quality and execution buffer.
            </p>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close settings"
              className="flex size-7 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text-primary"
            >
              <IconCross className="size-3.5" />
            </button>
          ) : null}
        </div>
        <div className="flex-1 overflow-y-auto min-h-0 p-6 pt-3">
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor={slippageId} className="text-sm text-text-primary">
                    Slippage Tolerance
                  </label>
                  <span className="text-sm text-text-secondary">{sanitizedSlippage}%</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setLocalSlippage(0.1)}
                    className={cl(
                      'px-3 py-1.5 text-xs rounded-md border transition-colors',
                      localSlippage === 0.1
                        ? 'bg-surface-tertiary text-text-primary border-surface-tertiary'
                        : 'bg-surface text-text-secondary border-border hover:bg-surface-secondary hover:text-text-primary'
                    )}
                  >
                    0.1%
                  </button>
                  <button
                    onClick={() => setLocalSlippage(0.5)}
                    className={cl(
                      'px-3 py-1.5 text-xs rounded-md border transition-colors',
                      localSlippage === 0.5
                        ? 'bg-surface-tertiary text-text-primary border-surface-tertiary'
                        : 'bg-surface text-text-secondary border-border hover:bg-surface-secondary hover:text-text-primary'
                    )}
                  >
                    0.5%
                  </button>
                  <button
                    onClick={() => setLocalSlippage(1.0)}
                    className={cl(
                      'px-3 py-1.5 text-xs rounded-md border transition-colors',
                      localSlippage === 1.0
                        ? 'bg-surface-tertiary text-text-primary border-surface-tertiary'
                        : 'bg-surface text-text-secondary border-border hover:bg-surface-secondary hover:text-text-primary'
                    )}
                  >
                    1.0%
                  </button>
                  <input
                    id={slippageId}
                    type="number"
                    value={sanitizedSlippage}
                    onChange={(e) => setLocalSlippage(clampZapSlippage(Number.parseFloat(e.target.value) || 0))}
                    className="w-16 px-2 py-1.5 text-xs border border-border text-text-primary bg-surface text-right rounded-md"
                    step="0.1"
                    min="0"
                    max={String(ZAP_SLIPPAGE_HARD_CAP)}
                  />
                </div>
                <p className="text-xs text-text-secondary">
                  Default is 0.50%. Transactions at or above 5.00% total slippage are blocked.
                </p>
                {needsRiskAcknowledgement ? (
                  <div className="space-y-2 rounded-md border border-red-500/30 bg-red-500/5 p-3">
                    <label htmlFor={riskAcknowledgementId} className="block text-xs font-medium text-red-500">
                      Type this sentence exactly to save slippage above 1.00%
                    </label>
                    <p className="text-xs text-text-primary">"{ZAP_SLIPPAGE_RISK_ACKNOWLEDGEMENT_TEXT}"</p>
                    <input
                      id={riskAcknowledgementId}
                      type="text"
                      value={riskAcknowledgement}
                      onChange={(e) => setRiskAcknowledgement(e.target.value)}
                      className="w-full rounded-md border border-border bg-surface px-3 py-2 text-xs text-text-primary"
                      placeholder={ZAP_SLIPPAGE_RISK_ACKNOWLEDGEMENT_TEXT}
                      spellCheck={false}
                      autoComplete="off"
                    />
                    {riskAcknowledgementMessage ? (
                      <p className="text-xs text-red-500">{riskAcknowledgementMessage}</p>
                    ) : (
                      <p className="text-xs text-green-500">High-slippage tolerance saved.</p>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div className="space-y-0.5">
                  <label htmlFor={maximizeYieldId} className="text-sm text-text-primary">
                    Stake Automatically
                  </label>
                  <p className="text-xs text-text-secondary">Automatically stake to maximize APY.</p>
                  <p className="text-xs text-text-secondary">No assets will be locked.</p>
                </div>
                <button
                  id={maximizeYieldId}
                  role="switch"
                  aria-checked={isAutoStakingEnabled}
                  onClick={() => setIsAutoStakingEnabled(!isAutoStakingEnabled)}
                  className={cl(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    isAutoStakingEnabled ? 'bg-blue-600' : 'bg-surface-tertiary'
                  )}
                >
                  <span
                    className={cl(
                      'inline-block h-4 w-4 transform rounded-full bg-surface border border-border shadow-sm transition-transform',
                      isAutoStakingEnabled ? 'translate-x-6' : 'translate-x-1'
                    )}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
