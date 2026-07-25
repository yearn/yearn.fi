'use client'

import { useQuery } from '@tanstack/react-query'
import { type ComponentType, type ReactElement, type ReactNode, useEffect, useMemo, useState } from 'react'
import { formatUnits, type Hash } from 'viem'
import { usePublicClient, useSignTypedData } from 'wagmi'
import { useVaultWidgetServices } from '../context'
import {
  createMigrationQuote,
  detectMigrationPermitSupport,
  getMigrationAuthorizationMode,
  isMigrationPermitValid,
  readMigrationPermitTypedData,
  splitMigrationPermitSignature,
  supportsMigrationPermit,
  type VaultWidgetPermitSignature,
  YEARN_4626_ROUTER_ADDRESS
} from '../headless/migration'
import { useVaultWidgetActionController } from '../headless/useVaultWidgetActionController'
import type { VaultWidgetConfig, VaultWidgetCopy, VaultWidgetEvent, VaultWidgetExecutionState } from '../types'
import { formatWalletBalance } from '../valueDisplay'
import { TransactionOverlay } from './TransactionOverlay'

type MigrationPanelProps = {
  account?: `0x${string}`
  config: VaultWidgetConfig
  copy: VaultWidgetCopy
  onConnectWallet?: () => void
  onEvent?: (event: VaultWidgetEvent) => void
  onError?: (event: Extract<VaultWidgetEvent, { type: 'transaction_failed' }>) => void
  onRefresh: () => Promise<void>
  onSuccess?: (event: Extract<VaultWidgetEvent, { type: 'transaction_succeeded' }>) => void
  positionBalance: bigint
  TransactionLink?: ComponentType<{ chainId: number; hash: Hash; children: ReactNode }>
}

function shortAddress(address: `0x${string}`): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export function MigrationPanel({
  account,
  config,
  copy,
  onConnectWallet,
  onEvent,
  onError,
  onRefresh,
  onSuccess,
  positionBalance,
  TransactionLink
}: MigrationPanelProps): ReactElement {
  const migration = config.migration
  const services = useVaultWidgetServices()
  const publicClient = usePublicClient({ chainId: config.chainId })
  const { signTypedDataAsync, isPending: isSigning } = useSignTypedData()
  const [permit, setPermit] = useState<VaultWidgetPermitSignature>()
  const [permitTimestamp, setPermitTimestamp] = useState<bigint>()
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
  const validPermit =
    account &&
    permit &&
    permitTimestamp !== undefined &&
    isMigrationPermitValid({
      account,
      chainId: config.chainId,
      currentTimestamp: permitTimestamp,
      permit,
      spender: YEARN_4626_ROUTER_ADDRESS,
      token: config.positionToken.address,
      value: positionBalance
    })
      ? permit
      : undefined
  const quote = useMemo(
    () =>
      account && migration && positionBalance > 0n
        ? createMigrationQuote({
            account,
            chainId: config.chainId,
            currentTimestamp: permitTimestamp,
            fromToken: config.positionToken,
            migratorAddress: migration.migratorAddress,
            permit: validPermit,
            shares: positionBalance,
            sourceVersion: migration.sourceVersion,
            toVault: migration.targetVault
          })
        : undefined,
    [account, config.chainId, config.positionToken, migration, permitTimestamp, positionBalance, validPermit]
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
  const hasStalePermit = !!permit && !validPermit
  useEffect(() => {
    if (!hasIncompatiblePermit && !hasStalePermit) return
    setPermit(undefined)
    setPermitTimestamp(undefined)
    setSubmitAfterPermit(false)
  }, [hasIncompatiblePermit, hasStalePermit])
  useEffect(() => {
    if (!permit || permitTimestamp === undefined) return
    const millisecondsUntilExpiry = Number(permit.deadline - permitTimestamp) * 1_000
    if (millisecondsUntilExpiry <= 0) {
      setPermit(undefined)
      setPermitTimestamp(undefined)
      setSubmitAfterPermit(false)
      return
    }
    // A browser timer is required to invalidate an otherwise unchanged signed permit at its deadline.
    const timeout = globalThis.setTimeout(() => {
      setPermit(undefined)
      setPermitTimestamp(undefined)
      setSubmitAfterPermit(false)
    }, millisecondsUntilExpiry)
    return () => globalThis.clearTimeout(timeout)
  }, [permit, permitTimestamp])
  const needsApproval = !!quote?.approval && action.allowance < quote.approval.amount
  const signPermit = async (): Promise<void> => {
    if (!account || !publicClient || positionBalance <= 0n) return
    setPermitError(undefined)
    try {
      const signingBlock = await publicClient.getBlock()
      const deadline = signingBlock.timestamp + 20n * 60n
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
      const [validationBlock, validationTypedData] = await Promise.all([
        publicClient.getBlock(),
        readMigrationPermitTypedData({
          account,
          chainId: config.chainId,
          deadline,
          publicClient,
          spender: YEARN_4626_ROUTER_ADDRESS,
          tokenAddress: config.positionToken.address,
          value: positionBalance
        })
      ])
      if (validationBlock.timestamp >= deadline) throw new Error('Migration permit expired before submission')
      if (validationTypedData.message.nonce !== typedData.message.nonce) {
        throw new Error('Migration permit nonce changed before submission')
      }
      setPermit(
        splitMigrationPermitSignature(signature, {
          chainId: config.chainId,
          deadline,
          owner: account,
          spender: YEARN_4626_ROUTER_ADDRESS,
          token: config.positionToken.address,
          value: positionBalance
        })
      )
      setPermitTimestamp(validationBlock.timestamp)
      setSubmitAfterPermit(true)
    } catch (value) {
      const error = value instanceof Error ? value : new Error(String(value))
      if (!/rejected|denied/i.test(error.message)) setPermitError(error.message)
    }
  }

  const { canSubmit, submit } = action
  useEffect(() => {
    if (!submitAfterPermit || !canSubmit || !validPermit) return
    setSubmitAfterPermit(false)
    void submit()
  }, [canSubmit, submit, submitAfterPermit, validPermit])

  if (!migration) {
    return <p className="yv-widget__empty">Migration is not configured for this vault.</p>
  }
  const displayedExecution: VaultWidgetExecutionState = isSigning
    ? {
        status: 'confirming',
        step: {
          id: 'migration-permit',
          kind: 'permit',
          label: 'Sign migration permit',
          chainId: config.chainId
        },
        stepCount: 1,
        stepIndex: 0
      }
    : action.execution

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
          disabled={
            !action.canSubmit ||
            positionBalance === 0n ||
            hasIncompatiblePermit ||
            isSigning ||
            (permitEligible && permitSupportQuery.isLoading)
          }
          type="button"
          onClick={() => (supportsPermit && !validPermit ? void signPermit() : void action.submit())}
        >
          {positionBalance === 0n
            ? 'Nothing to migrate'
            : isSigning || permitSupportQuery.isLoading
              ? 'Preparing permit…'
              : supportsPermit && !validPermit
                ? 'Sign & Migrate'
                : needsApproval
                  ? 'Approve & Migrate'
                  : 'Migrate All'}
        </button>
      )}
      <TransactionOverlay
        chainId={config.chainId}
        copy={copy}
        execution={displayedExecution}
        onReset={action.resetExecution}
        TransactionLink={TransactionLink}
      />
    </div>
  )
}
