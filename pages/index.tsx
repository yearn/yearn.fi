import { FAQs, Footer, Hero, Integrations, Partners, Security, Vaults } from '@landing/components/sections'

import type { ReactElement } from 'react'
import { useThemePreference } from '/src/hooks/useThemePreference'

function Index(): ReactElement {
  const theme = useThemePreference()
  const isDark = theme === 'soft-dark'

  return (
    // <div className={'bg-gradient-to-b from-[#00051f] to-[#0a1243] text-neutral-900'}>
    <div
      className={'text-neutral-900'}
      style={{
        background: isDark ? 'linear-gradient(to bottom, #00051f 0%, #041650 12%, #00051f 100%)' : 'var(--color-app)'
      }}
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
