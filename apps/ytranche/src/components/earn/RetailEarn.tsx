'use client'

import { useEffect, useRef, useState } from 'react'
import { EarnBrand, EarnHeader } from '@/components/earn/EarnHeader'
import { ContractLink, DepositWidget, useThemePreference } from '@/components/ytranche/shared'
import { CONTRACTS } from '@/lib/ethereum'

const GOVERNANCE_URL = 'https://gov.yearn.fi/t/yip-91-ytranche/14659'
const AUDIT_URL = 'https://www.chainsecurity.com/security-audit/yearn-ytranche'

export function RetailEarn({ layout = 'split' }: { layout?: 'split' | 'centered' }) {
  const [theme, changeTheme] = useThemePreference()
  const widgetRef = useRef<HTMLElement>(null)
  const [showDepositShortcut, setShowDepositShortcut] = useState(false)
  const isCentered = layout === 'centered'

  // Scroll and media-query listeners synchronize the shortcut with the browser viewport.
  useEffect(() => {
    const mobileQuery = window.matchMedia('(max-width: 900px)')
    const animationFrame = { current: 0 }

    const updateVisibility = () => {
      window.cancelAnimationFrame(animationFrame.current)
      animationFrame.current = window.requestAnimationFrame(() => {
        const widgetBounds = widgetRef.current?.getBoundingClientRect()
        const headerBottom = document.getElementById('head')?.getBoundingClientRect().bottom ?? 0
        setShowDepositShortcut(
          (isCentered || mobileQuery.matches) && Boolean(widgetBounds && widgetBounds.bottom <= headerBottom)
        )
      })
    }

    updateVisibility()
    window.addEventListener('scroll', updateVisibility, { passive: true })
    window.addEventListener('resize', updateVisibility)
    mobileQuery.addEventListener('change', updateVisibility)

    return () => {
      window.cancelAnimationFrame(animationFrame.current)
      window.removeEventListener('scroll', updateVisibility)
      window.removeEventListener('resize', updateVisibility)
      mobileQuery.removeEventListener('change', updateVisibility)
    }
  }, [isCentered])

  const scrollToWidget = () => {
    widgetRef.current?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: isCentered ? 'start' : 'center'
    })
  }

  return (
    <div className={`earn-retail${isCentered ? ' earn-retail--centered' : ''}`}>
      <EarnHeader theme={theme} onThemeChange={changeTheme} />

      <main className="earn-retail__layout">
        <section className="earn-retail__hero" aria-labelledby="earn-retail-title">
          <h1 id="earn-retail-title">
            Earn <span>5% APY</span>
            <br />
            on USDC
          </h1>

          <div className="earn-retail__headline-support">
            <p>Withdraw whenever you want.</p>
            <p>
              Protected from drawdowns by Yearn's{' '}
              <a href={GOVERNANCE_URL} target="_blank" rel="noreferrer">
                yTranche
              </a>
              <sup></sup> system.
            </p>
            <p>
              <strong>$20M</strong> already earning.
            </p>
          </div>

          <a className="earn-scroll-cue" href="#how-it-works">
            <span>Scroll for more</span>
            <svg aria-hidden="true" viewBox="0 0 24 28">
              <path d="m5 6 7 7 7-7" />
              <path d="m5 14 7 7 7-7" />
            </svg>
          </a>
        </section>

        <aside ref={widgetRef} className="earn-retail__widget" aria-label="Earn with USDC">
          <DepositWidget />
        </aside>

        <section className="earn-retail__steps" id="how-it-works" aria-labelledby="earn-steps-title">
          <h2 id="earn-steps-title">It's easy.</h2>
          <ol>
            <li>
              <div>
                <h3>Deposit USDC</h3>
                <p>Or zap in with another stablecoin.</p>
              </div>
            </li>
            <li>
              <div>
                <h3>Yearn puts your funds to work</h3>
                <p>The Yearn V3 vault allocates funds across Ethereum and Layer 2 strategies.</p>
                <a
                  className="earn-step-link"
                  href={`https://yearn.fi/vaults/1/${CONTRACTS.vault}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View the underlying vault ↗
                </a>
              </div>
            </li>
            <li>
              <div>
                <h3>Withdraw anytime</h3>
                <p>No lockups or cooldowns. Withdraw anytime.</p>
              </div>
            </li>
          </ol>
        </section>

        <section className="earn-retail__mechanics" aria-labelledby="earn-mechanics-title">
          <h2 id="earn-mechanics-title">It's consistent.</h2>
          <p>
            Fixed is one of three positions in Yearn's{' '}
            <a href={GOVERNANCE_URL} target="_blank" rel="noreferrer">
              yTranche
            </a>{' '}
            system. <br />
            Yearn V3 vault earns yield through strategies on Ethereum and Layer 2 networks. yTranche directs that yield
            to Fixed first, up to its 5% target. Levered follows, then remaining yield goes to Equity.
          </p>
          <div className="earn-retail__flow">
            <span>Yearn V3 vault yield</span>
            <i aria-hidden="true">→</i>
            <strong>Funds the 5% Fixed target</strong>
            <i aria-hidden="true">→</i>
            <span className="earn-retail__flow-destinations">
              <a href={`https://yearn.fi/vaults/1/${CONTRACTS.levered}`} target="_blank" rel="noreferrer">
                Levered ↗
              </a>
              <a href={`https://yearn.fi/vaults/1/${CONTRACTS.equity}`} target="_blank" rel="noreferrer">
                Equity ↗
              </a>
            </span>
          </div>
          <small>5% APY is a target rate. Yearn governance may change it with at least seven days’ prior notice.</small>
        </section>

        <section className="earn-retail__trust" id="safety" aria-labelledby="earn-trust-title">
          <h2 id="earn-trust-title">It's secure.</h2>
          <div className="earn-retail__trust-grid">
            <article>
              <span>01</span>
              <h3>First in the waterfall</h3>
              <p>Fixed receives available vault yield before the other positions, up to target.</p>
            </article>
            <article>
              <span>02</span>
              <h3>Supporting capital</h3>
              <p>Levered and Equity capital sit beneath Fixed in the onchain structure.</p>
            </article>
            <article>
              <span>03</span>
              <h3>Independently reviewed</h3>
              <p>ChainSecurity reviewed the yTranche core contracts and published its scope.</p>
            </article>
          </div>
          <div className="earn-retail__trust-links">
            <a href={AUDIT_URL} target="_blank" rel="noreferrer">
              Read the assessment ↗
            </a>
          </div>
        </section>
      </main>

      {showDepositShortcut ? (
        <button
          className={`earn-mobile-deposit${isCentered ? ' earn-centered-deposit' : ''}`}
          type="button"
          onClick={scrollToWidget}
        >
          Deposit USDC
          <span aria-hidden="true">↑</span>
        </button>
      ) : null}

      <footer className="earn-footer">
        <EarnBrand inverse={theme === 'dark'} />
        <nav aria-label="Retail product sources">
          <a href={GOVERNANCE_URL} target="_blank" rel="noreferrer">
            YIP-91 ↗
          </a>
          <ContractLink address={CONTRACTS.fixed}>Contract</ContractLink>
          <a href={AUDIT_URL} target="_blank" rel="noreferrer">
            Audit ↗
          </a>
        </nav>
        <p>
          Yearn has a mandate to maintain vault liquidity, but unforeseen market conditions may lead to temporary
          periods of illiquidity. Withdrawals are subject to available vault liquidity and protocol controls.
        </p>
        <p>
          Onchain products involve risk. Review the product, its contracts, and available liquidity before depositing.
        </p>
      </footer>
    </div>
  )
}
