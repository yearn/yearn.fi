import { JsonLd } from '@shared/components/JsonLd'
import { HydrationBoundary } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import PublicApp from '@/PublicApp'
import { getLandingPageDehydratedState } from '@/server/ssr/publicDataHydration'
import { landingMetadata } from './metadata'
import HomePageClient from './page-client'

export const metadata = landingMetadata
export const revalidate = 21600

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Yearn Finance',
  alternateName: 'Yearn',
  url: 'https://yearn.fi',
  logo: 'https://yearn.fi/favicons/android-icon-192x192.png',
  sameAs: ['https://github.com/yearn', 'https://x.com/yearnfi', 'https://docs.yearn.fi']
}

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Yearn Finance',
  url: 'https://yearn.fi',
  potentialAction: {
    '@type': 'SearchAction',
    target: 'https://yearn.fi/vaults?search={search_term_string}',
    'query-input': 'required name=search_term_string'
  }
}

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is a Yearn Vault?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: "Yearn Vaults are DeFi's yield-optimizing asset management platform. You deposit tokens, and strategies automatically maximize yields across protocols."
      }
    },
    {
      '@type': 'Question',
      name: 'What are the risks?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'As with any DeFi protocol, there are smart contract risks. Yearn reduces these risks through auditing and testing before deployment.'
      }
    },
    {
      '@type': 'Question',
      name: 'What is YFI?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: "YFI is Yearn's governance token. YFI holders can vote on proposals and shape the future of the protocol."
      }
    },
    {
      '@type': 'Question',
      name: 'Are there Developer Docs?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Yearn has documentation for developers building on top of the protocol at https://docs.yearn.fi.'
      }
    }
  ]
}

export default async function Page(): Promise<ReactElement> {
  const dehydratedState = await getLandingPageDehydratedState()

  return (
    <>
      <JsonLd schema={organizationJsonLd} />
      <JsonLd schema={websiteJsonLd} />
      <JsonLd schema={faqJsonLd} />
      <PublicApp>
        <HydrationBoundary state={dehydratedState}>
          <HomePageClient />
        </HydrationBoundary>
      </PublicApp>
    </>
  )
}
