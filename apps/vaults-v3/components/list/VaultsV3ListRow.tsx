import { ImageWithFallback } from '@lib/components/ImageWithFallback'
import { RenderAmount } from '@lib/components/RenderAmount'
import { cl, isZero, toAddress, toNormalizedBN } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { getNetwork } from '@lib/utils/wagmi'
import { VaultForwardAPY, VaultForwardAPYInlineDetails } from '@vaults-v3/components/table/VaultForwardAPY'
import { VaultHistoricalAPY } from '@vaults-v3/components/table/VaultHistoricalAPY'
import { RiskScoreInlineDetails, VaultRiskScoreTag } from '@vaults-v3/components/table/VaultRiskScoreTag'
import { VaultStakedAmount } from '@vaults-v3/components/table/VaultStakedAmount'
import { useAvailableToDeposit } from '@vaults-v3/utils/useAvailableToDeposit'
import type { ReactElement } from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router'

type TVaultRowFlags = {
  hasHoldings?: boolean
  isMigratable?: boolean
  isRetired?: boolean
}

export function VaultsV3ListRow({
  currentVault,
  flags
}: {
  currentVault: TYDaemonVault
  flags?: TVaultRowFlags
}): ReactElement {
  const navigate = useNavigate()
  const availableToDeposit = useAvailableToDeposit(currentVault)
  const href = `/v3/${currentVault.chainID}/${toAddress(currentVault.address)}`
  const [isApyOpen, setIsApyOpen] = useState(false)
  const [isRiskOpen, setIsRiskOpen] = useState(false)

  // const badgeDefinitions = useMemo(() => {
  //   if (!flags) {
  //     return [] as { label: string; className: string }[]
  //   }

  //   const definitions: { label: string; className: string }[] = []

  //   if (flags.hasHoldings) {
  //     definitions.push({
  //       label: 'Holding',
  //       className: 'border-blue-200 bg-blue-100 text-blue-800'
  //     })
  //   }
  //   if (flags.isMigratable) {
  //     definitions.push({
  //       label: 'Migratable',
  //       className: 'border-amber-200 bg-amber-100 text-amber-800'
  //     })
  //   }
  //   if (flags.isRetired) {
  //     definitions.push({
  //       label: 'Retired',
  //       className: 'border-rose-200 bg-rose-100 text-rose-800'
  //     })
  //   }

  //   return definitions
  // }, [flags])

  const handleRowClick = (): void => {
    navigate(href)
  }

  const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      navigate(href)
    }
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: Using a div with link-like behavior for row navigation
    <div
      role={'link'}
      tabIndex={0}
      onClick={handleRowClick}
      onKeyDown={handleKeyDown}
      className={cl(
        'grid w-full grid-cols-1 md:grid-cols-12 bg-neutral-100',
        'p-6 pt-2 pb-4 md:pr-10',
        'cursor-pointer relative group'
      )}
    >
      <div
        className={cl(
          'absolute inset-0',
          'opacity-0 transition-opacity duration-300 group-hover:opacity-20 group-focus-visible:opacity-20 pointer-events-none',
          'bg-[linear-gradient(80deg,#2C3DA6,#D21162)]'
        )}
      />

      {/* TODO:on hover add list head categories */}
      <div className={cl('col-span-4 z-10', 'flex flex-row items-center justify-between sm:pt-0')}>
        <div
          className={'flex flex-row-reverse sm:flex-row w-full justify-between sm:justify-normal gap-4 overflow-hidden'}
        >
          <div className={'flex items-center justify-center self-center size-8 min-h-8 min-w-8 rounded-full'}>
            <ImageWithFallback
              src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${
                currentVault.chainID
              }/${currentVault.token.address.toLowerCase()}/logo-128.png`}
              alt={currentVault.token.symbol || ''}
              width={32}
              height={32}
            />
          </div>
          <div className={'truncate'}>
            <strong
              title={currentVault.name}
              className={'block truncate font-black text-neutral-800 md:-mb-0.5 text-lg'}
            >
              {currentVault.name}
            </strong>
            <div className={'flex flex-row items-center gap-1 text-sm text-neutral-800/60'}>
              <ImageWithFallback
                src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/chains/${currentVault.chainID}/logo-32.png`}
                alt={`Chain ${currentVault.chainID}`}
                width={14}
                height={14}
              />
              <p>{getNetwork(currentVault.chainID).name}</p>
              <p>{` - ${currentVault.category} - ${currentVault.kind}`}</p>
            </div>
            {/* <p className={'mt-0.5 text-xs text-neutral-500'}>
              {'Featuring score: '}
              <span className={'font-semibold text-neutral-800'}>
                {formatAmount(currentVault.featuringScore || 0, 2, 2)}
              </span>
            </p> */}
            {/* <p
              className={'mb-0 block text-sm text-neutral-800/60 md:mb-2'}
            >{`${currentVault.kind} - ${currentVault.category}`}</p> */}
          </div>
        </div>
      </div>

      {/* Desktop metrics grid */}
      <div className={cl('col-span-8 z-10', 'hidden md:grid md:grid-cols-12 gap-4', 'mt-4 md:mt-0')}>
        <div className={'yearn--table-data-section-item col-span-2 flex-row md:flex-col'} datatype={'number'}>
          <p className={'inline text-start text-xs text-neutral-800/60 md:hidden'}>{'Estimated APY'}</p>
          <VaultForwardAPY currentVault={currentVault} />
        </div>
        <div className={'yearn--table-data-section-item col-span-2 flex-row md:flex-col'} datatype={'number'}>
          <p className={'inline text-start text-xs text-neutral-800/60 md:hidden'}>{'Historical APY'}</p>
          <VaultHistoricalAPY currentVault={currentVault} />
        </div>
        <div className={'col-span-2'}>
          <VaultRiskScoreTag riskLevel={currentVault.info.riskLevel} />
        </div>
        <div className={'yearn--table-data-section-item col-span-2 flex-row md:flex-col'} datatype={'number'}>
          <p className={'inline text-start text-xs text-neutral-800/60 md:hidden'}>{'Available'}</p>
          <p
            className={`yearn--table-data-section-item-value ${
              isZero(availableToDeposit) ? 'text-neutral-400' : 'text-neutral-900'
            }`}
          >
            <RenderAmount
              value={Number(toNormalizedBN(availableToDeposit, currentVault.token.decimals).normalized)}
              symbol={currentVault.token.symbol}
              decimals={currentVault.token.decimals}
              shouldFormatDust
              options={{
                shouldDisplaySymbol: false,
                maximumFractionDigits:
                  Number(toNormalizedBN(availableToDeposit, currentVault.token.decimals).normalized) > 1000 ? 2 : 4
              }}
            />
          </p>
        </div>
        <div className={'yearn--table-data-section-item col-span-2 flex-row md:flex-col'} datatype={'number'}>
          <p className={'inline text-start text-xs text-neutral-800/60 md:hidden'}>{'Deposited'}</p>
          <VaultStakedAmount currentVault={currentVault} />
        </div>
        {/* TVL */}
        <div className={'yearn--table-data-section-item col-span-2 flex-row md:flex-col'} datatype={'number'}>
          <p className={'inline text-start text-xs text-neutral-800/60 md:hidden'}>{'TVL'}</p>
          <div className={'flex flex-col pt-0 text-right'}>
            <p className={'yearn--table-data-section-item-value'}>
              <RenderAmount
                value={currentVault.tvl?.tvl}
                symbol={'USD'}
                decimals={0}
                options={{
                  shouldCompactValue: true,
                  maximumFractionDigits: 2,
                  minimumFractionDigits: 0
                }}
              />
            </p>
            <small className={'text-xs flex flex-row text-neutral-900/40'}>
              <RenderAmount
                value={Number(toNormalizedBN(currentVault.tvl.totalAssets, currentVault.token.decimals).normalized)}
                symbol={''}
                decimals={6}
                shouldFormatDust
                options={{
                  shouldCompactValue: true,
                  maximumFractionDigits: 2,
                  minimumFractionDigits: 2
                }}
              />
              <p className="pl-1">{currentVault.token.symbol}</p>
            </small>
          </div>
        </div>
      </div>

      {/* Mobile metrics grid; conditionally show Deposited if user has holdings */}
      <div
        className={cl(
          'col-span-8 z-10',
          'grid grid-cols-2 gap-4 md:hidden',
          'pt-2 mt-2 md:mt-0 md:pt-0 border-t border-neutral-800/20'
        )}
      >
        {flags?.hasHoldings ? (
          <div className={'yearn--table-data-section-item col-span-2 flex-row items-center'} datatype={'number'}>
            <p className={'inline text-start text-dm text-neutral-800'}>{'Your Deposit'}</p>
            <VaultStakedAmount currentVault={currentVault} />
          </div>
        ) : null}
        <div className={'yearn--table-data-section-item col-span-2'} datatype={'number'}>
          <div className={'w-full flex flex-col items-start'}>
            <div className={'flex w-full flex-row items-center justify-between'}>
              <p className={'inline text-start text-dm text-neutral-800'}>{'Estimated APY'}</p>
              <VaultForwardAPY currentVault={currentVault} onMobileToggle={(): void => setIsApyOpen((v) => !v)} />
            </div>
            {isApyOpen ? (
              <div className={'mt-2 w-full'}>
                <VaultForwardAPYInlineDetails currentVault={currentVault} />
              </div>
            ) : null}
          </div>
        </div>
        <div className={'yearn--table-data-section-item col-span-2 flex-row items-center'} datatype={'number'}>
          <p className={'inline text-start text-dm text-neutral-800'}>{'Historical APY'}</p>
          <VaultHistoricalAPY currentVault={currentVault} />
        </div>
        <div className={'yearn--table-data-section-item col-span-2 flex-row items-center'} datatype={'number'}>
          <p className={'inline text-start text-dm text-neutral-800'}>{'TVL'}</p>
          <div className={'flex flex-col pt-0 text-right'}>
            <p className={'yearn--table-data-section-item-value'}>
              <RenderAmount
                value={currentVault.tvl?.tvl}
                symbol={'USD'}
                decimals={0}
                options={{
                  shouldCompactValue: true,
                  maximumFractionDigits: 2,
                  minimumFractionDigits: 0
                }}
              />
            </p>
            <small className={'text-xs flex flex-row text-neutral-900/40'}>
              <RenderAmount
                value={Number(toNormalizedBN(currentVault.tvl.totalAssets, currentVault.token.decimals).normalized)}
                symbol={''}
                decimals={6}
                shouldFormatDust
                options={{
                  shouldCompactValue: true,
                  maximumFractionDigits: 2,
                  minimumFractionDigits: 2
                }}
              />
              <p className="pl-1">{currentVault.token.symbol}</p>
            </small>
          </div>
        </div>
        <div className={'yearn--table-data-section-item col-span-2'} datatype={'number'}>
          <div className={'w-full flex flex-col items-start'} onClick={(e): void => e.stopPropagation()}>
            <VaultRiskScoreTag
              riskLevel={currentVault.info.riskLevel}
              onMobileToggle={(): void => setIsRiskOpen((v) => !v)}
            />
            {isRiskOpen ? (
              <div className={'mt-2 w-full'}>
                <RiskScoreInlineDetails riskLevel={currentVault.info.riskLevel} />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
