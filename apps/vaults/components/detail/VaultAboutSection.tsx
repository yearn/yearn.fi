import { cl, formatAmount, formatPercent } from '@lib/utils'
import { parseMarkdown } from '@lib/utils/helpers'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import type { ReactElement } from 'react'

type TVaultFeesLineItem = {
  children: ReactElement
  label: string
  tooltip?: string
}

export function VaultFeesLineItem({ children, label, tooltip }: TVaultFeesLineItem): ReactElement {
  return (
    <div className={'flex flex-col space-y-0 md:space-y-0'}>
      <p className={'text-xxs text-text-secondary md:text-xs'}>{label}</p>
      <div
        className={cl(
          tooltip
            ? 'tooltip underline decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-opacity hover:decoration-neutral-600'
            : ''
        )}
      >
        {tooltip ? (
          <span suppressHydrationWarning className={'tooltipFees bottom-full'}>
            <div
              className={
                'w-96 rounded-xl border border-border bg-surface-secondary p-4 text-center text-xxs text-text-primary'
              }
            >
              {tooltip}
            </div>
          </span>
        ) : null}
        {children}
      </div>
    </div>
  )
}

export function VaultAboutSection({
  currentVault,
  className
}: {
  currentVault: TYDaemonVault
  className?: string
}): ReactElement {
  const { token, apr } = currentVault

  function getVaultDescription(): string | ReactElement {
    if (currentVault.description) {
      return parseMarkdown(currentVault.description.replaceAll('{{token}}', currentVault.token.symbol))
    }
    if (token.description) {
      return parseMarkdown(token.description.replaceAll('{{token}}', currentVault.token.symbol))
    }
    return (
      <>
        Sorry, we don't have a description for this vault right now. To learn more about how Yearn Vaults work, check
        out our{' '}
        <a
          href="https://docs.yearn.fi"
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-primary underline"
        >
          docs
        </a>
        , or if you want to learn more about this vault, head to our{' '}
        <a
          href="https://discord.gg/yearn"
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-primary underline"
        >
          discord
        </a>{' '}
        or{' '}
        <a
          href="https://t.me/yearnfinance"
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-primary underline"
        >
          telegram
        </a>{' '}
        and ask.
      </>
    )
  }

  return (
    <div className={cl('space-y-4 p-8 pt-0', className)}>
      <div className={'w-full'}>
        <div className={'mt-2 text-text-primary/50'}>
          {typeof getVaultDescription() === 'string' ? (
            <p
              // biome-ignore lint/security/noDangerouslySetInnerHtml: Controlled description content
              dangerouslySetInnerHTML={{
                __html: getVaultDescription() as string
              }}
            />
          ) : (
            <p>{getVaultDescription()}</p>
          )}
        </div>
      </div>

      <div className={'w-full'}>
        <b className={'text-text-primary'}>{'Fees'}</b>
        <div className={'mt-2 grid grid-cols-4 gap-8'}>
          <VaultFeesLineItem label={'Management'}>
            <p className={'font-number text-xl text-text-primary'}>
              {formatPercent((apr.fees.management || 0) * 100, 0)}
            </p>
          </VaultFeesLineItem>
          <VaultFeesLineItem label={'Performance'}>
            <p className={'font-number text-xl text-text-primary'}>
              {formatPercent((apr.fees.performance || 0) * 100, 0)}
            </p>
          </VaultFeesLineItem>
          {(currentVault.apr.forwardAPR.composite?.keepVELO || 0) > 0 ? (
            <VaultFeesLineItem
              label={'keepVELO'}
              tooltip={`Percentage of VELO locked in each harvest. This is used to boost ${currentVault.category} vault pools, and is offset via yvOP staking rewards.`}
            >
              <b className={'font-number text-xl text-text-secondary'}>
                {`${formatAmount((currentVault.apr.forwardAPR.composite?.keepVELO || 0) * 100, 0, 2)} %`}
              </b>
            </VaultFeesLineItem>
          ) : null}
        </div>
      </div>
    </div>
  )
}
