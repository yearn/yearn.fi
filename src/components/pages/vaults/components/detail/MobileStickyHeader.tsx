import { useVaultApyData } from '@pages/vaults/hooks/useVaultApyData'
import {
  getVaultAPR,
  getVaultChainID,
  getVaultToken,
  getVaultTVL,
  type TKongVaultInput
} from '@pages/vaults/domain/kongVaultSelectors'
import { ImageWithFallback } from '@shared/components/ImageWithFallback'
import { cl, formatApyDisplay, formatTvlDisplay } from '@shared/utils'
import { getVaultName } from '@shared/utils/helpers'
import type { ReactElement } from 'react'
import { useEffect, useState } from 'react'

interface MobileStickyHeaderProps {
  currentVault: TKongVaultInput
}

export function MobileStickyHeader({ currentVault }: MobileStickyHeaderProps): ReactElement {
  const [isSticky, setIsSticky] = useState(false)
  const apyData = useVaultApyData(currentVault)
  const apr = getVaultAPR(currentVault)
  const chainID = getVaultChainID(currentVault)
  const token = getVaultToken(currentVault)
  const tvl = getVaultTVL(currentVault)

  const forwardAPY =
    apyData.mode === 'katana' && apyData.katanaEstApr !== undefined ? apyData.katanaEstApr : apr.forwardAPR.netAPR

  const historicalAPY = apr.netAPR

  useEffect(() => {
    const handleScroll = (): void => {
      const scrollThreshold = 120
      setIsSticky(window.scrollY > scrollThreshold)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return (): void => window.removeEventListener('scroll', handleScroll)
  }, [])

  const tokenLogoSrc = `${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${chainID}/${token.address.toLowerCase()}/logo-128.png`

  return (
    <div
      className={cl(
        'md:hidden sticky z-40 transition-all duration-200',
        isSticky
          ? 'top-[var(--header-height)] bg-app/95 backdrop-blur-sm border-b border-border -mx-4 px-4 py-2'
          : 'top-[var(--header-height)] py-0 opacity-0 pointer-events-none h-0 overflow-hidden'
      )}
    >
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center size-8 rounded-full bg-surface/70 shrink-0">
          <ImageWithFallback src={tokenLogoSrc} alt={token.symbol || ''} width={32} height={32} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-text-primary truncate leading-tight">{getVaultName(currentVault)}</p>
        </div>
        <div className="flex items-center gap-3 text-xs shrink-0">
          <div className="text-right">
            <p className="text-text-secondary text-[10px] leading-tight">EST. APY</p>
            <p className="font-semibold text-text-primary leading-tight">{formatApyDisplay(forwardAPY)}</p>
          </div>
          <div className="text-right">
            <p className="text-text-secondary text-[10px] leading-tight">30D APY</p>
            <p className="font-semibold text-text-primary leading-tight">{formatApyDisplay(historicalAPY)}</p>
          </div>
          <div className="text-right">
            <p className="text-text-secondary text-[10px] leading-tight">TVL</p>
            <p className="font-semibold text-text-primary leading-tight">{formatTvlDisplay(tvl.tvl)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
