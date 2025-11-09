import { SectionHeader } from '@lib/components/SectionHeader'
import type { FC, ReactNode } from 'react'
import { useState } from 'react'

type FAQItemProps = {
  title: string
  children: ReactNode
  isOpen: boolean
  onToggle: () => void
}

const FAQItem: FC<FAQItemProps> = ({ title, children, isOpen, onToggle }) => (
  <div className={'w-full overflow-hidden rounded-lg bg-neutral-200/80 transition-colors'}>
    <button
      onClick={onToggle}
      className={
        'flex w-full items-center justify-between px-6 py-5 text-left text-neutral-700 transition-colors hover:text-neutral-500'
      }
    >
      <span className={'text-xl font-medium'}>{title}</span>
      <span
        className={'text-2xl transition-transform'}
        style={{ transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)' }}
      >
        {'+'}
      </span>
    </button>
    {isOpen && (
      <div className={'px-6 py-4 text-base text-neutral-600'}>
        <div
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}
        >
          {children}
        </div>
      </div>
    )}
  </div>
)

const faqData = [
  {
    title: 'What is a Yearn Vault?',
    content: (
      <p>
        {
          "Yearn Vaults are DeFi's yield-optimizing asset management platform. You deposit tokens, and our strategies automatically maximize your yields across various protocols."
        }
      </p>
    )
  },
  {
    title: 'What are the risks?',
    content: (
      <p>
        {
          'As with any DeFi protocol, there are smart contract risks. Yearn goes to great lengths to minimize these risks through thorough auditing and testing of all code before deployment.'
        }
      </p>
    )
  },
  {
    title: 'What is YFI?',
    content: (
      <p>
        {
          "YFI is Yearn's governance token. YFI holders can vote on proposals and shape the future of the protocol. It was launched with a fair distribution with no founder, investor or VC allocation."
        }
      </p>
    )
  },
  {
    title: 'Are there Developer Docs?',
    content: (
      <p>
        {'Yes! Yearn has extensive documentation for developers looking to build on top of our protocol. Visit our '}{' '}
        <a href={'https://docs.yearn.fi'} className={'text-blue-400 underline'}>
          {'docs'}
        </a>{' '}
        {'to learn more.'}
      </p>
    )
  }
]

type FAQsProps = {
  sectionHeight?: number
}

export const FAQs: FC<FAQsProps> = ({ sectionHeight }) => {
  const [openFAQ, setOpenFAQ] = useState<number | null>(0)

  const toggleFAQ = (index: number): void => {
    setOpenFAQ(openFAQ === index ? null : index)
  }

  const sectionStyle = sectionHeight ? { minHeight: `${sectionHeight}px` } : undefined

  return (
    <section className={'flex w-full justify-center py-4'} style={sectionStyle}>
      <div className={'flex w-full max-w-[1180px] flex-col gap-8 px-4 lg:flex-row'}>
        <div className={'flex flex-col lg:w-1/3'}>
          <SectionHeader
            align={'left'}
            tagline={'Education'}
            title={'FAQs'}
            description={'Frequently asked questions about Yearn'}
          />
        </div>
        <div className={'flex flex-col space-y-2 lg:w-2/3'}>
          {faqData.map((faq, index) => (
            <FAQItem key={faq.title} title={faq.title} isOpen={openFAQ === index} onToggle={() => toggleFAQ(index)}>
              {faq.content}
            </FAQItem>
          ))}
        </div>
      </div>
    </section>
  )
}
