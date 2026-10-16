import { formatBps } from '@/components/ytranche/model'

type TProfitFlowPhase = 'fixed' | 'levered' | 'equity'

function ProfitFlowChannel({ phase }: { phase: TProfitFlowPhase }) {
  const path = 'M50 0V52'

  return (
    <svg
      className={`m-profit-flow__channel m-profit-flow__channel--${phase}`}
      viewBox="0 0 100 52"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path className="m-profit-flow__track" d={path} vectorEffect="non-scaling-stroke" />
      <path className="m-profit-flow__stream" d={path} pathLength={1} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export function ProfitFlow({ targetRateBps }: { targetRateBps: bigint }) {
  return (
    <figure className="m-profit-flow" aria-labelledby="profit-flow-title" aria-describedby="profit-flow-note">
      <figcaption className="m-profit-flow__caption">
        <div>
          <span className="m-priority__eyebrow">Animated study</span>
          <strong id="profit-flow-title">Profit waterfall</strong>
        </div>
        <span className="m-profit-flow__tag">Illustrative</span>
      </figcaption>

      <div className="m-profit-flow__stage">
        <div className="m-profit-flow__source">
          <div>
            <span className="m-priority__eyebrow">Available profit</span>
            <strong>Yearn V3 vault</strong>
          </div>
          <span className="m-profit-flow__source-mark" aria-hidden="true">
            V3
          </span>
        </div>

        <ol className="m-profit-flow__sequence" aria-label="Profit distribution order">
          <li>
            <ProfitFlowChannel phase="fixed" />
            <div className="m-profit-flow__node m-profit-flow__node--fixed">
              <span className="m-priority__eyebrow">01 · Target</span>
              <strong>Fixed (Senior)</strong>
              <em>{formatBps(targetRateBps)}% target only</em>
            </div>
          </li>

          <li>
            <ProfitFlowChannel phase="levered" />
            <div className="m-profit-flow__node m-profit-flow__node--levered">
              <span className="m-priority__eyebrow">02 · Target + excess</span>
              <strong>Levered (Mezzanine)</strong>
              <em>Target + excess share</em>
            </div>
          </li>

          <li>
            <ProfitFlowChannel phase="equity" />
            <div className="m-profit-flow__node m-profit-flow__node--equity">
              <span className="m-priority__eyebrow">03 · Excess only</span>
              <strong>Equity (Junior)</strong>
              <em>Excess share only</em>
            </div>
          </li>
        </ol>
      </div>

      <p className="m-profit-flow__note" id="profit-flow-note">
        Targets accrue in priority order. After targets, excess is shared by Levered and Equity. Rates and splits are
        configurable.
      </p>
    </figure>
  )
}
