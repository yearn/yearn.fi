'use client'

import { useQuery } from '@tanstack/react-query'
import { type ReactElement, useEffect, useMemo, useState } from 'react'
import { formatUnits } from 'viem'
import { usePublicClient, useSignTypedData } from 'wagmi'
import { useVaultWidgetServices } from '../context'
import {
  createMigrationQuote,
  detectMigrationPermitSupport,
  getMigrationAuthorizationMode,
  readMigrationPermitTypedData,
  splitMigrationPermitSignature,
  supportsMigrationPermit,
  type VaultWidgetPermitSignature,
  YEARN_4626_ROUTER_ADDRESS
} from '../headless/migration'
import { useVaultWidgetActionController } from '../headless/useVaultWidgetActionController'
import type { VaultWidgetConfig, VaultWidgetEvent } from '../types'
import { formatWalletBalance } from '../valueDisplay'
import { TransactionStatus } from './TransactionStatus'

type MigrationPanelProps = {
  account?: `0x${string}`
  config: VaultWidgetConfig
  onConnectWallet?: () => void
  onEvent?: (event: VaultWidgetEvent) => void
  onError?: (event: Extract<VaultWidgetEvent, { type: 'transaction_failed' }>) => void
  onRefresh: () => Promise<void>
  onSuccess?: (event: Extract<VaultWidgetEvent, { type: 'transaction_succeeded' }>) => void
  positionBalance: bigint
}

function shortAddress(address: `0x${string}`): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export function MigrationPanel({
  account,
  config,
  onConnectWallet,
  onEvent,
  onError,
  onRefresh,
  onSuccess,
  positionBalance
}: MigrationPanelProps): ReactElement {
  const migration = config.migration
  const services = useVaultWidgetServices()
  const publicClient = usePublicClient({ chainId: config.chainId })
  const { signTypedDataAsync, isPending: isSigning } = useSignTypedData()
  const [permit, setPermit] = useState<VaultWidgetPermitSignature>()
  const [permitError, setPermitError] = useState<string>()
  const [submitAfterPermit, setSubmitAfterPermit] = useState(false)
  const permitEligible = migration ? supportsMigrationPermit(migration) : false
  const permitSupportQuery = useQuery({
    queryKey: ['vault-widget', config.id, 'migration-permit', account],
    queryFn: () => {
      if (!publicClient) return false
      return detectMigrationPermitSupport(publicClient, config.positionToken.address)
    },
    enabled: !!account && !!publicClient && permitEligible,
    staleTime: Number.POSITIVE_INFINITY
  })
  const targetConfigQuery = useQuery({
    queryKey: ['vault-widget', 'config', config.chainId, migration?.targetVault],
    queryFn: ({ signal }) => {
      if (!migration) throw new Error('Migration is not configured')
      return services.configResolver.resolve(config.chainId, migration.targetVault, signal)
    },
    enabled: !!migration && !migration.targetToken,
    staleTime: 3_600_000
  })
  const targetToken = migration?.targetToken ?? targetConfigQuery.data?.positionToken
  const permitSupported = permitEligible && permitSupportQuery.data === true
  const quote = useMemo(
    () =>
      account && migration && positionBalance > 0n
        ? createMigrationQuote({
            account,
            chainId: config.chainId,
            fromToken: config.positionToken,
            migratorAddress: migration.migratorAddress,
            permit,
            shares: positionBalance,
            sourceVersion: migration.sourceVersion,
            toVault: migration.targetVault
          })
        : undefined,
    [account, config.chainId, config.positionToken, migration, permit, positionBalance]
  )
  const action = useVaultWidgetActionController({
    activity: {
      chainId: config.chainId,
      destinationChainId: config.chainId,
      tokenIn: config.positionToken.address,
      tokenOut: migration?.targetVault
    },
    mode: 'migrate',
    onError,
    onEvent,
    onRefresh,
    onSuccess,
    quote
  })
  const supportsPermit =
    getMigrationAuthorizationMode({
      permitSupported,
      walletType: action.walletType
    }) === 'permit'
  const hasIncompatiblePermit = action.walletType === 'safe' && !!permit
  useEffect(() => {
    if (!hasIncompatiblePermit) return
    setPermit(undefined)
    setSubmitAfterPermit(false)
  }, [hasIncompatiblePermit])
  const needsApproval = !!quote?.approval && action.allowance < quote.approval.amount
  const signPermit = async (): Promise<void> => {
    if (!account || !publicClient || positionBalance <= 0n) return
    setPermitError(undefined)
    try {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60)
      const typedData = await readMigrationPermitTypedData({
        account,
        chainId: config.chainId,
        deadline,
        publicClient,
        spender: YEARN_4626_ROUTER_ADDRESS,
        tokenAddress: config.positionToken.address,
        value: positionBalance
      })
      const signature = await signTypedDataAsync({
        account,
        ...typedData
      })
      setPermit(splitMigrationPermitSignature(signature, deadline))
      setSubmitAfterPermit(true)
    } catch (value) {
      const error = value instanceof Error ? value : new Error(String(value))
      if (!/rejected|denied/i.test(error.message)) setPermitError(error.message)
    }
  }

  const { canSubmit, submit } = action
  useEffect(() => {
    if (!submitAfterPermit || !canSubmit || !permit) return
    setSubmitAfterPermit(false)
    void submit()
  }, [canSubmit, permit, submit, submitAfterPermit])

  if (!migration) {
    return <p className="yv-widget__empty">Migration is not configured for this vault.</p>
  }

  return (
    <div className="yv-widget__workflow">
      <div className="yv-widget__workflow-balance">
        <span>Your Balance</span>
        <strong>
          {formatWalletBalance(positionBalance, config.positionToken.decimals)} {config.positionToken.symbol}
        </strong>
        <small>
          {formatUnits(positionBalance, config.positionToken.decimals) === '0'
            ? 'Nothing to migrate'
            : 'The complete direct vault balance will be migrated.'}
        </small>
      </div>

      <div className="yv-widget__workflow-destination">
        <span>Destination</span>
        <div>
          <span className="yv-widget__token-fallback" aria-hidden="true">
            {(targetToken?.symbol ?? 'V').slice(0, 1)}
          </span>
          <span>
            <strong>{targetToken?.name ?? targetToken?.symbol ?? 'Replacement vault'}</strong>
            <small>{shortAddress(migration.targetVault)}</small>
          </span>
        </div>
      </div>

      <TransactionStatus execution={action.execution} />
      {permitError ? (
        <div className="yv-widget__notice yv-widget__notice--error" role="alert">
          {permitError}
        </div>
      ) : null}

      {!account ? (
        <button className="yv-widget__button yv-widget__button--primary" type="button" onClick={onConnectWallet}>
          Connect Wallet
        </button>
      ) : (
        <button
          className="yv-widget__button yv-widget__button--primary"
          disabled={!action.canSubmit || positionBalance === 0n || hasIncompatiblePermit}
          type="button"
          onClick={() => (supportsPermit && !permit ? void signPermit() : void action.submit())}
        >
          {positionBalance === 0n
            ? 'Nothing to migrate'
            : isSigning || permitSupportQuery.isLoading
              ? 'Preparing permit…'
              : supportsPermit && !permit
                ? 'Sign & Migrate'
                : needsApproval
                  ? 'Approve & Migrate'
                  : 'Migrate All'}
        </button>
      )}
    </div>
  )
}
