<<<<<<<< HEAD:src/components/pages/landing/index.tsx
========
import { FAQs, Footer, Hero, Integrations, Partners, Security, Vaults } from '@pages/landing/components/sections'

>>>>>>>> 3f17c032 (feat: restructure):src/components/pages/index.tsx
import type { ReactElement } from 'react'
import { FAQs, Footer, Hero, Integrations, Partners, Security, Vaults } from './components/sections'

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
