'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { StoryChart } from '@wrapped/components/StoryChart'
import { buildCards, shortAddress } from '@wrapped/lib/cards'
import { demo } from '@wrapped/lib/demo'
import { renderCard } from '@wrapped/lib/export'
import { advanceScrollGesture, canScrollWithin, initialScrollGesture } from '@wrapped/lib/scrollNavigation'
import { setThemePreference, useThemePreference } from '@yearn/site-header/theme'
import { useWalletDrawer } from '@yearn/wallet-ui'
import { resolveEnsAddress } from '@yearn/wallet-ui/ens'
import { parseWrapped, type TWrapped } from '@yearn/wrapped-contract'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useAccount, useDisconnect, usePublicClient } from 'wagmi'

function Entry() {
  const router = useRouter()
  const [input, setInput] = useState('')
  const { address } = useAccount()
  const { disconnect } = useDisconnect()
  const { openWalletDrawer } = useWalletDrawer()
  const client = usePublicClient()
  const resolve = useMutation({
    mutationFn: async (value: string) => {
      if (/^0x[a-fA-F0-9]{40}$/.test(value)) return { address: value, name: '' }
      if (!value.includes('.') || !client) throw new Error('Enter a wallet address or ENS name.')
      const resolved = await resolveEnsAddress(client, value).catch(() => {
        throw new Error('ENS is temporarily unavailable. Try a wallet address.')
      })
      if (!resolved.address) throw new Error('No wallet address was found for this ENS name.')
      return { address: resolved.address, name: resolved.name }
    },
    onSuccess: (result) =>
      router.push(
        `/?address=${encodeURIComponent(result.address)}${result.name ? `&name=${encodeURIComponent(result.name)}` : ''}`
      )
  })
  return (
    <main className="landing">
      <div className="symbol-scene" aria-hidden="true">
        <Image src="/yearn-symbol-white-rgb.png" alt="" width={600} height={600} priority />
      </div>
      <section className="entry-copy">
        <h1>
          Yearn
          <br />
          <span>Wrapped</span>
        </h1>
        <p className="intro">A visual overview of your year using Yearn vaults.</p>
        <div className="entry-panel">
          <button
            type="button"
            className="primary"
            onClick={() => (address ? resolve.mutate(address) : openWalletDrawer())}
            disabled={resolve.isPending}
          >
            {address ? `Wrap ${shortAddress(address)}` : 'Connect wallet'}
          </button>
          {address && (
            <button type="button" className="text-button" onClick={() => disconnect()}>
              Disconnect wallet
            </button>
          )}
          <div className="entry-divider">or look up an address</div>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              resolve.mutate(input.trim())
            }}
          >
            <label className="sr-only" htmlFor="address-input">
              Wallet address or ENS name
            </label>
            <input
              id="address-input"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="0x… or yourname.eth"
              value={input}
              onChange={(event) => {
                setInput(event.target.value)
                resolve.reset()
              }}
              disabled={resolve.isPending}
              maxLength={255}
            />
            <button type="submit" aria-label="Replay this wallet's year" disabled={!input.trim() || resolve.isPending}>
              ↗
            </button>
          </form>
          <p className="entry-status" role="status">
            {resolve.isPending
              ? 'Finding your wallet…'
              : (resolve.error?.message ?? 'Read only. No signature or transaction required.')}
          </p>
          <p className="entry-status">
            Wallet data is fetched on demand and temporarily cached by Yearn’s data services.
          </p>
        </div>
      </section>
      <Link className="demo-link" href="/?demo=1">
        Take a look at a demo <span aria-hidden="true">→</span>
      </Link>
    </main>
  )
}

function TypedGreeting({ text }: { text: string }) {
  const [length, setLength] = useState(0)
  // The browser timer drives the typing animation and is cleaned up when the slide unmounts.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setLength(text.length)
      return
    }
    const timer = window.setInterval(() => {
      setLength((current) => {
        if (current + 1 >= text.length) window.clearInterval(timer)
        return Math.min(current + 1, text.length)
      })
    }, 65)
    return () => window.clearInterval(timer)
  }, [text])
  return (
    <h1 className={`greeting ${text.length > 24 ? 'long-value' : ''}`} aria-label={text}>
      <span className="greeting-space" aria-hidden="true">
        {text}
      </span>
      <span aria-hidden="true">{text.slice(0, length)}</span>
    </h1>
  )
}

function Story({ payload, name, isDemo }: { payload: TWrapped; name?: string; isDemo: boolean }) {
  const cards = buildCards(payload, name, isDemo)
  const [active, setActive] = useState(0)
  const [announcement, setAnnouncement] = useState('')
  const [exporting, setExporting] = useState(false)
  const story = useRef<HTMLElement>(null)
  const gesture = useRef(initialScrollGesture)
  const touch = useRef({ x: 0, y: 0, canScrollUp: false, canScrollDown: false })
  const card = cards[active]!
  const previous = () => setActive((index) => Math.max(0, index - 1))
  const next = () => setActive((index) => Math.min(cards.length - 1, index + 1))
  // A non-passive native wheel listener can consume navigation gestures while
  // leaving nested card/chart scrolling and browser zoom to their native behavior.
  useEffect(() => {
    const root = story.current
    if (!root) return
    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? root.clientHeight : 1)
      if (canScrollWithin(event.target instanceof Element ? event.target : null, root, delta)) {
        gesture.current = initialScrollGesture
        return
      }
      event.preventDefault()
      if (exporting) return
      const result = advanceScrollGesture(gesture.current, delta, performance.now())
      gesture.current = result.gesture
      if (result.step) setActive((index) => Math.max(0, Math.min(cards.length - 1, index + result.step)))
    }
    root.addEventListener('wheel', handleWheel, { passive: false })
    return () => root.removeEventListener('wheel', handleWheel)
  }, [cards.length, exporting])
  // Keyboard navigation is a document event subscription, independent of data fetching.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLElement &&
        event.target.closest('input,summary,textarea,select,[contenteditable=true],[role=dialog]')
      )
        return
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault()
        setActive((index) => Math.min(cards.length - 1, index + 1))
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault()
        setActive((index) => Math.max(0, index - 1))
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [cards.length])
  const exportImage = async (action: 'save' | 'copy' | 'share') => {
    if (card.id === 'identity' || exporting) return
    setExporting(true)
    setAnnouncement('Preparing your image…')
    try {
      const blob = await renderCard(card, isDemo)
      const file = new File([blob], `yearn-wrapped-2026-${card.id}.png`, { type: 'image/png' })
      if (action === 'copy') {
        if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined')
          throw new Error('Image copying is unavailable. Use Save image instead.')
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        setAnnouncement('Image copied.')
      } else if (action === 'share') {
        if (!navigator.canShare?.({ files: [file] }))
          throw new Error('Image sharing is unavailable. Use Save image instead.')
        await navigator.share({ files: [file], title: 'Yearn Wrapped 2026' })
        setAnnouncement('Image shared.')
      } else {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = file.name
        link.click()
        setTimeout(() => URL.revokeObjectURL(url), 30_000)
        setAnnouncement('Image saved.')
      }
    } catch (error) {
      setAnnouncement(
        error instanceof Error && error.name === 'AbortError'
          ? 'Sharing cancelled.'
          : error instanceof Error
            ? error.message
            : 'The image could not be exported.'
      )
    } finally {
      setExporting(false)
    }
  }
  return (
    <main className="story" ref={story}>
      {!payload.coverage.isComplete && (
        <details className="coverage">
          <summary>Some data is incomplete</summary>
          {payload.coverage.issues.map((issue) => (
            <p key={issue}>{issue}</p>
          ))}
        </details>
      )}
      <div className="story-stage">
        <section
          key={card.id}
          className="slide-area"
          onTouchStart={(event) => {
            const target = event.target instanceof Element ? event.target : null
            touch.current = {
              x: event.touches[0]!.clientX,
              y: event.touches[0]!.clientY,
              canScrollUp: story.current ? canScrollWithin(target, story.current, -1) : false,
              canScrollDown: story.current ? canScrollWithin(target, story.current, 1) : false
            }
          }}
          onTouchEnd={(event) => {
            const dx = event.changedTouches[0]!.clientX - touch.current.x
            const dy = event.changedTouches[0]!.clientY - touch.current.y
            if (exporting) return
            if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) {
              if (dx < 0) next()
              else previous()
            } else if (Math.abs(dy) > 70 && Math.abs(dy) > Math.abs(dx) * 1.5) {
              if (dy < 0 && !touch.current.canScrollDown) next()
              else if (dy > 0 && !touch.current.canScrollUp) previous()
            }
          }}
        >
          <article key={card.id} className="slide" aria-label={`Card ${active + 1} of ${cards.length}`}>
            {card.id === 'identity' ? (
              <>
                <TypedGreeting text={card.value} />
                <p className="wallet-address">{payload.address}</p>
              </>
            ) : (
              <h1 className={card.value.length > 24 ? 'long-value' : ''}>{card.value}</h1>
            )}
            <p className="slide-line">{card.line}</p>
            {card.chart && <StoryChart points={card.chart} kind={card.chartKind ?? 'line'} />}
            {card.facts.length > 0 && (
              <dl className="facts">
                {card.facts.map((fact) => (
                  <div key={fact.label}>
                    <dd>{fact.value}</dd>
                    <dt>{fact.label}</dt>
                  </div>
                ))}
              </dl>
            )}
            {card.note && <p className="slide-note">{card.note}</p>}
          </article>
        </section>
        <nav className="dots" aria-label="Choose a card">
          {cards.map((item, index) => (
            <button
              key={item.id}
              type="button"
              aria-label={`Card ${index + 1}: ${item.title}`}
              aria-current={index === active ? 'step' : undefined}
              disabled={exporting}
              onClick={() => setActive(index)}
            >
              <span />
            </button>
          ))}
        </nav>
      </div>
      <footer className="story-controls">
        <div className="pagination">
          <button type="button" aria-label="Previous card" onClick={previous} disabled={active === 0 || exporting}>
            ↑
          </button>
          <span aria-live="polite">
            {isDemo ? 'Demo · ' : ''}
            {String(active + 1).padStart(2, '0')} / {cards.length}
          </span>
          <button
            type="button"
            aria-label="Next card"
            onClick={next}
            disabled={active === cards.length - 1 || exporting}
          >
            ↓
          </button>
        </div>
        <div className="export-actions">
          <button
            type="button"
            title="Save image"
            aria-label="Save image"
            disabled={active === 0 || exporting}
            onClick={() => void exportImage('save')}
          >
            ↓
          </button>
          <button
            type="button"
            title="Copy image"
            aria-label="Copy image"
            disabled={active === 0 || exporting}
            onClick={() => void exportImage('copy')}
          >
            ▣
          </button>
          <button
            type="button"
            title="Share image"
            aria-label="Share image"
            disabled={active === 0 || exporting}
            onClick={() => void exportImage('share')}
          >
            ↗
          </button>
        </div>
        <p className="export-status" role="status">
          {announcement}
        </p>
      </footer>
    </main>
  )
}

function Recap({ address, name }: { address: string; name?: string }) {
  const query = useQuery({
    queryKey: ['wrapped', address.toLowerCase(), 2026],
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/recap?address=${encodeURIComponent(address)}&year=2026`, {
        signal,
        cache: 'no-store'
      })
      const body = await response.json()
      if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'Your recap could not be loaded.')
      return parseWrapped(body)
    },
    retry: false,
    staleTime: 15 * 60_000,
    refetchOnWindowFocus: false
  })
  if (query.isPending)
    return (
      <main className="state">
        <div className="loader-symbol" aria-hidden="true">
          <Image src="/yearn-symbol-white-rgb.png" alt="" width={600} height={600} priority />
        </div>
        <h1>Finding your story.</h1>
        <p role="status">Reading your Yearn history and settled Growth Index.</p>
        <p className="muted">A first recap can take a few minutes.</p>
        <Link href="/">Back to address entry</Link>
      </main>
    )
  if (query.isError)
    return (
      <main className="state">
        <p className="eyebrow">YOUR STORY ISN’T LOST</p>
        <h1>Let’s try again.</h1>
        <p role="alert">{query.error.message}</p>
        <button type="button" className="primary" onClick={() => void query.refetch()}>
          Retry recap
        </button>
        <Link href="/">Try another wallet</Link>
      </main>
    )
  return <Story key={`${address}:${query.data.generatedAt}`} payload={query.data} name={name} isDemo={false} />
}

export function WrappedApp({ address, name, isDemo }: { address?: string; name?: string; isDemo: boolean }) {
  const theme = useThemePreference()
  const isLight = theme === 'light'
  return (
    <div className="wrapped-shell">
      <header className="topbar">
        <Link href="/" aria-label="Yearn Wrapped home">
          <Image src="/yearn-wrapped-lockup.svg" alt="Yearn Wrapped" width={194} height={24} priority />
        </Link>
        <div className="header-actions">
          <button
            type="button"
            className="theme-toggle"
            aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
            onClick={() => setThemePreference(isLight ? 'midnight' : 'light')}
          >
            <span aria-hidden="true">{isLight ? '☾' : '☀'}</span>
          </button>
          <a href="https://yearn.fi" target="_blank" rel="noreferrer">
            Yearn ↗
          </a>
        </div>
      </header>
      {isDemo ? (
        <Story payload={demo} isDemo />
      ) : address ? (
        <Recap key={address} address={address} name={name} />
      ) : (
        <Entry />
      )}
    </div>
  )
}
