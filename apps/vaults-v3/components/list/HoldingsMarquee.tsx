import { toAddress } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import type { ReactElement } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'

import HoldingsPill from './HoldingsPill'

function HoldingsMarquee({ holdingsVaults }: { holdingsVaults: TYDaemonVault[] }): ReactElement | null {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const cloneRef = useRef<HTMLDivElement | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const [shouldScroll, setShouldScroll] = useState(false)
  const holdingsSignature = useMemo(
    () => holdingsVaults.map((vault) => `${vault.chainID}-${toAddress(vault.address)}`).join('|'),
    [holdingsVaults]
  )

  useEffect(() => {
    const container = containerRef.current
    const content = contentRef.current
    if (!container || !content) {
      return
    }

    if (holdingsSignature.length === 0) {
      setShouldScroll(false)
    }

    const update = (): void => {
      if (!container || !content) {
        return
      }
      setShouldScroll(content.scrollWidth > container.clientWidth)
      const measuredHeight = content.getBoundingClientRect().height
      if (measuredHeight) {
        container.style.height = `${measuredHeight}px`
      }
    }

    update()

    if (typeof ResizeObserver !== 'undefined') {
      const resizeObserver = new ResizeObserver(update)
      resizeObserver.observe(container)
      resizeObserver.observe(content)
      return () => {
        resizeObserver.disconnect()
      }
    }

    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('resize', update)
    }
  }, [holdingsSignature])

  useEffect(() => {
    const container = containerRef.current
    const content = contentRef.current

    if (!shouldScroll || !container || !content || holdingsSignature.length === 0) {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      if (content) content.style.transform = ''
      if (cloneRef.current) {
        cloneRef.current.remove()
        cloneRef.current = null
      }
      return
    }

    if (cloneRef.current) {
      cloneRef.current.remove()
      cloneRef.current = null
    }

    const clone = content.cloneNode(true) as HTMLDivElement
    clone.setAttribute('aria-hidden', 'true')
    clone.style.pointerEvents = 'none'
    clone.style.position = 'absolute'
    clone.style.top = '0'
    clone.style.left = '0'
    clone.style.willChange = 'transform'
    clone.style.paddingLeft = '0.5rem'
    container.appendChild(clone)
    cloneRef.current = clone

    let startTimestamp: number | null = null
    const speed = 20

    const step = (timestamp: number): void => {
      if (startTimestamp === null) {
        startTimestamp = timestamp
      }

      const elapsed = timestamp - startTimestamp
      const width = content.scrollWidth
      if (width === 0) {
        animationFrameRef.current = requestAnimationFrame(step)
        return
      }

      const offset = ((elapsed / 1000) * speed) % width
      content.style.transform = `translateX(${-offset}px)`
      clone.style.transform = `translateX(${width - offset}px)`
      animationFrameRef.current = requestAnimationFrame(step)
    }

    animationFrameRef.current = requestAnimationFrame(step)

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      content.style.transform = ''
      if (cloneRef.current) {
        cloneRef.current.remove()
        cloneRef.current = null
      }
    }
  }, [shouldScroll, holdingsSignature])

  if (holdingsVaults.length === 0) {
    return null
  }

  return (
    <button
      type={'button'}
      aria-label={'View portfolio'}
      onClick={(): void => {}}
      className={'group relative flex w-full overflow-hidden border border-transparent bg-transparent p-0 text-left'}
    >
      <div
        ref={containerRef}
        className={'relative h-12 w-full overflow-hidden transition-opacity duration-200 group-hover:opacity-40'}
      >
        <div
          ref={contentRef}
          className={'absolute left-0 top-0 flex h-full flex-nowrap items-center gap-2'}
          style={{ willChange: shouldScroll ? 'transform' : undefined }}
        >
          {holdingsVaults.map((vault) => (
            <HoldingsPill key={`holdings-pill-${vault.chainID}-${toAddress(vault.address)}`} vault={vault} />
          ))}
        </div>
      </div>
      <div
        className={
          'pointer-events-none absolute inset-0 flex items-center justify-center bg-surface-secondary/50 border-1 border-neutral-700/50 text-sm font-semibold uppercase tracking-wide text-text-primary opacity-0 transition-opacity duration-200 group-hover:opacity-100'
        }
      >
        {'view portfolio'}
      </div>
    </button>
  )
}

export default HoldingsMarquee
