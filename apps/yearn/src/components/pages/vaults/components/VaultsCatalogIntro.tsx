import { buildVaultDirectoryEntries, buildVaultDirectoryJsonLd } from '@pages/vaults/utils/vaultsDirectory'
import type { TVaultsInitialPayload } from '@pages/vaults/utils/vaultsInitialPayload'
import { Breadcrumbs } from '@shared/components/Breadcrumbs'
import { JsonLd } from '@shared/components/JsonLd'
import Link from 'next/link'
import type { ReactElement } from 'react'

type TVaultsCatalogIntroProps = {
  initialVaults?: TVaultsInitialPayload
}

export function VaultsCatalogIntro({ initialVaults }: TVaultsCatalogIntroProps): ReactElement {
  const directoryEntries = buildVaultDirectoryEntries(initialVaults)

  return (
    <section aria-labelledby={'vaults-heading'} className={'w-full bg-app'}>
      {directoryEntries.length > 0 ? <JsonLd schema={buildVaultDirectoryJsonLd(directoryEntries)} /> : null}
      <div className={'mx-auto w-full max-w-[1232px] px-4 pt-4 pb-3'}>
        <Breadcrumbs
          className={'mb-3 px-1'}
          items={[
            { label: 'Home', href: '/' },
            { label: 'Vaults', href: '/vaults', isCurrent: true }
          ]}
        />
        <div className={'flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between'}>
          <div className={'max-w-2xl'}>
            <h1 id={'vaults-heading'} className={'text-2xl font-black leading-tight text-text-primary md:text-3xl'}>
              {'Yearn Vaults'}
            </h1>
            <p className={'mt-1 text-sm leading-6 text-text-secondary md:text-base'}>
              {
                'Explore active Yearn vaults across supported networks, then filter by asset, network, strategy, or yield.'
              }
            </p>
          </div>
          <Link
            href={'/api/vaults/markdown'}
            type={'text/markdown'}
            rel={'alternate'}
            className={
              'w-fit shrink-0 text-sm font-medium text-text-secondary underline decoration-border underline-offset-4 transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
            }
          >
            {'Read the vault catalog'}
          </Link>
        </div>

        {directoryEntries.length > 0 ? (
          <nav aria-labelledby={'vault-directory-heading'} className={'pt-3'}>
            <div className={'flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1'}>
              <h2 id={'vault-directory-heading'} className={'text-sm font-semibold text-text-primary'}>
                {'Vault directory'}
              </h2>
              <p className={'text-xs text-text-secondary'}>{'A cross-network selection from the live catalog.'}</p>
            </div>
            <ul className={'mt-2 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-4'}>
              {directoryEntries.map((entry) => (
                <li key={entry.href}>
                  <Link
                    href={entry.href}
                    className={
                      'group flex min-w-0 items-baseline justify-between gap-3 border-b border-border/70 py-1.5 transition-colors hover:border-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
                    }
                  >
                    <span className={'min-w-0 truncate text-sm font-medium text-text-primary group-hover:text-primary'}>
                      {entry.name}
                    </span>
                    <span className={'shrink-0 text-xs text-text-secondary'}>
                      {`${entry.tokenSymbol || entry.symbol} · ${entry.chainName}`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </div>
    </section>
  )
}
