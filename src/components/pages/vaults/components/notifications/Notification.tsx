import { TokenLogo } from '@shared/components/TokenLogo'
import { useNotifications } from '@shared/contexts/useNotifications'
import { useTransactionStatusPoller } from '@shared/hooks/useTransactionStatusPoller'
import { IconArrow } from '@shared/icons/IconArrow'
import { IconCheck } from '@shared/icons/IconCheck'
import { IconClose } from '@shared/icons/IconClose'
import { IconCross } from '@shared/icons/IconCross'
import { IconLoader } from '@shared/icons/IconLoader'
import type { TNotification, TNotificationStatus } from '@shared/types/notifications'
import { cl, SUPPORTED_NETWORKS, truncateHex } from '@shared/utils'
import type { ReactElement } from 'react'
import { memo, useCallback, useMemo, useState } from 'react'
import Link from '/src/components/Link'

const NETWORK_BY_CHAIN_ID = new Map(SUPPORTED_NETWORKS.map((network) => [network.id, network] as const)) as ReadonlyMap<
  number,
  (typeof SUPPORTED_NETWORKS)[number]
>

const STATUS: { [key: string]: [string, string, ReactElement] } = {
  success: ['Success', 'text-white bg-[#00796D]', <IconCheck className={'size-4'} key={'success'} />],
  submitted: ['Submitted', 'text-white bg-[#2563EB]', <IconCheck className={'size-4'} key={'submitted'} />],
  pending: [
    'Pending',
    'text-text-primary bg-surface-tertiary',
    <IconLoader className={'size-4 animate-spin'} key={'pending'} />
  ],
  error: ['Error', 'text-white bg-[#C73203] bg-opacity-90', <IconCross className={'size-3'} key={'error'} />]
}

function NotificationStatus(props: { status: TNotificationStatus }): ReactElement {
  return (
    <div
      className={cl(
        'flex gap-2 justify-center self-start py-2 px-4 items-center rounded-lg text-xs',
        STATUS[props.status][1]
      )}
      aria-label={`Status: ${STATUS[props.status][0]}`}
    >
      {STATUS[props.status][2]}
      {STATUS[props.status][0]}
    </div>
  )
}

function ApproveNotificationContent({ notification }: { notification: TNotification }): ReactElement {
  const fromChainName = SUPPORTED_NETWORKS.find((network) => network.id === notification.chainId)?.name || 'Unknown'

  const explorerBaseURI = useMemo(() => {
    const chain = SUPPORTED_NETWORKS.find((network) => network.id === notification.chainId)
    return chain?.blockExplorers?.default?.url || 'https://etherscan.io'
  }, [notification.chainId])

  return (
    <div className={'flex gap-4'}>
      <div className={'flex flex-col items-center gap-3'}>
        <TokenLogo
          src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${notification.chainId}/${notification.fromAddress ? notification.fromAddress.toLowerCase() : '0x0'}/logo-32.png`}
          altSrc={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${notification.chainId}/${notification.fromAddress ? notification.fromAddress.toLowerCase() : '0x0'}/logo-32.png`}
          tokenSymbol={notification.fromTokenName}
          chainId={notification.chainId}
          width={32}
          height={32}
          className="rounded-full"
          loading="eager"
        />
      </div>
      <div className={'flex-1'}>
        <div className={'grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-text-primary'}>
          <p>{'Address:'}</p>
          <p className={'text-right font-bold'}>
            <Link
              href={`${explorerBaseURI}/address/${notification.address}`}
              target={'_blank'}
              rel={'noopener noreferrer'}
              aria-label={`View address ${notification.address} on explorer`}
              className={'text-text-primary hover:text-text-secondary'}
            >
              <button className={'text-xs font-medium underline'}>{truncateHex(notification.address, 5)}</button>
            </Link>
          </p>
          <p>{'Token:'}</p>
          <p className={'text-right font-bold'}>
            <Link
              href={`${explorerBaseURI}/address/${notification.fromAddress || '0x0'}`}
              target={'_blank'}
              rel={'noopener noreferrer'}
              aria-label={`View token ${notification.fromTokenName || 'Unknown'} on explorer`}
              className={'text-text-primary hover:text-text-secondary'}
            >
              <button className={'text-xs font-medium underline'}>
                {notification.amount} {notification.fromTokenName || 'Unknown'}
              </button>
            </Link>
          </p>
          {notification.spenderAddress && (
            <>
              <p>{'Spender:'}</p>
              <p className={'text-right font-bold'}>
                <Link
                  href={`${explorerBaseURI}/address/${notification.spenderAddress}`}
                  target={'_blank'}
                  rel={'noopener noreferrer'}
                  aria-label={`View spender ${notification.spenderAddress} on explorer`}
                  className={'text-text-primary hover:text-text-secondary'}
                >
                  <button className={'text-xs font-medium underline'}>
                    {notification.spenderName || truncateHex(notification.spenderAddress, 5)}
                  </button>
                </Link>
              </p>
            </>
          )}
          <p>{'Chain:'}</p>
          <p className={'text-right font-bold'}>{fromChainName}</p>
        </div>
      </div>
    </div>
  )
}

function DepositNotificationContent({ notification }: { notification: TNotification }): ReactElement {
  const fromChainName = NETWORK_BY_CHAIN_ID.get(notification.chainId)?.name || 'Unknown'
  const toChainName = notification.toChainId
    ? NETWORK_BY_CHAIN_ID.get(notification.toChainId)?.name || 'Unknown'
    : undefined
  const isCrossChain = !!notification.toChainId && notification.toChainId !== notification.chainId

  const explorerBaseURI = useMemo(() => {
    const chain = NETWORK_BY_CHAIN_ID.get(notification.chainId)
    return chain?.blockExplorers?.default?.url || 'https://etherscan.io'
  }, [notification.chainId])

  const toChainExplorerBaseURI = useMemo(() => {
    if (!notification.toChainId) return explorerBaseURI
    const chain = SUPPORTED_NETWORKS.find((network) => network.id === notification.toChainId)
    return chain?.blockExplorers?.default?.url || 'https://etherscan.io'
  }, [notification.toChainId, explorerBaseURI])

  return (
    <div className={'flex gap-4'}>
      <div className={'flex flex-col items-center gap-3'}>
        <TokenLogo
          src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${notification.chainId}/${notification.fromAddress ? notification.fromAddress.toLowerCase() : '0x0'}/logo-32.png`}
          altSrc={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${notification.chainId}/${notification.fromAddress ? notification.fromAddress.toLowerCase() : '0x0'}/logo-32.png`}
          tokenSymbol={notification.fromTokenName}
          chainId={notification.chainId}
          width={32}
          height={32}
          className="rounded-full"
          loading="eager"
        />

        {notification.toTokenName && <IconArrow className={'size-4 rotate-135'} />}

        {notification.toTokenName && notification.toAddress && (
          <TokenLogo
            src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${notification.toChainId || notification.chainId}/${notification.toAddress.toLowerCase()}/logo-32.png`}
            altSrc={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${notification.toChainId || notification.chainId}/${notification.toAddress.toLowerCase()}/logo-32.png`}
            tokenSymbol={notification.toTokenName}
            chainId={notification.toChainId || notification.chainId}
            width={32}
            height={32}
            className="rounded-full"
            loading="eager"
          />
        )}
      </div>
      <div className={'flex-1'}>
        <div className={'grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-text-primary'}>
          <p>{'Address:'}</p>
          <p className={'text-right font-bold'}>
            <Link
              href={`${explorerBaseURI}/address/${notification.address}`}
              target={'_blank'}
              rel={'noopener noreferrer'}
              aria-label={`View address ${notification.address} on explorer`}
              className={'text-text-primary hover:text-text-secondary'}
            >
              <button className={'text-xs font-medium underline'}>{truncateHex(notification.address, 5)}</button>
            </Link>
          </p>
          <p>{'Token:'}</p>
          <p className={'text-right font-bold'}>
            <Link
              href={`${explorerBaseURI}/address/${notification.fromAddress || '0x0'}`}
              target={'_blank'}
              rel={'noopener noreferrer'}
              aria-label={`View token ${notification.fromTokenName || 'Unknown'} on explorer`}
              className={'text-text-primary hover:text-text-secondary'}
            >
              <button className={'text-xs font-medium underline'}>
                {notification.amount} {notification.fromTokenName || 'Unknown'}
              </button>
            </Link>
          </p>
          {notification.toTokenName && notification.toAddress && (
            <>
              <p>{'To vault:'}</p>
              <p className={'text-right font-bold'}>
                <Link
                  href={`${toChainExplorerBaseURI}/address/${notification.toAddress}`}
                  target={'_blank'}
                  rel={'noopener noreferrer'}
                  aria-label={`View vault ${notification.toTokenName} on explorer`}
                  className={'text-text-primary hover:text-text-secondary'}
                >
                  <button className={'text-xs font-medium underline'}>{notification.toTokenName}</button>
                </Link>
              </p>
            </>
          )}
          {isCrossChain ? (
            <>
              <p>{'From:'}</p>
              <p className={'text-right font-bold'}>{fromChainName}</p>
              <p>{'To:'}</p>
              <p className={'text-right font-bold'}>{toChainName}</p>
            </>
          ) : (
            <>
              <p>{'Chain:'}</p>
              <p className={'text-right font-bold'}>{fromChainName}</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function WithdrawNotificationContent({ notification }: { notification: TNotification }): ReactElement {
  const fromChainName = SUPPORTED_NETWORKS.find((network) => network.id === notification.chainId)?.name || 'Unknown'
  const toChainName = notification.toChainId
    ? SUPPORTED_NETWORKS.find((network) => network.id === notification.toChainId)?.name || 'Unknown'
    : undefined
  const isCrossChain = !!notification.toChainId && notification.toChainId !== notification.chainId

  const explorerBaseURI = useMemo(() => {
    const chain = SUPPORTED_NETWORKS.find((network) => network.id === notification.chainId)
    return chain?.blockExplorers?.default?.url || 'https://etherscan.io'
  }, [notification.chainId])

  const toChainExplorerBaseURI = useMemo(() => {
    if (!notification.toChainId) return explorerBaseURI
    const chain = SUPPORTED_NETWORKS.find((network) => network.id === notification.toChainId)
    return chain?.blockExplorers?.default?.url || 'https://etherscan.io'
  }, [notification.toChainId, explorerBaseURI])

  return (
    <div className={'flex gap-4'}>
      <div className={'flex flex-col items-center gap-3'}>
        <TokenLogo
          src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${notification.chainId}/${notification.fromAddress ? notification.fromAddress.toLowerCase() : '0x0'}/logo-32.png`}
          altSrc={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${notification.chainId}/${notification.fromAddress ? notification.fromAddress.toLowerCase() : '0x0'}/logo-32.png`}
          tokenSymbol={notification.fromTokenName}
          chainId={notification.chainId}
          width={32}
          height={32}
          className="rounded-full"
          loading="eager"
        />

        {notification.toTokenName && <IconArrow className={'size-4 rotate-135'} />}

        {notification.toTokenName && notification.toAddress && (
          <TokenLogo
            src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${notification.toChainId || notification.chainId}/${notification.toAddress.toLowerCase()}/logo-32.png`}
            altSrc={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${notification.toChainId || notification.chainId}/${notification.toAddress.toLowerCase()}/logo-32.png`}
            tokenSymbol={notification.toTokenName}
            chainId={notification.toChainId || notification.chainId}
            width={32}
            height={32}
            className="rounded-full"
            loading="eager"
          />
        )}
      </div>
      <div className={'flex-1'}>
        <div className={'grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-text-primary'}>
          <p>{'Address:'}</p>
          <p className={'text-right font-bold'}>
            <Link
              href={`${explorerBaseURI}/address/${notification.address}`}
              target={'_blank'}
              rel={'noopener noreferrer'}
              aria-label={`View address ${notification.address} on explorer`}
              className={'text-text-primary hover:text-text-secondary'}
            >
              <button className={'text-xs font-medium underline'}>{truncateHex(notification.address, 5)}</button>
            </Link>
          </p>
          <p>{'Redeem:'}</p>
          <p className={'text-right font-bold'}>
            <Link
              href={`${explorerBaseURI}/address/${notification.fromAddress || '0x0'}`}
              target={'_blank'}
              rel={'noopener noreferrer'}
              aria-label={`View vault ${notification.fromTokenName || 'Unknown'} on explorer`}
              className={'text-text-primary hover:text-text-secondary'}
            >
              <button className={'text-xs font-medium underline'}>
                {notification.amount} {notification.fromTokenName || 'Unknown'}
              </button>
            </Link>
          </p>
          {notification.toTokenName && notification.toAddress && (
            <>
              <p>{'Receive:'}</p>
              <p className={'text-right font-bold'}>
                <Link
                  href={`${toChainExplorerBaseURI}/address/${notification.toAddress}`}
                  target={'_blank'}
                  rel={'noopener noreferrer'}
                  aria-label={`View token ${notification.toTokenName} on explorer`}
                  className={'text-text-primary hover:text-text-secondary'}
                >
                  <button className={'text-xs font-medium underline'}>
                    {notification.toAmount
                      ? `${notification.toAmount} ${notification.toTokenName}`
                      : notification.toTokenName}
                  </button>
                </Link>
              </p>
            </>
          )}
          {isCrossChain ? (
            <>
              <p>{'From:'}</p>
              <p className={'text-right font-bold'}>{fromChainName}</p>
              <p>{'To:'}</p>
              <p className={'text-right font-bold'}>{toChainName}</p>
            </>
          ) : (
            <>
              <p>{'Chain:'}</p>
              <p className={'text-right font-bold'}>{fromChainName}</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function MigrateNotificationContent({ notification }: { notification: TNotification }): ReactElement {
  const chainName = NETWORK_BY_CHAIN_ID.get(notification.chainId)?.name || 'Unknown'

  const explorerBaseURI = useMemo(() => {
    const chain = NETWORK_BY_CHAIN_ID.get(notification.chainId)
    return chain?.blockExplorers?.default?.url || 'https://etherscan.io'
  }, [notification.chainId])

  return (
    <div className={'flex gap-4'}>
      <div className={'flex flex-col items-center gap-3'}>
        <TokenLogo
          src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${notification.chainId}/${notification.fromAddress ? notification.fromAddress.toLowerCase() : '0x0'}/logo-32.png`}
          altSrc={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${notification.chainId}/${notification.fromAddress ? notification.fromAddress.toLowerCase() : '0x0'}/logo-32.png`}
          tokenSymbol={notification.fromTokenName}
          chainId={notification.chainId}
          width={32}
          height={32}
          className="rounded-full"
          loading="eager"
        />

        {notification.toAddress && <IconArrow className={'size-4 rotate-135'} />}

        {notification.toAddress && (
          <TokenLogo
            src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${notification.chainId}/${notification.toAddress.toLowerCase()}/logo-32.png`}
            altSrc={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${notification.chainId}/${notification.toAddress.toLowerCase()}/logo-32.png`}
            tokenSymbol={notification.toTokenName}
            chainId={notification.chainId}
            width={32}
            height={32}
            className="rounded-full"
            loading="eager"
          />
        )}
      </div>
      <div className={'flex-1'}>
        <div className={'grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-text-primary'}>
          <p>{'Address:'}</p>
          <p className={'text-right font-bold'}>
            <Link
              href={`${explorerBaseURI}/address/${notification.address}`}
              target={'_blank'}
              rel={'noopener noreferrer'}
              aria-label={`View address ${notification.address} on explorer`}
              className={'text-text-primary hover:text-text-secondary'}
            >
              <button className={'text-xs font-medium underline'}>{truncateHex(notification.address, 5)}</button>
            </Link>
          </p>
          <p>{'Redeemed:'}</p>
          <p className={'text-right font-bold'}>
            <Link
              href={`${explorerBaseURI}/address/${notification.fromAddress || '0x0'}`}
              target={'_blank'}
              rel={'noopener noreferrer'}
              aria-label={`View vault ${notification.fromTokenName || 'Unknown'} on explorer`}
              className={'text-text-primary hover:text-text-secondary'}
            >
              <button className={'text-xs font-medium underline'}>
                {notification.amount} {notification.fromTokenName || 'Unknown'}
              </button>
            </Link>
          </p>
          {notification.toAddress && (
            <>
              <p>{'Receive:'}</p>
              <p className={'text-right font-bold'}>
                <Link
                  href={`${explorerBaseURI}/address/${notification.toAddress}`}
                  target={'_blank'}
                  rel={'noopener noreferrer'}
                  aria-label={`View vault ${notification.toTokenName || 'New Vault'} on explorer`}
                  className={'text-text-primary hover:text-text-secondary'}
                >
                  <button className={'text-xs font-medium underline'}>
                    {notification.toAmount
                      ? `${notification.toAmount} ${notification.toTokenName || ''}`
                      : notification.toTokenName || 'New Vault'}
                  </button>
                </Link>
              </p>
            </>
          )}
          <p>{'Chain:'}</p>
          <p className={'text-right font-bold'}>{chainName}</p>
        </div>
      </div>
    </div>
  )
}

function NotificationContent({ notification }: { notification: TNotification }): ReactElement {
  if (['approve', 'claim', 'claim and exit'].includes(notification.type)) {
    return <ApproveNotificationContent notification={notification} />
  }

  if (['deposit', 'stake', 'zap', 'crosschain zap', 'deposit and stake'].includes(notification.type)) {
    return <DepositNotificationContent notification={notification} />
  }

  if (notification.type === 'migrate') {
    return <MigrateNotificationContent notification={notification} />
  }

  return <WithdrawNotificationContent notification={notification} />
}

export const Notification = memo(function Notification({
  notification,
  variant = 'v3'
}: {
  notification: TNotification
  variant: 'v2' | 'v3'
}): ReactElement {
  const { deleteByID } = useNotifications()
  const [isDeleting, setIsDeleting] = useState(false)

  /************************************************************************************************
   * Use the transaction status poller to automatically check and update pending transactions
   * every minute. This will update the notification status when transactions are completed.
   ************************************************************************************************/
  useTransactionStatusPoller(notification)

  const formattedDate = useMemo(() => {
    if (!notification.timeFinished || notification.status === 'pending') {
      return null
    }
    const date = new Date(notification.timeFinished * 1000)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    })
  }, [notification.timeFinished, notification.status])

  const explorerLink = useMemo(() => {
    if (!notification.txHash) {
      return null
    }

    const chain = SUPPORTED_NETWORKS.find((network) => network.id === notification.chainId)
    const explorerBaseURI = chain?.blockExplorers?.default?.url || 'https://etherscan.io'
    return `${explorerBaseURI}/tx/${notification.txHash}`
  }, [notification.chainId, notification.txHash])

  const notificationTitle = useMemo(() => {
    switch (notification.type) {
      case 'approve':
        return 'Approve'
      case 'deposit':
        return 'Deposit'
      case 'withdraw':
        return 'Withdraw'
      case 'zap':
        return 'Zap'
      case 'crosschain zap':
        return 'Cross-chain Zap'
      case 'withdraw zap':
        return 'Withdraw Zap'
      case 'crosschain withdraw zap':
        return 'Cross-chain Withdraw Zap'
      case 'deposit and stake':
        return 'Deposit & Stake'
      case 'stake':
        return 'Stake'
      case 'unstake':
        return 'Unstake'
      case 'unstake and withdraw':
        return 'Unstake & Withdraw'
      case 'claim':
        return 'Claim'
      case 'claim and exit':
        return 'Claim & Exit'
      case 'migrate':
        return 'Migrate'
      default:
        return 'Transaction'
    }
  }, [notification.type])

  const handleDelete = useCallback(async () => {
    if (!notification.id || isDeleting) {
      return
    }

    setIsDeleting(true)

    try {
      await deleteByID(notification.id!)
    } catch (error) {
      console.error('Failed to delete notification:', error)
      setIsDeleting(false)
    }
  }, [deleteByID, notification.id, isDeleting])

  return (
    <div
      className={cl(
        'border border-border p-4 h-fit relative mb-4 origin-top group',
        'bg-card rounded-xl border-border'
      )}
    >
      {variant === 'v3' && <div className={cl('absolute inset-0 rounded-xl')} />}

      {/* Close button */}
      <button
        onClick={handleDelete}
        disabled={isDeleting}
        className={cl(
          'absolute z-999999 flex items-center justify-center',
          'right-2 top-2 w-5 h-5 rounded-full hover:opacity-100 hover:bg-surface',
          'transition-all duration-200',
          'opacity-0 group-hover:opacity-100 group-hover:bg-surface/70 group-hover:border group-hover:border-neutral-0 hover:opacity-100!',
          isDeleting ? 'opacity-30!' : ''
        )}
        title={'Remove'}
      >
        <IconClose className={cl('w-3 h-3 text-text-primary')} />
      </button>

      <div className={'relative z-20'}>
        <div className={'mb-4 flex items-center justify-between'}>
          <p className={'font-medium text-text-primary'}>{notificationTitle}</p>
          <NotificationStatus status={notification.status} />
        </div>

        <NotificationContent notification={notification} />

        {notification.status === 'success' || notification.txHash ? (
          <div
            className={'mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-text-primary'}
          >
            <div className={'flex gap-4'}>
              <span className={'font-bold'}>{formattedDate}</span>
            </div>
            {explorerLink ? (
              <Link
                href={explorerLink}
                target={'_blank'}
                rel={'noopener noreferrer'}
                aria-label={`View transaction ${notification.txHash} on explorer`}
                className={'text-text-primary hover:text-text-secondary'}
              >
                <button className={'text-xs font-medium underline'}>{'View tx'}</button>
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
})
