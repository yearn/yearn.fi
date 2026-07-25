'use client'

import { type ReactElement, useCallback, useEffect, useId, useState } from 'react'
import {
  clampSlippage,
  getSlippageSaveState,
  SLIPPAGE_HARD_CAP,
  SLIPPAGE_RISK_ACKNOWLEDGEMENT_TEXT
} from '../headless/settings'
import type { VaultWidgetSettings } from '../services'

type SettingsPanelProps = {
  autoStakeLabel?: string
  id?: string
  onChange: (settings: VaultWidgetSettings) => void
  onClose: () => void
  settings: VaultWidgetSettings
  slippageLabel?: string
  title: string
}

function CloseIcon(): ReactElement {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  )
}

export function SettingsPanel({
  autoStakeLabel = 'Stake Automatically',
  id,
  onChange,
  onClose,
  settings,
  slippageLabel = 'Slippage & Price Impact',
  title
}: SettingsPanelProps): ReactElement {
  const [localSlippage, setLocalSlippage] = useState(settings.slippagePercent)
  const [riskAcknowledgement, setRiskAcknowledgement] = useState('')
  const slippageId = useId()
  const acknowledgementId = useId()
  const autoStakeId = useId()
  const { sanitizedSlippage, isSlippageDirty, needsRiskAcknowledgement, hasValidRiskAcknowledgement } =
    getSlippageSaveState({
      localSlippage,
      currentSlippage: settings.slippagePercent,
      riskAcknowledgement
    })

  const close = useCallback((): void => {
    if (isSlippageDirty && hasValidRiskAcknowledgement) {
      onChange({ ...settings, slippagePercent: sanitizedSlippage })
    }
    onClose()
  }, [hasValidRiskAcknowledgement, isSlippageDirty, onChange, onClose, sanitizedSlippage, settings])

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      close()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [close])

  return (
    <div className="yv-widget__settings" id={id}>
      <div className="yv-widget__settings-header">
        <div>
          <h3>{title}</h3>
          <p>
            Applies site-wide across all vaults. Route impact consumes part of this tolerance; the remainder is used as
            execution buffer.
          </p>
        </div>
        <button type="button" aria-label="Close settings" onClick={close}>
          <CloseIcon />
        </button>
      </div>

      <div className="yv-widget__settings-content">
        <section className="yv-widget__slippage-settings">
          <div className="yv-widget__setting-heading">
            <label htmlFor={slippageId}>{slippageLabel}</label>
            <span>{sanitizedSlippage}%</span>
          </div>
          <div className="yv-widget__slippage-options">
            {[0.1, 0.5, 1].map((preset) => (
              <button
                data-active={localSlippage === preset}
                key={preset}
                type="button"
                onClick={() => setLocalSlippage(preset)}
              >
                {preset.toFixed(1)}%
              </button>
            ))}
            <input
              id={slippageId}
              type="number"
              inputMode="decimal"
              value={sanitizedSlippage}
              step="0.1"
              min="0"
              max={SLIPPAGE_HARD_CAP}
              onChange={(event) => setLocalSlippage(clampSlippage(Number.parseFloat(event.target.value) || 0))}
            />
          </div>
          <p>Default is 0.50%. Routes with worst-case impact at or above 5.00% are blocked.</p>

          {needsRiskAcknowledgement ? (
            <div className="yv-widget__risk-acknowledgement">
              <label htmlFor={acknowledgementId}>Type this sentence exactly to save tolerance above 1.00%</label>
              <p>&quot;{SLIPPAGE_RISK_ACKNOWLEDGEMENT_TEXT}&quot;</p>
              <input
                id={acknowledgementId}
                type="text"
                value={riskAcknowledgement}
                placeholder={SLIPPAGE_RISK_ACKNOWLEDGEMENT_TEXT}
                spellCheck={false}
                autoComplete="off"
                onChange={(event) => setRiskAcknowledgement(event.target.value)}
              />
              <small data-valid={hasValidRiskAcknowledgement}>
                {hasValidRiskAcknowledgement
                  ? 'High tolerance will save when settings close.'
                  : 'Sentence does not match exactly.'}
              </small>
            </div>
          ) : null}
        </section>

        <section className="yv-widget__auto-stake-setting">
          <div>
            <label htmlFor={autoStakeId}>{autoStakeLabel}</label>
            <p>Automatically stake to maximize APY.</p>
            <p>No assets will be locked.</p>
          </div>
          <button
            id={autoStakeId}
            type="button"
            role="switch"
            aria-label={autoStakeLabel}
            aria-checked={settings.autoStake}
            onClick={() => onChange({ ...settings, autoStake: !settings.autoStake })}
          >
            <span />
          </button>
        </section>
      </div>
    </div>
  )
}
