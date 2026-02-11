import { Breadcrumbs } from '@shared/components/Breadcrumbs'
import { getAllPartnerConfigs } from '@shared/partners/registry'
import type { ReactElement } from 'react'
import Link from '/src/components/Link'

type TPartnersTile = {
  title: string
  subtitle: string
  href: string
  backgroundImage?: string
}

const PARTNER_SUBHEADINGS: Record<string, string> = {
  katana: 'Enter the Dojo, deposit on Katana for yields with KAT incentives',
  pooltogether: 'Feeling lucky Anon? Win mega yield payouts with prize Vaults.',
  curve: "If it's on Curve, you'll get the best max boosted yields with Yearn.",
  aerodrome: 'Liftoff for great yields, with Aerodrome on Yearn.',
  morpho: 'Time to feel the 🦋 effect!',
  velodrome: 'Wear the yield yellow jersey with Velodrome.'
}

function buildPartnerTiles(): TPartnersTile[] {
  const partnerTiles = getAllPartnerConfigs().map((partner) => ({
    title: `Yearn X ${partner.displayName}`,
    subtitle: PARTNER_SUBHEADINGS[partner.slug] ?? partner.manifest.description,
    href: `/${partner.slug}`,
    backgroundImage: `/partner-${partner.slug}.png`
  }))

  return [
    {
      title: 'All Yearn Vaults',
      subtitle: 'Browse the full Yearn vault catalog across all chains.',
      href: '/vaults'
    },
    ...partnerTiles,
    {
      title: 'Partner With Yearn',
      subtitle: 'Looking to collaborate with Yearn? Reach out to explore partnership opportunities.',
      href: 'https://partners.yearn.fi'
    }
  ]
}

export default function PartnersPage(): ReactElement {
  const tiles = buildPartnerTiles()

  return (
    <div className={'min-h-[calc(100vh-var(--header-height))] w-full bg-app'}>
      <div className={'mx-auto w-full max-w-[1232px] px-4'}>
        <div className={'sticky top-[var(--header-height)] z-40 bg-app py-2'}>
          <Breadcrumbs
            className={'mb-0'}
            items={[
              { label: 'Home', href: '/' },
              { label: 'Partners', href: '/partners', isCurrent: true }
            ]}
          />
        </div>

        <div className={'mb-6'}>
          <h1 className={'text-3xl font-black text-text-primary'}>{'Yearn X Partners'}</h1>
          <p className={'mt-2 max-w-[760px] text-sm text-text-secondary'}>
            {'Explore dedicated partner experiences, browse all vaults, or reach out about partnering with Yearn.'}
          </p>
        </div>

        <div className={'grid gap-3 sm:grid-cols-2 lg:grid-cols-4'}>
          {tiles.map((tile) => (
            <Link key={tile.href} href={tile.href} className={'group block'}>
              <article
                className={
                  'relative h-[280px] overflow-hidden rounded-xl border border-white/15 bg-surface shadow-[0_0_0_1px_rgba(255,255,255,0.02)] transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:shadow-xl'
                }
                style={
                  tile.backgroundImage
                    ? {
                        backgroundImage: `url(${tile.backgroundImage})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat',
                        backgroundOrigin: 'padding-box',
                        backgroundClip: 'padding-box'
                      }
                    : {
                        backgroundColor: '#0D2A68',
                        backgroundOrigin: 'padding-box',
                        backgroundClip: 'padding-box'
                      }
                }
              >
                <div
                  className={
                    'pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-50'
                  }
                  style={{
                    backgroundImage:
                      'linear-gradient(180deg, rgba(3,11,26,0.86) 0%, rgba(3,11,26,0.72) 40%, rgba(3,11,26,0.64) 100%)',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: '100% 100%'
                  }}
                />
                <div className={'relative z-10 flex h-full flex-col p-5 text-white'}>
                  <div className={'h-[40%]'}>
                    <h2 className={'text-2xl font-black leading-tight'}>{tile.title}</h2>
                    <p className={'mt-2 text-sm leading-snug text-white/90'}>{tile.subtitle}</p>
                  </div>
                </div>
              </article>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
