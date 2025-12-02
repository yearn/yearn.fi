import { FAQs, Footer, Hero, Integrations, Partners, Security, Vaults } from '@landing/components/sections'

import type { ReactElement } from 'react'

function Index(): ReactElement {
  return (
    <div className={'bg-[#00051f]'}>
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
