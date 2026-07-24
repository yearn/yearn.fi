'use client'

import { useQuery } from '@tanstack/react-query'
import { type ReactElement, useCallback, useRef, useState } from 'react'
import { formatUnits } from 'viem'
import { useVaultWidgetServices } from '../context'
import { useVaultWidgetController } from '../headless'
import type { VaultWidgetConfig, VaultWidgetCopy, VaultWidgetMode, VaultWidgetProps, VaultWidgetToken } from '../types'
import { formatWalletBalance, formatWidgetAllowance, formatWidgetValue } from '../valueDisplay'
import { ActivityPanel } from './ActivityPanel'
import { SettingsPanel } from './SettingsPanel'
import { TokenSelectorOverlay } from './TokenSelectorOverlay'

const DEFAULT_COPY: VaultWidgetCopy = {
  connect: 'Connect Wallet',
  amount: 'Amount',
  balance: 'Balance',
  position: 'Position',
  settings: 'Transaction Settings',
  slippage: 'Slippage tolerance',
  maximumLoss: 'Maximum loss',
  solver: 'Route provider',
  autoStake: 'Automatically stake eligible deposits',
  submitDeposit: 'Deposit',
  submitWithdraw: 'Withdraw',
  findingRoute: 'Finding best route…',
  approveAndDeposit: 'Approve & Deposit',
  approveAndWithdraw: 'Approve & Withdraw',
  noRoute: 'No route is available for this amount.',
  youWillDeposit: 'You Will Deposit',
  youWillReceive: 'You Will Receive',
  vaultShareValue: 'Vault share value',
  estimatedAnnualReturn: 'Est. Annual Return',
  existingApproval: 'Existing Approval',
  unstakeAndRedeem: 'You will unstake and redeem'
}

function DefaultConnectButton({ onClick, label }: { onClick: () => void; label: string }): ReactElement {
  return (
    <button className="yv-widget__button yv-widget__button--primary" onClick={onClick} type="button">
      {label}
    </button>
  )
}

function DefaultTokenIcon({ token, size }: { token: VaultWidgetToken; size: number }): ReactElement {
  if (!token.logoURI) {
    return (
      <span className="yv-widget__token-fallback" style={{ width: size, height: size }} aria-hidden="true">
        {token.symbol.slice(0, 1)}
      </span>
    )
  }

  return <img className="yv-widget__token-icon" src={token.logoURI} alt="" width={size} height={size} />
}

function SettingsIcon(): ReactElement {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        clipRule="evenodd"
        d="M11.877 10a1.99 1.99 0 0 0-1.978 2c0 1.104.886 2 1.978 2a1.989 1.989 0 0 0 1.977-2c0-1.105-.885-2-1.977-2ZM7.92 12c0-2.21 1.772-4 3.955-4 2.185 0 3.956 1.79 3.956 4s-1.771 4-3.956 4c-2.183 0-3.955-1.79-3.955-4Z"
        fill="currentColor"
        fillRule="evenodd"
      />
      <path
        clipRule="evenodd"
        d="M8.867 1.95A2.313 2.313 0 0 1 11.14 0h1.719c1.129 0 2.09.825 2.274 1.95l.288 1.75a8.85 8.85 0 0 1 1.965 1.15l1.64-.622a2.295 2.295 0 0 1 2.806 1.018l.86 1.509c.561.986.34 2.242-.532 2.967l-1.348 1.124c.094.76.094 1.547 0 2.308l1.348 1.124a2.353 2.353 0 0 1 .532 2.967l-.86 1.508v.001a2.294 2.294 0 0 1-2.805 1.018l-1.641-.622c-.6.463-1.259.851-1.965 1.15l-.288 1.75A2.313 2.313 0 0 1 12.86 24H11.14a2.313 2.313 0 0 1-2.273-1.95l-.288-1.75a8.847 8.847 0 0 1-1.965-1.15l-1.64.622a2.294 2.294 0 0 1-2.806-1.019l-.86-1.508a2.354 2.354 0 0 1 .53-2.967l1.35-1.124a9.315 9.315 0 0 1 0-2.308L1.839 9.722a2.354 2.354 0 0 1-.53-2.967l.859-1.508a2.293 2.293 0 0 1 2.805-1.02l1.641.623A8.844 8.844 0 0 1 8.579 3.7l.288-1.75Zm1.95.328-.38 2.316a.997.997 0 0 1-.657.783A6.876 6.876 0 0 0 7.452 6.74a.98.98 0 0 1-1 .185L4.28 6.101a.326.326 0 0 0-.399.144l-.86 1.508a.338.338 0 0 0 .076.425l2.243 1.87-.116.587a7.198 7.198 0 0 0 0 2.73c.072.361-.06.733-.34.968l-1.787 1.489a.338.338 0 0 0-.075.425l.86 1.508c.079.14.248.2.397.145l2.173-.825a.98.98 0 0 1 1 .185 6.876 6.876 0 0 0 2.328 1.363c.345.119.597.42.657.783l.38 2.316a.329.329 0 0 0 .323.278h1.719c.16 0 .297-.117.324-.278l.38-2.316a.997.997 0 0 1 .656-.782 6.902 6.902 0 0 0 2.33-1.365.98.98 0 0 1 .999-.184l2.173.825a.327.327 0 0 0 .398-.146l.86-1.507a.337.337 0 0 0-.076-.425l-1.786-1.49a1.006 1.006 0 0 1-.341-.965 7.278 7.278 0 0 0 0-2.734c-.071-.36.06-.732.34-.966l1.786-1.489a.338.338 0 0 0 .076-.425l-.858-1.507a.327.327 0 0 0-.4-.146l-2.172.825a.98.98 0 0 1-1-.184 6.885 6.885 0 0 0-2.328-1.364.997.997 0 0 1-.657-.783l-.38-2.316A.33.33 0 0 0 12.859 2H11.14a.329.329 0 0 0-.323.278Z"
        fill="currentColor"
        fillRule="evenodd"
      />
    </svg>
  )
}

function DetailValue({ amount, unit }: { amount: string; unit?: string }): ReactElement {
  return (
    <>
      <strong>{amount}</strong>
      {unit ? (
        <>
          {' '}
          <span>{unit}</span>
        </>
      ) : null}
    </>
  )
}

function CloseIcon(): ReactElement {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  )
}

function ChevronDownIcon(): ReactElement {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <path d="m5 7.5 5 5 5-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  )
}

function getModeLabel(mode: VaultWidgetMode, labels?: Partial<Record<VaultWidgetMode, string>>): string {
  const customLabel = labels?.[mode]
  if (customLabel) return customLabel
  if (mode === 'info') return 'My Info'
  return mode.slice(0, 1).toUpperCase() + mode.slice(1)
}

function formatInputAmount(value: string): string {
  return formatWidgetValue(Number(value || '0'))
}

function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return '$0.00'
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

function TransactionStatus({
  execution
}: {
  execution: ReturnType<typeof useVaultWidgetController>['execution']
}): ReactElement | null {
  if (execution.status === 'idle') return null
  if (execution.status === 'success') {
    return (
      <div className="yv-widget__notice yv-widget__notice--success" role="status">
        Transaction complete.
      </div>
    )
  }
  if (execution.status === 'error') {
    return (
      <div className="yv-widget__notice yv-widget__notice--error" role="alert">
        {execution.error.message}
      </div>
    )
  }
  return (
    <div className="yv-widget__notice" role="status" aria-live="polite">
      <span className="yv-widget__spinner" aria-hidden="true" />
      <span>
        {execution.status === 'confirming' ? 'Confirm in your wallet' : 'Transaction pending'}
        <small>
          {execution.step.label} ({execution.stepIndex + 1}/{execution.stepCount})
        </small>
      </span>
    </div>
  )
}

type ConfiguredVaultWidgetProps = VaultWidgetProps & {
  config: VaultWidgetConfig
}

function ConfiguredVaultWidget({
  chainId,
  vaultAddress,
  config,
  mode,
  defaultMode,
  onModeChange,
  onConnectWallet,
  onClose,
  onEvent,
  onSuccess,
  onError,
  copy: copyOverrides,
  slots,
  className,
  style,
  showNavigation = true,
  viewport = 'auto',
  renderPanel
}: ConfiguredVaultWidgetProps): ReactElement {
  if (chainId !== config.chainId || vaultAddress.toLowerCase() !== config.vaultAddress.toLowerCase()) {
    throw new Error('VaultWidget configuration does not match the requested vault')
  }

  const copy = { ...DEFAULT_COPY, ...config.copy, ...copyOverrides }
  const controller = useVaultWidgetController({
    config,
    mode,
    defaultMode,
    onModeChange,
    onEvent,
    onSuccess,
    onError
  })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [tokenSelectorOpen, setTokenSelectorOpen] = useState(false)
  const [selectedPercentage, setSelectedPercentage] = useState<number | null>(null)
  const tokenSelectorButtonRef = useRef<HTMLButtonElement>(null)
  const ConnectButton = slots?.ConnectButton ?? DefaultConnectButton
  const TokenIcon = slots?.TokenIcon ?? DefaultTokenIcon
  const Header = slots?.Header
  const Details = slots?.Details
  const isTransactionMode = controller.mode === 'deposit' || controller.mode === 'withdraw'
  const transactionMode = controller.mode === 'withdraw' ? 'withdraw' : 'deposit'
  const quote = controller.quote
  const needsApproval = !!quote?.approval && controller.allowance < quote.approval.amount
  const actionLabel = controller.isQuoteLoading
    ? copy.findingRoute
    : controller.mode === 'withdraw'
      ? needsApproval
        ? copy.approveAndWithdraw
        : copy.submitWithdraw
      : needsApproval
        ? copy.approveAndDeposit
        : copy.submitDeposit
  const inputAmount = Number(controller.amount || '0')
  const inputPriceUsd = controller.selectedToken.priceUsd ?? 0
  const inputUsd = inputAmount * inputPriceUsd
  const positionValue = Number(formatUnits(controller.positionValue, config.positionToken.decimals))
  const positionUsd = positionValue * (config.display?.assetPriceUsd ?? 0)
  const positionAmount = quote?.positionAmount ?? 0n
  const expectedOut = quote?.expectedOut ?? 0n
  const assetValue = quote?.assetValue ?? 0n
  const assetToken = config.depositTokens[0] ?? controller.selectedToken
  const assetValueFormatted = formatWidgetValue(assetValue, assetToken.decimals)
  const assetValueNumeric = Number(formatUnits(assetValue, assetToken.decimals))
  const estimatedAnnualReturn = assetValueNumeric * (config.display?.estimatedApr ?? 0)
  const positionLabel = config.display?.positionLabel ?? config.positionToken.symbol
  const approvalToken =
    quote?.approval?.token ??
    controller.approvalTarget?.token ??
    (transactionMode === 'withdraw' ? config.positionToken : controller.selectedToken)
  const approvalSpenderName = config.display?.approvalSpenderName?.[transactionMode]
  const allowanceFormatted = formatWidgetAllowance(controller.allowance, approvalToken.decimals)

  const setMode = (nextMode: VaultWidgetMode): void => {
    setSelectedPercentage(null)
    setTokenSelectorOpen(false)
    controller.setMode(nextMode)
  }

  const closeTokenSelector = useCallback((): void => {
    setTokenSelectorOpen(false)
    window.requestAnimationFrame(() => tokenSelectorButtonRef.current?.focus())
  }, [])

  const settingsButton = (placement: 'header' | 'action'): ReactElement | null =>
    placement === 'header' || controller.account || !showNavigation ? (
      <button
        className={`yv-widget__settings-button yv-widget__settings-button--${placement}`}
        type="button"
        aria-label={copy.settings}
        aria-expanded={settingsOpen}
        aria-controls="yv-widget-settings"
        onClick={() => {
          setTokenSelectorOpen(false)
          setSettingsOpen(true)
        }}
      >
        <SettingsIcon />
      </button>
    ) : null

  return (
    <section
      className={['yv-widget', className].filter(Boolean).join(' ')}
      style={style}
      data-navigation={showNavigation ? 'full' : 'none'}
      data-viewport={viewport}
      aria-label={`${config.name} vault actions`}
    >
      {showNavigation ? (
        <div className="yv-widget__navigation">
          {Header ? (
            <Header mode={controller.mode} name={config.name} />
          ) : (
            <div className="yv-widget__summary">
              <div className="yv-widget__summary-desktop">
                <p>Your deposits</p>
                <strong>{formatUsd(positionUsd)}</strong>
              </div>
              <div className="yv-widget__summary-mobile">
                <h2>{config.name}</h2>
              </div>
              <div className="yv-widget__summary-actions">
                {settingsButton('header')}
                {onClose ? (
                  <button className="yv-widget__close-button" type="button" aria-label="Close" onClick={onClose}>
                    <CloseIcon />
                  </button>
                ) : null}
              </div>
            </div>
          )}

          <div className="yv-widget__tabs" role="tablist" aria-label="Vault action">
            {controller.modes.map((availableMode) => (
              <button
                className="yv-widget__tab"
                data-active={controller.mode === availableMode}
                data-mode={availableMode}
                key={availableMode}
                type="button"
                role="tab"
                aria-selected={controller.mode === availableMode}
                onClick={() => setMode(availableMode)}
              >
                {getModeLabel(availableMode, config.display?.modeLabels)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {settingsOpen ? (
        <SettingsPanel
          settings={controller.settings}
          title={copy.settings}
          onChange={controller.setSettings}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}

      {!settingsOpen && controller.mode === 'info' ? (
        <div className="yv-widget__panel">
          <ActivityPanel
            availableBalance={controller.balance}
            availableToken={controller.selectedToken}
            depositedValueUsd={formatUsd(positionUsd)}
            onConnectWallet={onConnectWallet}
            positionBalance={controller.positionBalance}
            positionToken={config.positionToken}
          />
        </div>
      ) : null}
      {!settingsOpen && (controller.mode === 'migrate' || controller.mode === 'rewards')
        ? renderPanel?.(controller.mode)
        : null}

      {!settingsOpen && isTransactionMode ? (
        <div className="yv-widget__body" data-token-selector-open={tokenSelectorOpen}>
          <h3 className="yv-widget__body-title">{getModeLabel(controller.mode, config.display?.modeLabels)}</h3>

          <div className="yv-widget__amount-panel">
            <div className="yv-widget__amount-meta">
              <span>{copy.amount}</span>
              <div className="yv-widget__percentages" aria-label="Choose percentage of available balance">
                {[25, 50, 75, 100].map((percentage) => (
                  <button
                    type="button"
                    key={percentage}
                    aria-pressed={selectedPercentage === percentage}
                    disabled={!controller.account || controller.balance === 0n}
                    onClick={() => {
                      setSelectedPercentage(percentage)
                      controller.setPercentage(percentage)
                    }}
                  >
                    {percentage === 100 ? 'Max' : `${percentage}%`}
                  </button>
                ))}
              </div>
            </div>

            <div className="yv-widget__amount-row">
              <input
                className="yv-widget__amount-input"
                inputMode="decimal"
                aria-label={`${copy.amount} of ${controller.selectedToken.symbol}`}
                placeholder="0.00"
                value={controller.amount}
                onChange={(event) => {
                  setSelectedPercentage(null)
                  controller.setAmount(event.target.value)
                }}
              />
              <button
                ref={tokenSelectorButtonRef}
                className="yv-widget__token-select"
                type="button"
                aria-haspopup="dialog"
                aria-expanded={tokenSelectorOpen}
                onClick={() => {
                  setSettingsOpen(false)
                  setTokenSelectorOpen(true)
                }}
              >
                <TokenIcon token={controller.selectedToken} size={32} />
                <span>{controller.selectedToken.symbol}</span>
                <ChevronDownIcon />
              </button>
            </div>
            <div className="yv-widget__amount-footer">
              <span>{formatUsd(inputUsd)}</span>
              {controller.account && controller.balance > 0n ? (
                <span>
                  {copy.balance}: {formatWalletBalance(controller.balance, controller.selectedToken.decimals)}{' '}
                  {controller.selectedToken.symbol}
                </span>
              ) : !controller.account ? (
                <button type="button" onClick={() => onConnectWallet?.()}>
                  Connect wallet
                </button>
              ) : null}
            </div>
          </div>

          {Details ? (
            <Details quote={quote} mode={transactionMode} />
          ) : (
            <dl className="yv-widget__details">
              {transactionMode === 'deposit' ? (
                <>
                  <div>
                    <dt>{copy.youWillDeposit}</dt>
                    <dd>
                      <DetailValue
                        amount={formatInputAmount(controller.amount)}
                        unit={controller.selectedToken.symbol}
                      />
                    </dd>
                  </div>
                  <div>
                    <dt className="yv-widget__detail-link">{copy.youWillReceive}</dt>
                    <dd>
                      <DetailValue
                        amount={formatWidgetValue(positionAmount, config.positionToken.decimals)}
                        unit={positionLabel}
                      />
                    </dd>
                  </div>
                  <div>
                    <dt className="yv-widget__detail-link">{copy.vaultShareValue}</dt>
                    <dd>
                      <DetailValue
                        amount={assetValueFormatted}
                        unit={`${assetToken.symbol} (${formatUsd(
                          assetValueNumeric * (config.display?.assetPriceUsd ?? 0)
                        )})`}
                      />
                    </dd>
                  </div>
                  <div>
                    <dt className="yv-widget__detail-link">{copy.estimatedAnnualReturn}</dt>
                    <dd>
                      <DetailValue amount={formatWidgetValue(estimatedAnnualReturn)} unit={assetToken.symbol} />
                    </dd>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <dt className="yv-widget__detail-link">{copy.unstakeAndRedeem}</dt>
                    <dd>
                      <DetailValue
                        amount={formatWidgetValue(positionAmount, config.positionToken.decimals)}
                        unit="Vault shares"
                      />
                    </dd>
                  </div>
                  <div>
                    <dt>{copy.youWillReceive}</dt>
                    <dd>
                      <DetailValue
                        amount={formatWidgetValue(expectedOut, controller.selectedToken.decimals)}
                        unit={controller.selectedToken.symbol}
                      />
                    </dd>
                  </div>
                </>
              )}
              <div>
                <dt className="yv-widget__detail-link">
                  {copy.existingApproval}
                  {approvalSpenderName ? ` (${approvalSpenderName})` : ''}
                </dt>
                <dd>
                  <DetailValue
                    amount={allowanceFormatted}
                    unit={allowanceFormatted === 'Unlimited' ? undefined : approvalToken.symbol}
                  />
                </dd>
              </div>
              {quote?.priceImpactPercent !== undefined ? (
                <div>
                  <dt>Est. price impact</dt>
                  <dd>
                    <strong>{quote.priceImpactPercent?.toFixed(2) ?? '—'}%</strong>
                  </dd>
                </div>
              ) : null}
            </dl>
          )}

          {controller.overBalance ? (
            <div className="yv-widget__notice yv-widget__notice--error" role="alert">
              Amount exceeds the available balance.
            </div>
          ) : null}
          {controller.error ? (
            <div className="yv-widget__notice yv-widget__notice--error" role="alert">
              {controller.error.message || copy.noRoute}
            </div>
          ) : null}
          <TransactionStatus execution={controller.execution} />

          <div className="yv-widget__action-row">
            <div className="yv-widget__action-primary">
              {controller.account ? (
                <button
                  className="yv-widget__button yv-widget__button--primary"
                  disabled={!controller.canSubmit}
                  type="button"
                  onClick={() => void controller.submit()}
                >
                  {actionLabel}
                </button>
              ) : (
                <ConnectButton onClick={() => onConnectWallet?.()} label={copy.connect} />
              )}
            </div>
            {settingsButton('action')}
          </div>

          {tokenSelectorOpen ? (
            <TokenSelectorOverlay
              balance={
                controller.account
                  ? `${formatWalletBalance(controller.balance, controller.selectedToken.decimals)} ${
                      controller.selectedToken.symbol
                    }`
                  : undefined
              }
              chains={config.tokenSelector?.chains}
              defaultTokens={config.tokenSelector?.defaultTokens?.[transactionMode]}
              mode={transactionMode}
              selectedToken={controller.selectedToken}
              TokenIcon={TokenIcon}
              tokens={controller.tokens}
              onClose={closeTokenSelector}
              onChange={(token) => {
                setSelectedPercentage(null)
                controller.setSelectedToken(token)
                closeTokenSelector()
              }}
            />
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

export function VaultWidget(props: VaultWidgetProps): ReactElement {
  const services = useVaultWidgetServices()
  const configQuery = useQuery({
    queryKey: ['vault-widget', 'config', props.chainId, props.vaultAddress],
    queryFn: ({ signal }) => services.configResolver.resolve(props.chainId, props.vaultAddress, signal),
    enabled: !props.config,
    staleTime: 3_600_000
  })
  const config = props.config ?? configQuery.data

  if (!config) {
    return (
      <section
        className={['yv-widget', props.className].filter(Boolean).join(' ')}
        style={props.style}
        data-viewport={props.viewport ?? 'auto'}
        aria-label="Vault actions"
      >
        <div className="yv-widget__notice" role={configQuery.error ? 'alert' : 'status'}>
          {configQuery.error
            ? configQuery.error instanceof Error
              ? configQuery.error.message
              : 'Unable to load vault metadata.'
            : 'Loading vault…'}
        </div>
      </section>
    )
  }

  return <ConfiguredVaultWidget {...props} config={config} />
}
