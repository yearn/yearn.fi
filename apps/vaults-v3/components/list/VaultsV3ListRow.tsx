import { ImageWithFallback } from '@lib/components/ImageWithFallback'
import { RenderAmount } from '@lib/components/RenderAmount'
import { cl, isZero, toAddress, toNormalizedBN } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { VaultForwardAPY, VaultForwardAPYInlineDetails } from '@vaults-v3/components/table/VaultForwardAPY'
import { VaultHistoricalAPY } from '@vaults-v3/components/table/VaultHistoricalAPY'
import { RiskScoreInlineDetails, VaultRiskScoreTag } from '@vaults-v3/components/table/VaultRiskScoreTag'
import { VaultStakedAmount } from '@vaults-v3/components/table/VaultStakedAmount'
import { useAvailableToDeposit } from '@vaults-v3/utils/useAvailableToDeposit'
import type { ReactElement } from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { VaultChainTag } from '../VaultChainTag'

export function VaultsV3ListRow({
  currentVault,
  isHoldings = false
}: {
  currentVault: TYDaemonVault
  isHoldings?: boolean
}): ReactElement {
  const navigate = useNavigate()
  const availableToDeposit = useAvailableToDeposit(currentVault)
  const href = `/v3/${currentVault.chainID}/${toAddress(currentVault.address)}`
  const [isApyOpen, setIsApyOpen] = useState(false)
  const [isRiskOpen, setIsRiskOpen] = useState(false)

  const handleRowClick = (): void => {
    navigate(href)
  }

  const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      navigate(href)
    }
  }

  // Separate mobile and desktop layouts

  return (
    // biome-ignore lint/a11y/useSemanticElements: Using a div with link-like behavior for row navigation
    <div
      role={'link'}
      tabIndex={0}
      onClick={handleRowClick}
      onKeyDown={handleKeyDown}
      className={cl(
        'grid w-full grid-cols-1 md:grid-cols-12 rounded-3xl',
        'p-6 pt-2 md:pr-10',
        'cursor-pointer relative group'
      )}
    >
      <div
        className={cl(
          'absolute inset-0 rounded-3xl',
          'opacity-20 transition-opacity group-hover:opacity-100 pointer-events-none',
          'bg-[linear-gradient(80deg,#2C3DA6,#D21162)]'
        )}
      />

      <div className={cl('col-span-4 z-10', 'flex flex-row items-center justify-between')}>
        <div className={'flex flex-row gap-6 overflow-hidden pr-10'}>
          <div className={'mt-2.5 size-8 min-h-8 min-w-8 rounded-full md:flex'}>
            {/* TODO:add env for asset address */}
            <ImageWithFallback
              src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${currentVault.chainID}/${currentVault.token.address.toLowerCase()}/logo-32.png`}
              alt={''}
              width={32}
              height={32}
            />
          </div>
          <div className={'truncate'}>
            <strong
              title={currentVault.name}
              className={'block truncate font-black text-neutral-800 md:-mb-0.5 md:text-lg'}
            >
              {currentVault.name}
            </strong>
            <p className={'mb-0 block text-sm text-neutral-800/60 md:mb-2'}>{currentVault.token.name}</p>
            {/* Chain tag under name on mobile */}
            <div className={'flex flex-row items-center gap-2 pt-1 md:hidden'}>
              <VaultChainTag chainID={currentVault.chainID} />
            </div>
            <div className={'hidden flex-row items-center md:flex'}>
              <VaultChainTag chainID={currentVault.chainID} />
            </div>
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
            className={`yearn--table-data-section-item-value ${isZero(availableToDeposit) ? 'text-neutral-400' : 'text-neutral-900'}`}
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
      <div className={cl('col-span-8 z-10', 'grid grid-cols-2 gap-4 md:hidden', 'mt-4 md:mt-0')}>
        <div className={'yearn--table-data-section-item col-span-2'} datatype={'number'}>
          <div className={'w-full flex flex-col items-start'} onClick={(e): void => e.stopPropagation()}>
            <div className={'flex w-full flex-row items-center justify-between'}>
              <p className={'inline text-start text-xs text-neutral-800/60'}>{'Estimated APY'}</p>
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
          <p className={'inline text-start text-xs text-neutral-800/60'}>{'Historical APY'}</p>
          <VaultHistoricalAPY currentVault={currentVault} />
        </div>
        {isHoldings ? (
          <div className={'yearn--table-data-section-item col-span-2 flex-row items-center'} datatype={'number'}>
            <p className={'inline text-start text-xs text-neutral-800/60'}>{'Deposited'}</p>
            <VaultStakedAmount currentVault={currentVault} />
          </div>
        ) : null}
        <div className={'yearn--table-data-section-item col-span-2 flex-row items-center'} datatype={'number'}>
          <p className={'inline text-start text-xs text-neutral-800/60'}>{'TVL'}</p>
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
