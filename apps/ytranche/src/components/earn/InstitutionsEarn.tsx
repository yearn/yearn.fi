'use client'

import Link from 'next/link'
import { EarnBrand, EarnHeader } from '@/components/earn/EarnHeader'
import {
  compactToken,
  formatBps,
  formatToken,
  GOVERNANCE_URL,
  GOVERNANCE_VOTE_URL,
  useYTrancheModel
} from '@/components/ytranche/model'
import { ProfitFlow } from '@/components/ytranche/ProfitFlow'
import { ContractLink, useThemePreference } from '@/components/ytranche/shared'
import { CONTRACTS } from '@/lib/ethereum'

const AUDIT_REPORT_URL = 'https://reports.chainsecurity.com/Yearn/ChainSecurity_Yearn_ytranche_Audit.pdf'
const SOURCE_URL = 'https://github.com/yearn/ytranche'

function percentage(bps: bigint | null): string {
  return bps === null ? '—' : `${formatBps(bps)}%`
}

export function InstitutionsEarn() {
  const model = useYTrancheModel()
  const [theme, changeTheme] = useThemePreference()
  const protocol = model.protocol
  const fixedAssets = protocol?.trancheAssets ?? 0n
  const leveredAssets = protocol?.leveredAssets ?? 0n
  const equityAssets = protocol?.equityAssets ?? 0n
  const supportingAssets = leveredAssets + equityAssets
  const totalAssets = fixedAssets + supportingAssets
  const supportingToFixedBps = protocol && fixedAssets > 0n ? (supportingAssets * 10_000n) / fixedAssets : null
  const fixedWidth = totalAssets > 0n ? Number((fixedAssets * 10_000n) / totalAssets) / 100 : 0
  const leveredWidth = totalAssets > 0n ? Number((leveredAssets * 10_000n) / totalAssets) / 100 : 0
  const equityWidth = totalAssets > 0n ? Math.max(0, 100 - fixedWidth - leveredWidth) : 0
  const targetRate = protocol ? `${formatBps(model.targetRateBps)}%` : '—'
  const claimCoverage = protocol?.coverageClaim === 0n ? 'No active claim' : percentage(model.coverageBps)

  return (
    <div className="earn-institutions">
      <EarnHeader model={model} theme={theme} onThemeChange={changeTheme} page="institutions" />

      <main className="institution-main">
        <section className="institution-hero" aria-labelledby="institution-title">
          <div>
            <h1 id="institution-title">See what supports the target.</h1>
            <p>
              Live tranche composition, claim coverage, capacity, mechanics, and source material for professional
              allocators.
            </p>
            <div className="institution-hero__actions">
              <Link className="institution-primary-link" href="/#earn">
                Open Earn <span aria-hidden="true">→</span>
              </Link>
              <a href={AUDIT_REPORT_URL} target="_blank" rel="noreferrer">
                Read the audit ↗
              </a>
            </div>
          </div>
          <div className="institution-rate">
            <span>Configured annual target</span>
            <strong>{targetRate}</strong>
            {protocol?.accrualPaused ? <small>Accrual currently paused</small> : null}
          </div>
        </section>

        <section className="institution-metrics" aria-label="Primary live metrics">
          <dl>
            <div>
              <dt>Fixed tranche assets</dt>
              <dd>{protocol ? compactToken(fixedAssets) : '—'} USDC</dd>
              <small>Live Fixed NAV</small>
            </div>
            <div>
              <dt>Supporting capital</dt>
              <dd>{protocol ? compactToken(supportingAssets) : '—'} USDC</dd>
              <small>Levered + Equity assets</small>
            </div>
            <div>
              <dt>Supporting capital / Fixed</dt>
              <dd>{percentage(supportingToFixedBps)}</dd>
              <small>(Levered + Equity) ÷ Fixed assets</small>
            </div>
            <div>
              <dt>{model.account ? 'Allocator deposit capacity' : 'Indicative deposit capacity'}</dt>
              <dd>{protocol ? compactToken(model.depositLimit) : '—'} USDC</dd>
              <small>{model.account ? 'For connected address' : 'Reference receiver; address-specific'}</small>
            </div>
          </dl>
        </section>

        <section className="institution-structure" aria-labelledby="institution-structure-title">
          <div className="institution-section-heading">
            <p className="earn-section-label">Capital structure</p>
            <h2 id="institution-structure-title">Three positions. One visible stack.</h2>
            <p>
              Fixed, Levered, and Equity balances are read from their deployed strategies on Ethereum. Supporting
              capital is not a guarantee and can change over time.
            </p>
          </div>

          <div className="institution-stack">
            <div className="institution-stack__summary">
              <span>Capital junior to Fixed</span>
              <strong>{percentage(model.juniorCushionBps)}</strong>
              <small>of the displayed tranche stack</small>
            </div>
            <div
              className={`institution-stack__bar${protocol ? '' : ' is-loading'}`}
              role="img"
              aria-label={
                protocol
                  ? `Fixed ${formatToken(fixedAssets, 2)} USDC, Levered ${formatToken(leveredAssets, 2)} USDC, Equity ${formatToken(equityAssets, 2)} USDC`
                  : 'Live capital composition is loading'
              }
            >
              <span className="is-fixed" style={{ width: `${fixedWidth}%` }} />
              <span className="is-levered" style={{ width: `${leveredWidth}%` }} />
              <span className="is-equity" style={{ width: `${equityWidth}%` }} />
            </div>
            <dl className="institution-stack__legend">
              <div>
                <dt>
                  <i className="is-fixed" /> Fixed · Senior
                </dt>
                <dd>{protocol ? formatToken(fixedAssets, 2) : '—'} USDC</dd>
              </div>
              <div>
                <dt>
                  <i className="is-levered" /> Levered · Mezzanine
                </dt>
                <dd>{protocol ? formatToken(leveredAssets, 2) : '—'} USDC</dd>
              </div>
              <div>
                <dt>
                  <i className="is-equity" /> Equity · Junior
                </dt>
                <dd>{protocol ? formatToken(equityAssets, 2) : '—'} USDC</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="institution-waterfall" aria-labelledby="institution-waterfall-title">
          <div className="institution-section-heading">
            <p className="earn-section-label">Yield waterfall</p>
            <h2 id="institution-waterfall-title">Priority creates the target profile.</h2>
            <p>
              The underlying vault earns variable yield. The controller distributes available profit through configured
              targets in priority order.
            </p>
          </div>

          <ProfitFlow targetRateBps={model.targetRateBps} />
        </section>

        <section className="institution-operations" aria-labelledby="institution-operations-title">
          <div className="institution-section-heading">
            <p className="earn-section-label">Live controls and operations</p>
            <h2 id="institution-operations-title">The details behind execution.</h2>
          </div>

          <dl className="institution-operations__table">
            <div>
              <dt>Target status</dt>
              <dd>{protocol ? (protocol.accrualPaused ? 'Paused' : 'Accruing') : '—'}</dd>
              <small>Controller configuration</small>
            </div>
            <div>
              <dt>Senior claim coverage</dt>
              <dd>{protocol ? claimCoverage : '—'}</dd>
              <small>
                {protocol?.coverageClaim
                  ? `${formatToken(protocol.coverageCovered, 2)} / ${formatToken(protocol.coverageClaim, 2)} USDC`
                  : 'No current claim to measure'}
              </small>
            </div>
            <div>
              <dt>Fixed share price</dt>
              <dd>{model.sharePrice !== null ? formatToken(model.sharePrice, 6) : '—'} USDC</dd>
              <small>Assets per yvUSD-A</small>
            </div>
            <div>
              <dt>Maturity schedule</dt>
              <dd>None</dd>
              <small>No term to select or roll</small>
            </div>
            <div>
              <dt>Tranche withdrawal cooldown</dt>
              <dd>None</dd>
              <small>Underlying liquidity and protocol controls still apply</small>
            </div>
            <div>
              <dt>Position token</dt>
              <dd>yvUSD-A</dd>
              <small>ERC-4626 strategy shares</small>
            </div>
          </dl>
        </section>

        <section className="institution-diligence" aria-labelledby="institution-diligence-title">
          <div className="institution-section-heading">
            <p className="earn-section-label">Security and diligence</p>
            <h2 id="institution-diligence-title">Review the evidence, not a badge.</h2>
            <p>
              ChainSecurity&apos;s July 2026 review of yTranche&apos;s core contracts reported no critical, high, or
              medium-severity findings. Review the full scope, exclusions, and accepted risks before allocating.
            </p>
          </div>

          <fieldset className="institution-audit-counts">
            <legend className="sr-only">ChainSecurity finding counts</legend>
            <div>
              <strong>0</strong>
              <span>Critical</span>
            </div>
            <div>
              <strong>0</strong>
              <span>High</span>
            </div>
            <div>
              <strong>0</strong>
              <span>Medium</span>
            </div>
            <div>
              <strong>5</strong>
              <span>Low</span>
            </div>
            <div>
              <strong>17</strong>
              <span>Informational</span>
            </div>
          </fieldset>

          <nav className="institution-source-links" aria-label="Institutional diligence sources">
            <a href={AUDIT_REPORT_URL} target="_blank" rel="noreferrer">
              Full audit report ↗
            </a>
            <a href={SOURCE_URL} target="_blank" rel="noreferrer">
              Source code ↗
            </a>
            <a href={GOVERNANCE_URL} target="_blank" rel="noreferrer">
              YIP-91 ↗
            </a>
            <a href={GOVERNANCE_VOTE_URL} target="_blank" rel="noreferrer">
              Governance approval ↗
            </a>
            <a href="/api/products/usd-fixed" target="_blank" rel="noreferrer">
              Product JSON ↗
            </a>
          </nav>
        </section>

        <section className="institution-contracts" aria-labelledby="institution-contracts-title">
          <div className="institution-section-heading">
            <p className="earn-section-label">Deployed contracts</p>
            <h2 id="institution-contracts-title">Verify every layer.</h2>
          </div>
          <div className="institution-contracts__grid">
            <ContractLink address={CONTRACTS.fixed}>Fixed strategy</ContractLink>
            <ContractLink address={CONTRACTS.levered}>Levered strategy</ContractLink>
            <ContractLink address={CONTRACTS.equity}>Equity strategy</ContractLink>
            <ContractLink address={CONTRACTS.controller}>Tranche controller</ContractLink>
            <ContractLink address={CONTRACTS.hook}>Liquidity hook</ContractLink>
            <ContractLink address={CONTRACTS.vault}>Underlying vault</ContractLink>
          </div>
          <p className="institution-risk">
            Fixed has economic priority, not principal protection. If supporting capital and any configured reserve are
            insufficient, Fixed can lose value. Smart-contract, strategy, USDC, governance, and liquidity risks apply.
          </p>
        </section>

        <section className="institution-final-cta" aria-labelledby="institution-final-cta-title">
          <div>
            <p className="earn-section-label">Treasury access</p>
            <h2 id="institution-final-cta-title">Designed for treasury capital.</h2>
          </div>
          <span className="institution-contact-action">
            <button type="button" disabled>
              Contact us
            </button>
          </span>
        </section>
      </main>

      <footer className="earn-footer earn-footer--institutions">
        <EarnBrand inverse={theme === 'dark'} />
        <Link className="institution-primary-link" href="/#earn">
          Open Earn <span aria-hidden="true">→</span>
        </Link>
        <p>Live values are informational and should be independently verified before allocation.</p>
      </footer>
    </div>
  )
}
