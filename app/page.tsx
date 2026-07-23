import { JsonLd } from '@shared/components/JsonLd'
import type { ReactElement } from 'react'
import PublicApp from '@/PublicApp'
import { getLifetimeEarningsHeadlineOrNull } from '@/server/earnings/headline'
import { landingMetadata, yearnOrganizationJsonLd } from './metadata'
import HomePageClient from './page-client'

export const metadata = landingMetadata
export const revalidate = 21600

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
      name: 'Are there developer docs?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Yearn has documentation for developers building on top of the protocol at https://docs.yearn.fi.'
      }
    },
    {
      '@type': 'Question',
      name: 'What are Yearn Lifetime Earnings?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Lifetime Earnings measures the cumulative gross profit and loss reported by Yearn vault strategies in USD. Learn how it is calculated at https://docs.yearn.fi/developers/data-services/yearn-data/metrics/lifetime-earnings.'
      }
    }
  ]
}

export default async function Page(): Promise<ReactElement> {
  const earningsHeadline = await getLifetimeEarningsHeadlineOrNull()

  return (
    <>
      <JsonLd schema={yearnOrganizationJsonLd} />
      <JsonLd schema={websiteJsonLd} />
      <JsonLd schema={faqJsonLd} />
      <PublicApp>
        <HomePageClient earningsHeadline={earningsHeadline} />
      </PublicApp>
    </>
  )
}
