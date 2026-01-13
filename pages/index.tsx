import { FAQs, Footer, Hero, Integrations, Partners, Security, Vaults } from '@landing/components/sections'

import type { ReactElement } from 'react'

function Index(): ReactElement {
  return (
    <div
      data-theme={'midnight'}
      className={
        'dark -mt-[var(--header-height)] bg-gradient-to-b from-[#00051f] to-[#0a1243] pt-[var(--header-height)] text-white'
      }
    >
      <main className={'flex w-full flex-col items-center'}>
        <div className={'flex w-full flex-col items-center'}>
          <Hero />
          <Vaults />
          <Security />
          <Partners />
          <Integrations />
          <FAQs />
        </div>
      </main>
      <footer className={'flex w-full flex-col items-center'}>
        <Footer />
      </footer>
    </div>
  )
}

export default Index
