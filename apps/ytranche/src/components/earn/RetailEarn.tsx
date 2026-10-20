'use client'

import { TypeMarkYearn } from '@yearn/site-header/icons/TypeMarkYearn'
import { useEffect, useRef, useState } from 'react'
import { EarnHeader } from '@/components/earn/EarnHeader'
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
            Earn{' '}
            <span>
              <span className="earn-numeric">5%</span> APY
            </span>
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
              <strong className="earn-numeric">$20M</strong> already earning.
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

        <div className="earn-retail__mechanics-stage">
          <section className="earn-retail__mechanics" aria-labelledby="earn-mechanics-title">
            <h2 id="earn-mechanics-title">It's consistent.</h2>
            <p>
              yTranche USD Fixed earns a consistent, targeted rate of return made possible by Yearn's{' '}
              <a href={GOVERNANCE_URL} target="_blank" rel="noreferrer">
                yTranche
              </a>{' '}
              system.
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
          </section>
        </div>

        <section className="earn-retail__trust" id="safety" aria-labelledby="earn-trust-title">
          <h2 id="earn-trust-title">It's resilient.</h2>
          <div className="earn-retail__trust-grid">
            <article>
              <h3>Dependable infrastructure</h3>
              <p>Built on battle-tested Yearn V3 Vaults.</p>
            </article>
            <article>
              <h3>Loss Remote</h3>
              <p>Protected from vault strategy drawdowns by other yTranche capital.</p>
            </article>
            <article>
              <h3>Independently Audited</h3>
              <p>
                <a href={AUDIT_URL} target="_blank" rel="noreferrer">
                  3rd party audits
                </a>{' '}
                done by top security firms.
              </p>
            </article>
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
        <div className="earn-footer__main">
          <div className="earn-footer__brand">
            <a href="https://yearn.fi" aria-label="Yearn home">
              <TypeMarkYearn width={110} height={30} color={theme === 'dark' ? '#FFFFFF' : '#0657F9'} />
            </a>
            <p>
              Onchain products involve risk. Review the product, its contracts, and available liquidity before
              depositing.
            </p>
          </div>
          <nav aria-label="Retail product sources">
            <a href={`https://yearn.fi/vaults/1/${CONTRACTS.fixed}`} target="_blank" rel="noreferrer">
              yTranche on yearn.fi ↗
            </a>
            <a href="https://docs.yearn.fi" target="_blank" rel="noreferrer">
              Yearn docs ↗
            </a>
            <ContractLink address={CONTRACTS.fixed}>Fixed contract</ContractLink>
            <a href={`https://yearn.fi/vaults/1/${CONTRACTS.vault}`} target="_blank" rel="noreferrer">
              Underlying vault ↗
            </a>
            <a href={GOVERNANCE_URL} target="_blank" rel="noreferrer">
              YIP-91 ↗
            </a>
            <a href={AUDIT_URL} target="_blank" rel="noreferrer">
              Audit ↗
            </a>
          </nav>
        </div>
        <p className="earn-footer__footnote">
          Yearn has a mandate to maintain vault liquidity, but unforeseen market conditions may lead to temporary
          periods of illiquidity. Withdrawals are subject to available vault liquidity and protocol controls.
        </p>
      </footer>
    </div>
  )
}
