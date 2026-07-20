import { Header } from '@ybold/components/Header'
import { BOLD, ST_YBOLD, YBOLD, YEARN_VAULT_URL } from '@ybold/lib/contracts'
import { getVaultStats } from '@ybold/lib/ydaemon'
import { YBoldVaultWidget } from '@yearn/vault-widget'
import Image from 'next/image'

const pct = (value: number, decimalPlaces = 2) => `${(value * 100).toFixed(decimalPlaces)}%`
const usd = (value: number) =>
  value >= 1_000_000 ? `$${(value / 1_000_000).toFixed(2)}M` : `$${Math.round(value).toLocaleString('en-US')}`

export default async function Home() {
  const stats = await getVaultStats()

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 sm:px-6">
        <section className="grid grid-cols-[minmax(0,1fr)] items-start gap-12 py-12 min-[900px]:grid-cols-[minmax(0,1.15fr)_minmax(0,26rem)] min-[900px]:py-20">
          <div className="min-w-0">
            <div className="flex items-center gap-4">
              <Image src="/ybold.svg" alt="" width={88} height={88} className="rounded-full" />
              <span className="text-5xl font-bold tracking-tight min-[900px]:text-6xl">yBOLD</span>
            </div>
            <h1 className="mt-5 max-w-xl text-[40px] font-medium leading-[1.08] tracking-tight min-[900px]:text-[56px]">
              Earn BOLD yield automatically across Liquity Stability Pools
            </h1>
            <p className="mt-5 max-w-lg text-lg text-navy/75">
              Deposit BOLD once. Yearn allocates it across the WETH, wstETH, and rETH Stability Pools, harvests
              liquidation gains, and compounds everything back into BOLD.
            </p>

            <div className="mt-10 max-w-lg rounded-lg border border-line bg-surface p-6">
              {stats ? (
                <>
                  <div className="flex items-center gap-2 text-sm text-muted">
                    <span aria-hidden className="size-2 rounded-full bg-green" />
                    7-day realized APY
                  </div>
                  <div className="mt-1 text-5xl font-medium text-yearn">{pct(stats.apy7d, 1)}</div>
                  <p className="mt-2 text-sm text-muted">
                    Annualized from the last 7 days — recent results from borrower interest, Trove fees, and liquidation
                    gains. Not a forecast.
                  </p>
                  <dl className="mt-5 divide-y divide-line text-sm">
                    {(
                      [
                        ['30-day realized APY', pct(stats.apy30d, 1)],
                        ['Actual 7-day return', pct(stats.ret7d)],
                        ['APY since inception', pct(stats.apyInception, 1)],
                        ['Total deposits', usd(stats.tvlUsd)],
                        ['Fees', `${pct(stats.performanceFee, 0)} on earnings, nothing on deposits`]
                      ] as const
                    ).map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between py-2.5">
                        <dt className="text-muted">{label}</dt>
                        <dd className="font-medium">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </>
              ) : (
                <p className="text-navy/75">
                  Live APY temporarily unavailable —{' '}
                  <a className="text-yearn underline" href={YEARN_VAULT_URL}>
                    view on yearn.fi
                  </a>
                  .
                </p>
              )}
            </div>
          </div>

          <YBoldVaultWidget apy={stats?.apy7d} className="min-w-0" />
        </section>

        <div aria-hidden className="flex items-end gap-2 py-2">
          <div className="size-14 rounded-full bg-yearn" />
          <div className="h-7 w-14 self-end rounded-t-full bg-yellow" />
          <div className="size-14 rounded-md bg-green" />
          <div className="h-3.5 w-36 self-center rounded-full bg-navy" />
        </div>

        <section className="py-14">
          <h2 className="text-3xl font-medium tracking-tight">Where the yield comes from</h2>
          <p className="mt-3 max-w-2xl text-lg text-navy/75">
            Stability Pool returns move more than ordinary lending rates. yBOLD earns from three sources, which is why
            recent APY can differ from long-run averages.
          </p>
          <div className="mt-8 grid gap-4 min-[900px]:grid-cols-3">
            <div className="rounded-lg border border-line bg-surface p-7">
              <h3 className="text-xl font-medium">Borrower interest</h3>
              <p className="mt-2 text-navy/75">
                Liquity V2 borrowers pay user-set interest rates on their BOLD debt. A share flows continuously to
                Stability Pool depositors.
              </p>
            </div>
            <div className="rounded-lg bg-yellow p-7">
              <h3 className="text-xl font-medium">Trove fees</h3>
              <p className="mt-2 text-navy/75">
                Upfront fees from new and adjusted Troves are distributed to the Stability Pools. These arrive in
                variable, sometimes lumpy amounts.
              </p>
            </div>
            <div className="rounded-lg bg-green p-7">
              <h3 className="text-xl font-medium">Liquidation gains</h3>
              <p className="mt-2 text-navy/75">
                When Troves are liquidated, pools buy their collateral at a discount. Yearn auctions the WETH, wstETH,
                and rETH back into BOLD.
              </p>
            </div>
          </div>
        </section>

        <section className="py-14">
          <h2 className="text-3xl font-medium tracking-tight">How yBOLD compares</h2>
          <div className="mt-8 overflow-x-auto rounded-lg border border-line bg-surface">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="px-6 py-4 font-normal" />
                  <th className="px-6 py-4 font-medium text-navy">
                    <span className="flex items-center gap-2">
                      <Image src="/ybold.svg" alt="" width={18} height={18} className="rounded-full" />
                      yBOLD
                    </span>
                  </th>
                  <th className="px-6 py-4 font-normal">Native Stability Pool</th>
                </tr>
              </thead>
              <tbody className="[&_td]:px-6 [&_td]:py-3.5">
                <tr className="border-b border-line">
                  <td className="text-muted">Pool allocation</td>
                  <td className="font-medium">Automatic, across all three pools</td>
                  <td className="text-navy/75">Manual, one pool at a time</td>
                </tr>
                <tr className="border-b border-line">
                  <td className="text-muted">Liquidation collateral</td>
                  <td className="font-medium">Auctioned back to BOLD for you</td>
                  <td className="text-navy/75">You claim and sell it yourself</td>
                </tr>
                <tr className="border-b border-line">
                  <td className="text-muted">Compounding</td>
                  <td className="font-medium">Automatic</td>
                  <td className="text-navy/75">Manual</td>
                </tr>
                <tr>
                  <td className="text-muted">Fees</td>
                  <td className="font-medium">10% on earnings only</td>
                  <td className="text-navy/75">None</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="py-14">
          <div className="relative overflow-hidden rounded-lg bg-navy p-8 text-white sm:p-12">
            <div aria-hidden className="absolute -right-16 -top-16 size-56 rounded-full bg-yellow" />
            <div
              aria-hidden
              className="absolute -bottom-10 right-24 hidden h-20 w-40 rounded-t-full bg-electric sm:block"
            />
            <h2 className="relative text-3xl font-medium tracking-tight">Deposit BOLD. Earn. Withdraw BOLD.</h2>
            <div className="relative mt-8 grid max-w-4xl gap-8 min-[900px]:grid-cols-3">
              {[
                ['1', 'Deposit', 'One transaction puts your BOLD to work — staking is handled for you.'],
                [
                  '2',
                  'Earn',
                  'Yield and liquidation gains are harvested and compounded. Your position value in BOLD grows over time.'
                ],
                [
                  '3',
                  'Withdraw',
                  'Redeem back to BOLD in your wallet anytime, subject to available Stability Pool liquidity.'
                ]
              ].map(([number, title, body]) => (
                <div key={number}>
                  <div
                    aria-hidden
                    className="flex size-9 items-center justify-center rounded-full bg-green text-sm font-medium text-navy"
                  >
                    {number}
                  </div>
                  <h3 className="mt-4 text-lg font-medium">{title}</h3>
                  <p className="mt-1.5 text-white/70">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="mt-12 border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-12 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div>
            <Image src="/yearn-logo.svg" alt="Yearn" width={110} height={30} />
            <p className="mt-4 max-w-sm text-sm text-muted">
              APY figures are realized annualized returns over the stated window, not forecasts. Past performance does
              not predict future results. Smart contract and depeg risks apply.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-12 gap-y-2.5 text-sm">
            <a
              className="text-navy/75 transition hover:text-navy"
              href={YEARN_VAULT_URL}
              target="_blank"
              rel="noreferrer"
            >
              yBOLD on yearn.fi ↗
            </a>
            <a
              className="text-navy/75 transition hover:text-navy"
              href="https://www.liquity.org/earn"
              target="_blank"
              rel="noreferrer"
            >
              Liquity Earn ↗
            </a>
            <a
              className="text-navy/75 transition hover:text-navy"
              href={`https://etherscan.io/address/${YBOLD}`}
              target="_blank"
              rel="noreferrer"
            >
              yBOLD contract ↗
            </a>
            <a
              className="text-navy/75 transition hover:text-navy"
              href={`https://etherscan.io/address/${ST_YBOLD}`}
              target="_blank"
              rel="noreferrer"
            >
              Staked yBOLD contract ↗
            </a>
            <a
              className="text-navy/75 transition hover:text-navy"
              href={`https://etherscan.io/address/${BOLD}`}
              target="_blank"
              rel="noreferrer"
            >
              BOLD contract ↗
            </a>
            <a
              className="text-navy/75 transition hover:text-navy"
              href="https://docs.yearn.fi"
              target="_blank"
              rel="noreferrer"
            >
              Yearn docs ↗
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
