'use client'

import { useAccountModal, useConnectModal } from '@rainbow-me/rainbowkit'
import { createYBoldPreset, VaultWidget, type VaultWidgetMode, VaultWidgetProvider } from '@yearn/vault-widget'
import { createYearnFiActivityStore, createYearnFiSettingsStore } from '@yearn/vault-widget/services'
import type { ReactElement, RefObject } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAccount } from 'wagmi'

const yBoldConfig = createYBoldPreset({
  ensoEndpoint: '/api/enso/route'
})

const legacyVaultPath = `/vaults/${yBoldConfig.chainId}/${yBoldConfig.vaultAddress}`
const DESKTOP_VIEWPORT = { width: 1440, height: 900 }
const MOBILE_VIEWPORT = { width: 390, height: 844 }
const DESKTOP_WIDGET_CROP = { left: 916, top: 190, width: 406, height: 570 }

type TestViewport = 'desktop' | 'mobile'
function getButtonLabel(element: Element): string {
  return element.textContent?.replace(/\s+/g, ' ').trim().toLowerCase() ?? ''
}

function isVisible(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

function synchronizeLegacyWidget(
  iframe: HTMLIFrameElement | null,
  viewport: TestViewport,
  mode: VaultWidgetMode
): void {
  const document = iframe?.contentDocument
  if (!document) return
  const modeLabel = mode === 'info' ? 'my info' : mode

  const candidates = Array.from(document.querySelectorAll<HTMLElement>('button, [role="tab"]')).filter(
    (element) => getButtonLabel(element) === modeLabel && isVisible(element)
  )
  if (candidates.length === 0) return

  if (viewport === 'desktop') {
    const widgetTab = candidates.find((element) => {
      const rect = element.getBoundingClientRect()
      return rect.left > DESKTOP_WIDGET_CROP.left && rect.top > DESKTOP_WIDGET_CROP.top
    })
    widgetTab?.click()
    return
  }

  // On mobile the first click opens the legacy action drawer. Once open, the
  // same label appears again in its tab bar; the next synchronization pass
  // selects that tab without coupling the package to legacy implementation.
  const lowestButton = candidates.reduce((lowest, candidate) =>
    candidate.getBoundingClientRect().top > lowest.getBoundingClientRect().top ? candidate : lowest
  )
  lowestButton.click()
}

function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange
}: {
  label: string
  options: readonly { label: string; value: T }[]
  value: T
  onChange: (value: T) => void
}): ReactElement {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-text-secondary">
        {label}
      </legend>
      <div className="inline-flex rounded-lg border border-border bg-surface-secondary p-1">
        {options.map((option) => (
          <button
            className={[
              'min-h-9 rounded-md px-4 text-sm font-medium transition-colors',
              value === option.value
                ? 'border border-border bg-surface text-text-primary shadow-sm'
                : 'border border-transparent text-text-secondary hover:text-text-primary'
            ].join(' ')}
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function ComparisonFrame({
  title,
  eyebrow,
  children,
  width
}: {
  title: string
  eyebrow: string
  children: ReactElement
  width: number
}): ReactElement {
  return (
    <section className="min-w-0" style={{ width }}>
      <header className="mb-3 flex min-h-10 items-end justify-between gap-4 border-b border-border pb-3">
        <div>
          <p className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-text-secondary">{eyebrow}</p>
          <h2 className="mt-1 text-base font-bold">{title}</h2>
        </div>
      </header>
      {children}
    </section>
  )
}

function LegacyFrame({
  iframeRef,
  viewport,
  sessionKey,
  onLoad
}: {
  iframeRef: RefObject<HTMLIFrameElement | null>
  viewport: TestViewport
  sessionKey: string
  onLoad: () => void
}): ReactElement {
  const isDesktop = viewport === 'desktop'
  const frameWidth = isDesktop ? DESKTOP_WIDGET_CROP.width : MOBILE_VIEWPORT.width
  const frameHeight = isDesktop ? DESKTOP_WIDGET_CROP.height : MOBILE_VIEWPORT.height
  const iframeWidth = isDesktop ? DESKTOP_VIEWPORT.width : MOBILE_VIEWPORT.width
  const iframeHeight = isDesktop ? DESKTOP_VIEWPORT.height : MOBILE_VIEWPORT.height

  return (
    <div
      className="relative overflow-hidden rounded-lg border border-border bg-app"
      style={{ width: frameWidth, height: frameHeight }}
    >
      <iframe
        className="absolute max-w-none border-0 bg-app"
        key={`${viewport}:${sessionKey}`}
        ref={iframeRef}
        src={legacyVaultPath}
        title={`Legacy yBOLD vault widget at ${viewport} viewport`}
        width={iframeWidth}
        height={iframeHeight}
        onLoad={onLoad}
        style={{
          width: iframeWidth,
          height: iframeHeight,
          left: isDesktop ? -DESKTOP_WIDGET_CROP.left : 0,
          top: isDesktop ? -DESKTOP_WIDGET_CROP.top : 0
        }}
      />
    </div>
  )
}

export function VaultWidgetParityPage(): ReactElement {
  const { openConnectModal } = useConnectModal()
  const { openAccountModal } = useAccountModal()
  const { address, isConnected } = useAccount()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [viewport, setViewport] = useState<TestViewport>('desktop')
  const [mode, setMode] = useState<VaultWidgetMode>('deposit')
  const [legacyLoadCount, setLegacyLoadCount] = useState(0)
  const services = useMemo(
    () => ({
      activityStore: createYearnFiActivityStore(),
      settings: createYearnFiSettingsStore()
    }),
    []
  )
  const comparisonWidth = viewport === 'desktop' ? DESKTOP_WIDGET_CROP.width : MOBILE_VIEWPORT.width

  const synchronizeLegacy = useCallback(() => {
    synchronizeLegacyWidget(iframeRef.current, viewport, mode)
  }, [mode, viewport])

  // The parity harness is intentionally allowed to drive its same-origin
  // legacy iframe so both implementations stay on the selected test state.
  useEffect(() => {
    const timeouts = [100, 500, 1200].map((delay) => window.setTimeout(synchronizeLegacy, delay))
    return () =>
      timeouts.forEach((timeout) => {
        window.clearTimeout(timeout)
      })
  }, [legacyLoadCount, synchronizeLegacy])

  return (
    <div className="min-h-[calc(100vh-var(--header-height))] bg-app px-4 py-8 text-text-primary sm:px-6">
      <header className="mx-auto max-w-[1120px]">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-text-secondary">Development only</p>
        <h1 className="text-3xl font-black">Vault widget parity harness</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">
          Compare the legacy yBOLD widget and <code>@yearn/vault-widget</code> at the same explicit viewport and
          transaction state. Desktop isolates the widget from a 1440 × 900 page; mobile renders the complete 390 × 844
          experience.
        </p>
      </header>

      <main className="mx-auto mt-6 max-w-[1120px]">
        <div className="flex flex-wrap items-end justify-between gap-5 rounded-lg border border-border bg-surface p-4">
          <div className="flex flex-wrap gap-6">
            <SegmentedControl
              label="Viewport"
              options={[
                { label: 'Desktop · 1440', value: 'desktop' },
                { label: 'Mobile · 390', value: 'mobile' }
              ]}
              value={viewport}
              onChange={(nextViewport) => {
                setViewport(nextViewport)
                if (nextViewport === 'mobile' && mode === 'info') setMode('deposit')
              }}
            />
            <SegmentedControl
              label="Widget state"
              options={
                viewport === 'desktop'
                  ? [
                      { label: 'Deposit', value: 'deposit' },
                      { label: 'Withdraw', value: 'withdraw' },
                      { label: 'My Info', value: 'info' }
                    ]
                  : [
                      { label: 'Deposit', value: 'deposit' },
                      { label: 'Withdraw', value: 'withdraw' }
                    ]
              }
              value={mode}
              onChange={setMode}
            />
            <fieldset className="min-w-0">
              <legend className="mb-2 text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-text-secondary">
                Wallet session
              </legend>
              <button
                className="min-h-11 rounded-lg border border-border bg-surface-secondary px-4 text-sm font-medium text-text-primary"
                type="button"
                onClick={() => (isConnected ? openAccountModal?.() : openConnectModal?.())}
              >
                {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : 'Connect both surfaces'}
              </button>
            </fieldset>
          </div>
          <div className="max-w-64 text-right">
            <a className="text-sm text-text-secondary underline underline-offset-4" href={legacyVaultPath}>
              Open legacy vault page
            </a>
            <p className="mt-2 text-xs leading-5 text-text-secondary">
              Connect here once. The legacy frame reloads into the same yearn.fi wallet session.
            </p>
          </div>
        </div>

        <div className="mt-8 overflow-x-auto pb-8">
          <div className="mx-auto flex w-max items-start gap-8">
            <ComparisonFrame
              eyebrow={viewport === 'desktop' ? '1440 × 900 source · widget crop' : '390 × 844 source'}
              title="Legacy surface"
              width={comparisonWidth}
            >
              <LegacyFrame
                iframeRef={iframeRef}
                viewport={viewport}
                sessionKey={address ?? 'disconnected'}
                onLoad={() => setLegacyLoadCount((count) => count + 1)}
              />
            </ComparisonFrame>

            <ComparisonFrame
              eyebrow={`@yearn/vault-widget · ${viewport}`}
              title="Package surface"
              width={comparisonWidth}
            >
              <div
                className={['overflow-hidden rounded-lg bg-app', viewport === 'mobile' ? 'flex items-end' : ''].join(
                  ' '
                )}
                style={{ height: viewport === 'desktop' ? DESKTOP_WIDGET_CROP.height : MOBILE_VIEWPORT.height }}
              >
                <VaultWidgetProvider services={services}>
                  <VaultWidget
                    chainId={yBoldConfig.chainId}
                    vaultAddress={yBoldConfig.vaultAddress}
                    config={yBoldConfig}
                    mode={mode}
                    style={viewport === 'mobile' && mode === 'deposit' ? { minHeight: 780 } : undefined}
                    viewport={viewport}
                    onModeChange={setMode}
                    onConnectWallet={() => openConnectModal?.()}
                    onClose={() => undefined}
                  />
                </VaultWidgetProvider>
              </div>
            </ComparisonFrame>
          </div>
        </div>
      </main>
    </div>
  )
}
