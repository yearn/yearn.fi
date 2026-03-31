import { Meta } from '@shared/components/Meta'
import type { ReactElement, ReactNode } from 'react'
import { useEffect, useState } from 'react'

type TFontCandidate = {
  family: string
  kind: 'named' | 'system' | 'generic'
  label: string
  note: string
}

type TFontIdentityCandidate = Pick<TFontCandidate, 'family' | 'kind' | 'label'>
type TFontProbe = {
  fontSizePx: number
  fontStyle: 'normal' | 'italic'
  fontWeight: number
  label: string
  sampleText: string
}

type TRenderedFontMatch = {
  aliases: string[]
  label: string
  primaryLabel: string | null
}

const SANS_STACK: TFontCandidate[] = [
  { family: '"Aeonik"', kind: 'named', label: 'Aeonik', note: 'Primary self-hosted UI sans.' },
  { family: 'Helvetica', kind: 'named', label: 'Helvetica', note: 'Primary Apple-compatible sans fallback.' },
  { family: 'Arial', kind: 'named', label: 'Arial', note: 'Cross-platform safety-net sans.' },
  {
    family: 'system-ui',
    kind: 'system',
    label: 'system-ui',
    note: 'Late cross-platform system UI fallback keyword.'
  },
  { family: 'sans-serif', kind: 'generic', label: 'sans-serif', note: 'Browser generic sans fallback.' }
]

const MONO_STACK: TFontCandidate[] = [
  { family: '"Aeonik Mono"', kind: 'named', label: 'Aeonik Mono', note: 'Primary mono for numeric UI samples.' },
  { family: 'Menlo', kind: 'named', label: 'Menlo', note: 'Preferred macOS mono fallback.' },
  { family: 'Consolas', kind: 'named', label: 'Consolas', note: 'Preferred Windows mono fallback.' },
  { family: '"Liberation Mono"', kind: 'named', label: 'Liberation Mono', note: 'Common Linux mono fallback.' },
  { family: 'monospace', kind: 'generic', label: 'monospace', note: 'Browser generic mono fallback.' }
]

const SANS_RENDER_CANDIDATES: TFontIdentityCandidate[] = [
  { family: '"Aeonik"', kind: 'named', label: 'Aeonik' },
  { family: '"SF Pro Text"', kind: 'named', label: 'SF Pro Text' },
  { family: '"SF Pro Display"', kind: 'named', label: 'SF Pro Display' },
  { family: 'Helvetica', kind: 'named', label: 'Helvetica' },
  { family: 'Arial', kind: 'named', label: 'Arial' },
  { family: '"Segoe UI"', kind: 'named', label: 'Segoe UI' },
  { family: 'Roboto', kind: 'named', label: 'Roboto' },
  { family: 'system-ui', kind: 'system', label: 'system-ui' },
  { family: 'sans-serif', kind: 'generic', label: 'sans-serif' }
]

const MONO_RENDER_CANDIDATES: TFontIdentityCandidate[] = [
  { family: '"Aeonik Mono"', kind: 'named', label: 'Aeonik Mono' },
  { family: '"SFMono-Regular"', kind: 'named', label: 'SFMono-Regular' },
  { family: 'Menlo', kind: 'named', label: 'Menlo' },
  { family: 'Consolas', kind: 'named', label: 'Consolas' },
  { family: '"Liberation Mono"', kind: 'named', label: 'Liberation Mono' },
  { family: 'monospace', kind: 'generic', label: 'monospace' }
]

const SANS_RENDER_PROBES: TFontProbe[] = [
  { label: 'Regular', fontSizePx: 14, fontStyle: 'normal', fontWeight: 400, sampleText: 'Yearn BOLD Stability Pool' },
  { label: 'Bold', fontSizePx: 18, fontStyle: 'normal', fontWeight: 900, sampleText: 'Yearn BOLD 2.74%' },
  { label: 'Italic', fontSizePx: 14, fontStyle: 'italic', fontWeight: 400, sampleText: 'Italic stress sample' }
]

const MONO_RENDER_PROBES: TFontProbe[] = [
  { label: 'Regular', fontSizePx: 16, fontStyle: 'normal', fontWeight: 400, sampleText: '2.74% 3.00% $4.54M' },
  { label: 'Bold', fontSizePx: 14, fontStyle: 'normal', fontWeight: 700, sampleText: '9,430 BOLD ($9,480)' },
  {
    label: 'Italic',
    fontSizePx: 12,
    fontStyle: 'italic',
    fontWeight: 400,
    sampleText: 'Projected settlement 03/26/26 14:08'
  }
]

const BODY_STACK = SANS_STACK.map((entry) => entry.family).join(', ')
const NUMBER_STACK = MONO_STACK.map((entry) => entry.family).join(', ')

const DETAIL_STATS = [
  { label: 'Est. APY', value: '2.74%' },
  { label: 'TVL', value: '$4.54M' },
  { label: 'Your deposits', value: '$0.00' }
]

const NUMBER_ROWS = [
  { label: 'Vault share value', value: '9,430 BOLD ($9,480)' },
  { label: 'Expected out', value: '10.0K BOLD' },
  { label: 'Price impact', value: '-5.66%' }
]

function buildFallbackStack(candidates: TFontCandidate[], startIndex: number): string {
  return candidates
    .slice(startIndex)
    .map((entry) => entry.family)
    .join(', ')
}

function buildCanvasFont(probe: TFontProbe, fontFamily: string): string {
  return `${probe.fontStyle} ${probe.fontWeight} ${probe.fontSizePx}px ${fontFamily}`
}

function buildFontFingerprint(fontFamily: string, probe: TFontProbe): string | null {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d', { willReadFrequently: true })

  if (!context) {
    return null
  }

  context.font = buildCanvasFont(probe, fontFamily)
  context.textBaseline = 'top'

  const width = Math.max(1, Math.ceil(context.measureText(probe.sampleText).width + 32))
  const height = Math.max(1, Math.ceil(probe.fontSizePx * 3))

  canvas.width = width
  canvas.height = height

  const renderContext = canvas.getContext('2d', { willReadFrequently: true })

  if (!renderContext) {
    return null
  }

  renderContext.fillStyle = '#ffffff'
  renderContext.fillRect(0, 0, width, height)
  renderContext.fillStyle = '#000000'
  renderContext.font = buildCanvasFont(probe, fontFamily)
  renderContext.textBaseline = 'top'
  renderContext.fontKerning = 'normal'
  renderContext.fillText(probe.sampleText, 16, 12)

  const imageData = renderContext.getImageData(0, 0, width, height).data
  let hash = 2166136261

  for (let index = 0; index < imageData.length; index += 4) {
    hash = Math.imul(hash ^ imageData[index + 3], 16777619)
  }

  return `${width}:${height}:${hash >>> 0}`
}

function rankRenderedMatches(matches: TFontIdentityCandidate[]): TFontIdentityCandidate[] {
  const priority = {
    named: 0,
    system: 1,
    generic: 2
  }

  return [...matches].sort((candidateA, candidateB) => priority[candidateA.kind] - priority[candidateB.kind])
}

function inferRenderedFontMatch(
  stack: string,
  candidates: TFontIdentityCandidate[],
  probe: TFontProbe
): TRenderedFontMatch {
  const stackFingerprint = buildFontFingerprint(stack, probe)

  if (!stackFingerprint) {
    return { label: probe.label, primaryLabel: null, aliases: [] }
  }

  const matches = candidates.filter((candidate) => buildFontFingerprint(candidate.family, probe) === stackFingerprint)

  if (!matches.length) {
    return { label: probe.label, primaryLabel: null, aliases: [] }
  }

  const rankedMatches = rankRenderedMatches(matches)

  return {
    label: probe.label,
    primaryLabel: rankedMatches[0]?.label || null,
    aliases: rankedMatches.slice(1).map((candidate) => candidate.label)
  }
}

function inferRenderedFontMatches(
  stack: string,
  candidates: TFontIdentityCandidate[],
  probes: TFontProbe[]
): TRenderedFontMatch[] {
  return probes.map((probe) => inferRenderedFontMatch(stack, candidates, probe))
}

function formatRenderedFontMatches(matches: TRenderedFontMatch[]): string {
  const primaryLabels = [
    ...new Set(matches.map((match) => match.primaryLabel).filter((label): label is string => Boolean(label)))
  ]

  if (!primaryLabels.length) {
    return 'No exact match in known candidates'
  }

  if (primaryLabels.length === 1) {
    return primaryLabels[0]
  }

  return matches.map((match) => `${match.label} ${match.primaryLabel || 'Unknown'}`).join(' · ')
}

function RenderedFontHeader({
  isolatedStack,
  fallbackStack,
  candidates,
  probes
}: {
  candidates: TFontIdentityCandidate[]
  fallbackStack: string
  isolatedStack: string
  probes: TFontProbe[]
}): ReactElement {
  const [isolatedMatches, setIsolatedMatches] = useState<TRenderedFontMatch[]>([])
  const [fallbackMatches, setFallbackMatches] = useState<TRenderedFontMatch[]>([])

  useEffect(() => {
    setIsolatedMatches(inferRenderedFontMatches(isolatedStack, candidates, probes))
    setFallbackMatches(inferRenderedFontMatches(fallbackStack, candidates, probes))
  }, [candidates, fallbackStack, isolatedStack, probes])

  return (
    <div className={'min-w-0 rounded-lg border border-border bg-surface-secondary px-3 py-2'}>
      <p className={'font-number text-[10px] uppercase tracking-wide text-text-tertiary'}>{'Likely Rendered'}</p>
      <div className={'mt-2 grid gap-1 text-xs text-text-secondary'}>
        <p>
          <span className={'font-medium text-text-primary'}>{'Isolated: '}</span>
          {formatRenderedFontMatches(isolatedMatches)}
        </p>
        <p>
          <span className={'font-medium text-text-primary'}>{'Fallback: '}</span>
          {formatRenderedFontMatches(fallbackMatches)}
        </p>
      </div>
    </div>
  )
}

function PreviewShell({ children, fontFamily }: { children: ReactNode; fontFamily: string }): ReactElement {
  return (
    <div className={'flex flex-col gap-4 border border-border bg-surface-secondary p-4'} style={{ fontFamily }}>
      {children}
    </div>
  )
}

function PreviewPanel({ label, stack, preview }: { label: string; preview: ReactNode; stack: string }): ReactElement {
  return (
    <div className={'flex flex-col gap-2'}>
      <div className={'flex flex-col gap-1'}>
        <p className={'font-number text-xs text-text-tertiary'}>{label}</p>
        <code className={'font-number break-all text-xs text-text-secondary'}>{stack}</code>
      </div>
      {preview}
    </div>
  )
}

function VaultSansPreview({ fontFamily }: { fontFamily: string }): ReactElement {
  return (
    <PreviewShell fontFamily={fontFamily}>
      <div className={'flex flex-col gap-1'}>
        <p className={'text-xs uppercase tracking-wide text-text-secondary'}>{'Vault Header'}</p>
        <h3 className={'truncate-safe text-lg font-black leading-tight text-text-primary'}>{'Yearn BOLD'}</h3>
        <p className={'text-sm text-text-secondary'}>{'Ethereum · Stablecoin · Single Asset'}</p>
      </div>

      <div className={'grid gap-3 md:grid-cols-3'}>
        {DETAIL_STATS.map((item) => (
          <div key={item.label} className={'rounded-lg border border-border bg-surface p-3'}>
            <p className={'text-[10px] uppercase tracking-wide text-text-secondary'}>{item.label}</p>
            <p className={'mt-1 text-base font-semibold text-text-primary'}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className={'rounded-lg border border-border bg-surface p-4'}>
        <p className={'text-sm leading-relaxed text-text-primary'}>
          {
            "yBOLD is Yearn's BOLD tokenized Stability Pool product. It is designed to tokenize the benefits of a BOLD-in-stability-pool position."
          }
        </p>
        <p className={'mt-2 text-sm italic text-text-secondary'}>
          {
            'Italic stress sample: explanatory copy and warning notes should still read cleanly if Aeonik is unavailable.'
          }
        </p>
      </div>

      <div
        className={
          'inline-flex w-fit items-center rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-text-primary'
        }
      >
        {'Approve & Deposit'}
      </div>
    </PreviewShell>
  )
}

function VaultMonoPreview({ fontFamily }: { fontFamily: string }): ReactElement {
  return (
    <PreviewShell fontFamily={fontFamily}>
      <div className={'flex flex-col gap-1'}>
        <p className={'text-xs uppercase tracking-wide text-text-secondary'}>{'Metric Samples'}</p>
        <p className={'text-lg font-semibold text-text-primary'}>{'2.74%   3.00%   $4.54M'}</p>
      </div>

      <div className={'rounded-lg border border-border bg-surface p-4'}>
        <div className={'grid gap-2'}>
          {NUMBER_ROWS.map((item) => (
            <div key={item.label} className={'flex items-baseline justify-between gap-4'}>
              <span className={'text-xs text-text-secondary'}>{item.label}</span>
              <span className={'text-sm font-semibold text-text-primary'}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={'rounded-lg border border-border bg-surface p-4'}>
        <p className={'break-all text-sm font-medium text-text-primary'}>
          {'0x9f4330700a36b29952869fac9b33f45eedd8a3d8'}
        </p>
        <p className={'mt-2 text-xs italic text-text-secondary'}>{'Projected settlement 03/26/26 14:08'}</p>
      </div>
    </PreviewShell>
  )
}

function FontCard({
  candidate,
  fallbackStack,
  isolatedPreview,
  fallbackPreview,
  probeCandidates,
  probes,
  order
}: {
  candidate: TFontCandidate
  fallbackPreview: ReactNode
  fallbackStack: string
  isolatedPreview: ReactNode
  order: number
  probeCandidates: TFontIdentityCandidate[]
  probes: TFontProbe[]
}): ReactElement {
  return (
    <article className={'flex h-full flex-col gap-4 border border-border bg-surface p-4'}>
      <div className={'flex items-start justify-between gap-3'}>
        <div className={'flex flex-col gap-1'}>
          <p className={'font-number text-xs text-text-tertiary'}>{`${order}. ${candidate.label}`}</p>
          <h2 className={'text-base font-semibold text-text-primary'}>{candidate.note}</h2>
        </div>
        <RenderedFontHeader
          isolatedStack={candidate.family}
          fallbackStack={fallbackStack}
          candidates={probeCandidates}
          probes={probes}
        />
      </div>
      <PreviewPanel label={'Isolated family'} stack={candidate.family} preview={isolatedPreview} />
      <PreviewPanel label={'Fallback from here'} stack={fallbackStack} preview={fallbackPreview} />
    </article>
  )
}

function StackPreview({
  title,
  description,
  stack,
  preview
}: {
  title: string
  description: string
  stack: string
  preview: ReactNode
}): ReactElement {
  return (
    <section className={'flex flex-col gap-4 border border-border bg-surface p-5'}>
      <div className={'flex flex-col gap-1'}>
        <p className={'font-number text-xs text-text-tertiary'}>{title}</p>
        <h2 className={'text-xl font-semibold text-text-primary'}>{description}</h2>
      </div>
      <code className={'font-number break-all text-xs text-text-secondary'}>{stack}</code>
      {preview}
    </section>
  )
}

function Index(): ReactElement {
  const [platform, setPlatform] = useState('Unknown platform')

  useEffect(() => {
    const navigatorWithUserAgentData = navigator as Navigator & {
      userAgentData?: { platform?: string }
    }

    setPlatform(navigatorWithUserAgentData.userAgentData?.platform || navigator.platform || 'Unknown platform')
  }, [])

  return (
    <div className={'min-h-[calc(100vh-var(--header-height))] bg-app'}>
      <Meta
        title={'Yearn Font Fallbacks'}
        description={'Inspect Yearn sans and mono fallback order on the current system.'}
        titleColor={'#ffffff'}
        themeColor={'#000000'}
        og={'https://yearn.fi/og.png'}
        uri={'https://yearn.fi/font-fallbacks'}
      />
      <main className={'mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 md:px-6 xl:px-8'}>
        <section className={'flex flex-col gap-4 border border-border bg-surface p-6'}>
          <p className={'font-number text-xs text-text-tertiary'}>Font Fallback Debug</p>
          <div className={'flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between'}>
            <div className={'max-w-3xl space-y-3'}>
              <h1 className={'text-3xl font-semibold text-text-primary'}>
                Compare the exact sans and mono fallback order on this machine.
              </h1>
              <p className={'max-w-2xl text-sm text-text-secondary'}>
                Use this page to compare the live body stack and number stack against each individual fallback
                candidate. Each card shows the isolated family first, then the actual remaining fallback chain from that
                point in the stack. The bold weights mirror the vault detail route, and the italic lines are included as
                a deliberate stress test. The rendered-face readout is inferred by matching canvas output against known
                families on this machine.
              </p>
            </div>
            <div className={'grid gap-2 text-sm text-text-secondary'}>
              <span>{`Platform: ${platform}`}</span>
              <span>{`Route: /font-fallbacks`}</span>
            </div>
          </div>
        </section>

        <section className={'grid gap-6 lg:grid-cols-2'}>
          <StackPreview
            title={'Current Sans Stack'}
            description={'This is the full body stack the app now requests.'}
            stack={BODY_STACK}
            preview={<VaultSansPreview fontFamily={BODY_STACK} />}
          />
          <StackPreview
            title={'Current Mono Stack'}
            description={'This is the number and metrics stack the app now requests.'}
            stack={NUMBER_STACK}
            preview={<VaultMonoPreview fontFamily={NUMBER_STACK} />}
          />
        </section>

        <section className={'flex flex-col gap-4'}>
          <div className={'flex flex-col gap-2'}>
            <p className={'font-number text-xs text-text-tertiary'}>Sans Candidates</p>
            <h2 className={'text-2xl font-semibold text-text-primary'}>Body fallback order, one family at a time.</h2>
          </div>
          <div className={'grid gap-4 lg:grid-cols-2 xl:grid-cols-3'}>
            {SANS_STACK.map((candidate, index) => (
              <FontCard
                key={candidate.label}
                candidate={candidate}
                fallbackPreview={<VaultSansPreview fontFamily={buildFallbackStack(SANS_STACK, index)} />}
                fallbackStack={buildFallbackStack(SANS_STACK, index)}
                isolatedPreview={<VaultSansPreview fontFamily={candidate.family} />}
                order={index + 1}
                probeCandidates={SANS_RENDER_CANDIDATES}
                probes={SANS_RENDER_PROBES}
              />
            ))}
          </div>
        </section>

        <section className={'flex flex-col gap-4 pb-10'}>
          <div className={'flex flex-col gap-2'}>
            <p className={'font-number text-xs text-text-tertiary'}>Mono Candidates</p>
            <h2 className={'text-2xl font-semibold text-text-primary'}>
              Numeric and code-style fallback order, one family at a time.
            </h2>
          </div>
          <div className={'grid gap-4 lg:grid-cols-2 xl:grid-cols-3'}>
            {MONO_STACK.map((candidate, index) => (
              <FontCard
                key={candidate.label}
                candidate={candidate}
                fallbackPreview={<VaultMonoPreview fontFamily={buildFallbackStack(MONO_STACK, index)} />}
                fallbackStack={buildFallbackStack(MONO_STACK, index)}
                isolatedPreview={<VaultMonoPreview fontFamily={candidate.family} />}
                order={index + 1}
                probeCandidates={MONO_RENDER_CANDIDATES}
                probes={MONO_RENDER_PROBES}
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

export default Index
