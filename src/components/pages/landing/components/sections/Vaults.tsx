import { SectionHeader } from '@shared/components/SectionHeader'
import { useYearn } from '@shared/contexts/useYearn'
import { formatPercent } from '@shared/utils/format'
import type { FC } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from '/src/components/Image'

type TRow = {
  icon: string
  text: string
  description?: string
  href: string
  address?: string
  bgClass?: string
}

type TVault = {
  background: string
  image: string
  size: number
  tagline: string
  title: string
  description: string
  cta?: { label: string; href: string }
}

const slides: TVault[] = [
  {
    background: '/landing/vault-background-x.png',
    image: '/landing/safe.png',
    size: 250,
    tagline: 'Growing every day',
    title: 'Compounding Vaults',
    description: 'Vaults utilize DeFi opportunities to give you the best risk-adjusted yields',
    cta: { label: 'View All', href: 'https://yearn.fi/v3' }
  },
  {
    background: '/landing/vault-background-y.png',
    image: '/landing/apps.png',
    size: 300,
    tagline: 'Growing every day',
    title: 'App Ecosystem',
    description: 'Apps built on Yearn vaults by contributors and the wider community'
  }
]

const vaultsRows = [
  {
    symbol: 'ETH',
    icon: '/landing/vaults/eth.png',
    href: '/vaults/1/0xAc37729B76db6438CE62042AE1270ee574CA7571',
    address: '0xAc37729B76db6438CE62042AE1270ee574CA7571'
  },
  {
    symbol: 'USDS',
    icon: '/landing/vaults/usds.png',
    href: '/vaults/1/0x182863131F9a4630fF9E27830d945B1413e347E8',
    address: '0x182863131F9a4630fF9E27830d945B1413e347E8'
  },
  {
    symbol: 'USDC',
    icon: '/landing/vaults/usdc.png',
    href: '/vaults/1/0xBe53A109B494E5c9f97b9Cd39Fe969BE68BF6204',
    address: '0xBe53A109B494E5c9f97b9Cd39Fe969BE68BF6204'
  },
  {
    symbol: 'crvUSD',
    icon: '/landing/vaults/crvusd.png',
    href: '/vaults/1/0xBF319dDC2Edc1Eb6FDf9910E39b37Be221C8805F',
    address: '0xBF319dDC2Edc1Eb6FDf9910E39b37Be221C8805F'
  }
]

const appRows: TRow[] = [
  {
    icon: '/landing/apps/ycrv.png',
    text: 'yCRV',
    description: 'Put your yCRV to work',
    href: 'https://ycrv.yearn.fi/'
  },
  {
    icon: '/landing/apps/factory.png',
    text: 'LP Token Vaults',
    description: 'Permissionless Curve Autocompounders',
    href: 'https://yearn.fi/vaults?type=lp'
  },
  {
    icon: '/landing/apps/powerglove.png',
    text: 'Analytics',
    description: 'Analytics for all Yearn Vaults',
    href: 'https://powerglove.yearn.fi'
  },
  {
    icon: '/landing/apps/veyfi.png',
    text: 'veYFI',
    description: 'Earn yield, boost gauges, and take part in governance',
    href: 'https://veyfi.yearn.fi/'
  }
]

export const Vaults: FC = () => {
  const { vaults, isLoadingVaultList } = useYearn()
  const [activeSlide, setActiveSlide] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [isHovering, setIsHovering] = useState(false)

  const rows: TRow[][] = useMemo(() => {
    return [
      vaultsRows.map((vault, index) => {
        const vaultData = vaults?.[vault.address]
        // no data? skip or default APR to 0
        if (!vaultData) {
          return {
            bgClass: index % 2 === 0 ? 'bg-black/50' : 'bg-black/30',
            icon: vault.icon,
            text: `Earn on ${vault.symbol}`,
            href: vault.href,
            address: vault.address
          }
        }
        // safely pull out APR parts
        const forward = vaultData.apr.forwardAPR?.netAPR ?? 0
        const extra = vaultData.apr.extra?.stakingRewardsAPR ?? 0
        const apr = extra > 0 ? forward + extra : forward

        return {
          bgClass: index % 2 === 0 ? 'bg-black/50' : 'bg-black/30',
          icon: vault.icon,
          text: apr > 0 ? `Earn up to ${formatPercent(apr * 100, 2, 2)} on ${vault.symbol}` : `Earn on ${vault.symbol}`,
          href: vault.href,
          address: vault.address
        }
      }),
      appRows.map((app, index) => {
        return {
          bgClass: index % 2 === 0 ? 'bg-black/50' : 'bg-black/30',
          icon: app.icon,
          text: app.text,
          description: app.description,
          href: app.href
        }
      })
    ]
  }, [vaults])

  const totalSlides = slides.length

  const nextSlide = useCallback(() => {
    if (!isAnimating) {
      setIsAnimating(true)
      setActiveSlide((prev) => (prev + 1) % totalSlides)
      setTimeout(() => setIsAnimating(false), 500)
    }
  }, [isAnimating, totalSlides])

  const goToSlide = useCallback(
    (index: number) => {
      if (!isAnimating && index !== activeSlide) {
        setIsAnimating(true)
        setActiveSlide(index)
        setTimeout(() => setIsAnimating(false), 500)
      }
    },
    [activeSlide, isAnimating]
  )

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isHovering) {
        nextSlide()
      }
    }, 15_000)

    return () => clearInterval(interval)
  }, [nextSlide, isHovering])

  return (
    <section className={'flex w-full justify-center border-t border-white/10 px-4 py-12 sm:py-16 md:px-8 lg:py-32'}>
      <div className={'w-full max-w-[1180px]'}>
        {/* Slides */}
        <div
          className={'relative mb-6 overflow-hidden sm:mb-8 md:mb-12'}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          <div
            className={'flex transition-transform duration-500 ease-in-out'}
            style={{ transform: `translateX(-${activeSlide * 100}%)` }}
          >
            {slides.map((slide) => (
              <div
                key={slide.title}
                className={
                  'flex w-full shrink-0 flex-col items-stretch justify-between gap-4 sm:gap-6 md:flex-row md:gap-8'
                }
              >
                {/* Mobile Image */}
                <div className={'relative flex h-[180px] w-full items-center justify-center sm:h-[220px] md:hidden'}>
                  <div
                    className={
                      'relative flex size-full items-center justify-center overflow-hidden rounded-[16px] border border-[#ffffff]/10 sm:rounded-[20px]'
                    }
                    style={{
                      backgroundImage: `url(${slide.background})`,
                      backgroundRepeat: 'no-repeat',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    }}
                  >
                    <Image
                      className={'z-10 block'}
                      src={slide.image}
                      width={Math.round(slide.size * 0.6)}
                      height={Math.round(slide.size * 0.6)}
                      alt={'vault image'}
                    />
                  </div>
                </div>

                {/* Desktop Image */}
                <div className={'md:min-h-auto relative hidden min-h-[300px] w-full md:flex md:w-2/5'}>
                  <div
                    className={
                      'relative flex size-full items-center justify-center overflow-hidden rounded-[24px] border border-[#ffffff]/10'
                    }
                    style={{
                      backgroundImage: `url(${slide.background})`,
                      backgroundRepeat: 'no-repeat',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    }}
                  >
                    <Image
                      className={'z-10 block transition-opacity group-hover:opacity-0 md:opacity-100'}
                      src={slide.image}
                      width={slide.size}
                      height={slide.size}
                      alt={'vault image'}
                    />
                  </div>
                </div>

                <div className={'relative flex size-full flex-col justify-between gap-3 sm:gap-4 md:w-3/5 md:gap-4'}>
                  <div className={'relative px-1 py-2 sm:p-4 md:p-0'}>
                    <SectionHeader
                      tagline={slide.tagline}
                      title={slide.title}
                      description={slide.description}
                      cta={slide.cta}
                    />
                  </div>
                  <div
                    className={
                      'flex w-full flex-col gap-2 overflow-hidden rounded-[16px] bg-white/5 p-2 sm:rounded-[20px] md:rounded-[24px] md:p-[8px]'
                    }
                  >
                    {rows[activeSlide].map((row) => {
                      const isVaultLoading = row?.address && isLoadingVaultList
                      return (
                        <a
                          key={row.href}
                          href={row.href}
                          className={`${row.bgClass} flex min-h-[48px] cursor-pointer items-center justify-between rounded-[12px] p-3 transition-opacity duration-200 hover:opacity-50 sm:min-h-[52px] md:rounded-[16px] md:p-[8px]`}
                        >
                          <div className={'flex items-center'}>
                            <div className={'mr-3 rounded-2xl p-1'}>
                              <div
                                className={
                                  'flex size-6 items-center justify-center rounded-2xl bg-gray-900 sm:size-7 md:size-6'
                                }
                              >
                                <Image src={row.icon} alt={row.text} width={24} height={24} />
                              </div>
                            </div>
                            <div className={'flex flex-col gap-1 md:flex-row md:gap-2'}>
                              {isVaultLoading ? (
                                <div className={'flex items-center space-x-2'}>
                                  <div className={'h-6 w-48 animate-pulse rounded-sm bg-gray-600'} />
                                </div>
                              ) : (
                                <span className={'text-sm font-medium sm:text-base'}>{row.text}</span>
                              )}
                              {row.description && (
                                <span className={'hidden font-light text-gray-400 md:block md:text-base'}>
                                  {row.description}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className={'rounded-2xl bg-transparent p-2'}>
                            <svg
                              xmlns={'http://www.w3.org/2000/svg'}
                              className={'size-5'}
                              fill={'none'}
                              viewBox={'0 0 24 24'}
                              stroke={'currentColor'}
                            >
                              <path
                                strokeLinecap={'round'}
                                strokeLinejoin={'round'}
                                strokeWidth={2}
                                d={'M14 5l7 7m0 0l-7 7m7-7H3'}
                              />
                            </svg>
                          </div>
                        </a>
                      )
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pagination */}
        <div className={'flex w-full justify-center'}>
          <div className={'flex items-center space-x-2 sm:space-x-3'}>
            {Array.from({ length: totalSlides }).map((_, index) => (
              <button
                // biome-ignore lint/suspicious/noArrayIndexKey: Array.from
                key={index}
                onClick={() => goToSlide(index)}
                className={`flex size-8 items-center justify-center rounded-full transition-all duration-300 sm:size-6`}
                aria-label={`Go to slide ${index + 1}`}
              >
                <span
                  className={`size-2.5 rounded-full transition-all duration-300 sm:size-2 ${
                    index === activeSlide ? 'scale-125 bg-white' : 'bg-gray-600'
                  }`}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
