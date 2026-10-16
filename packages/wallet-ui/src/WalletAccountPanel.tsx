'use client'

import type { ReactElement, ReactNode, SVGProps } from 'react'

type TWalletAccountPanelProps = {
  address?: string
  children: ReactNode
  copyStatus?: string
  displayName: string
  isDarkTheme: boolean
  isDisconnecting?: boolean
  onCopyAddress: () => void
  onDisconnect: () => void
  onSettingsClick: () => void
  portfolio: ReactNode
  settingsButtonId: string
  value: ReactNode
}

/** The account card and activity layout used by the Yearn production account menu. */
export function WalletAccountPanel({
  address,
  children,
  copyStatus,
  displayName,
  isDarkTheme,
  isDisconnecting,
  onCopyAddress,
  onDisconnect,
  onSettingsClick,
  portfolio,
  settingsButtonId,
  value
}: TWalletAccountPanelProps) {
  const iconButtonClass = [
    'flex size-7 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50',
    isDarkTheme
      ? 'text-text-secondary hover:bg-surface-tertiary hover:text-text-primary'
      : 'text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700'
  ].join(' ')

  return (
    <div className="flex flex-col">
      <div className={`rounded-2xl p-4 ${isDarkTheme ? 'bg-surface-secondary' : 'bg-neutral-100'}`}>
        <div className="mb-4 flex items-start justify-between">
          <div className="flex min-w-0 flex-col">
            <button
              type="button"
              aria-label="Copy wallet address"
              title={address}
              onClick={onCopyAddress}
              disabled={!address}
              className="group flex items-center gap-1.5 text-sm font-medium text-text-primary hover:text-primary transition-colors disabled:cursor-default disabled:hover:text-text-primary"
            >
              <span>{displayName}</span>
              {address && <IconCopy className="size-3.5 opacity-50 group-hover:opacity-100 transition-opacity" />}
            </button>
            {copyStatus && (
              <span role="status" className="text-xs text-text-secondary">
                {copyStatus}
              </span>
            )}
            {value}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              id={settingsButtonId}
              aria-label="Wallet settings"
              onClick={onSettingsClick}
              className={iconButtonClass}
            >
              <IconSettings className="size-4" />
            </button>
            <button
              type="button"
              onClick={onDisconnect}
              aria-label="Disconnect wallet"
              disabled={isDisconnecting}
              className={iconButtonClass}
            >
              <IconPower className="size-4" />
            </button>
          </div>
        </div>
        {portfolio}
      </div>
      <div className="mt-4">
        <h3 className="mb-3 text-sm font-semibold text-text-primary">Recent activity</h3>
        {children}
      </div>
    </div>
  )
}

function IconCopy(props: SVGProps<SVGSVGElement>): ReactElement {
  return (
    <svg {...props} viewBox={'0 0 24 24'} fill={'none'} xmlns={'http://www.w3.org/2000/svg'}>
      <path
        d={
          'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z'
        }
        fill={'currentcolor'}
      />
    </svg>
  )
}

function IconPower(props: SVGProps<SVGSVGElement>): ReactElement {
  return (
    <svg
      viewBox={'0 0 24 24'}
      fill={'none'}
      stroke={'currentColor'}
      strokeWidth={'2'}
      strokeLinecap={'round'}
      strokeLinejoin={'round'}
      {...props}
    >
      <path d={'M18.36 6.64a9 9 0 1 1-12.73 0'} />
      <line x1={'12'} y1={'2'} x2={'12'} y2={'12'} />
    </svg>
  )
}

function IconSettings(props: SVGProps<SVGSVGElement>): ReactElement {
  return (
    <svg width={24} height={24} fill={'none'} xmlns={'http://www.w3.org/2000/svg'} viewBox={'0 0 24 24'} {...props}>
      <path
        fillRule={'evenodd'}
        clipRule={'evenodd'}
        d={
          'M11.877 10a1.99 1.99 0 0 0-1.978 2c0 1.104.886 2 1.978 2a1.989 1.989 0 0 0 1.977-2c0-1.105-.885-2-1.977-2ZM7.92 12c0-2.21 1.772-4 3.955-4 2.185 0 3.956 1.79 3.956 4s-1.771 4-3.956 4c-2.183 0-3.955-1.79-3.955-4Z'
        }
        fill={'currentcolor'}
      />
      <path
        fillRule={'evenodd'}
        clipRule={'evenodd'}
        d={
          'M8.867 1.95A2.313 2.313 0 0 1 11.14 0h1.719c1.129 0 2.09.825 2.274 1.95l.288 1.75a8.85 8.85 0 0 1 1.965 1.15l1.64-.622a2.295 2.295 0 0 1 2.806 1.018l.86 1.509c.561.986.34 2.242-.532 2.967l-1.348 1.124c.094.76.094 1.547 0 2.308l1.348 1.124a2.353 2.353 0 0 1 .532 2.967l-.86 1.508v.001a2.294 2.294 0 0 1-2.805 1.018l-1.641-.622c-.6.463-1.259.851-1.965 1.15l-.288 1.75A2.313 2.313 0 0 1 12.86 24H11.14a2.313 2.313 0 0 1-2.273-1.95l-.288-1.75a8.847 8.847 0 0 1-1.965-1.15l-1.64.622a2.294 2.294 0 0 1-2.806-1.019l-.86-1.508a2.354 2.354 0 0 1 .53-2.967l1.35-1.124a9.315 9.315 0 0 1 0-2.308L1.839 9.722a2.354 2.354 0 0 1-.53-2.967l.859-1.508a2.293 2.293 0 0 1 2.805-1.02l1.641.623A8.844 8.844 0 0 1 8.579 3.7l.288-1.75Zm1.95.328-.38 2.316a.997.997 0 0 1-.657.783A6.876 6.876 0 0 0 7.452 6.74a.98.98 0 0 1-1 .185L4.28 6.101a.326.326 0 0 0-.399.144l-.86 1.508a.338.338 0 0 0 .076.425l2.243 1.87-.116.587a7.198 7.198 0 0 0 0 2.73c.072.361-.06.733-.34.968l-1.787 1.489a.338.338 0 0 0-.075.425l.86 1.508c.079.14.248.2.397.145l2.173-.825a.98.98 0 0 1 1 .185 6.876 6.876 0 0 0 2.328 1.363c.345.119.597.42.657.783l.38 2.316a.329.329 0 0 0 .323.278h1.719c.16 0 .297-.117.324-.278l.38-2.316a.997.997 0 0 1 .656-.782 6.902 6.902 0 0 0 2.33-1.365.98.98 0 0 1 .999-.184l2.173.825a.327.327 0 0 0 .398-.146l.86-1.507a.337.337 0 0 0-.076-.425l-1.786-1.49a1.006 1.006 0 0 1-.341-.965 7.278 7.278 0 0 0 0-2.734c-.071-.36.06-.732.34-.966l1.786-1.489a.338.338 0 0 0 .076-.425l-.858-1.507a.327.327 0 0 0-.4-.146l-2.172.825a.98.98 0 0 1-1-.184 6.885 6.885 0 0 0-2.328-1.364.997.997 0 0 1-.657-.783l-.38-2.316A.33.33 0 0 0 12.859 2H11.14a.329.329 0 0 0-.323.278Z'
        }
        fill={'currentcolor'}
      />
    </svg>
  )
}
