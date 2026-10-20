import { useEffect, useRef } from 'react'

type TPointer = { x: number; y: number }
const LANES = [0, 1, 2]

function streamPath(lane: number): string {
  return Array.from({ length: 101 }, (_, index) => {
    const x = index * 10
    const progress = Math.min(1, Math.max(0, (x - 140) / 90))
    const split = progress * progress * (3 - 2 * progress)
    const y = 34 + (lane - 1) * 20 * split
    return `${index === 0 ? 'M' : 'L'}${x},${y}`
  }).join(' ')
}

export function HeaderStreams() {
  const svgRef = useRef<SVGSVGElement>(null)

  // Native pointer listeners update the decorative SVG without rerendering the header.
  useEffect(() => {
    const svg = svgRef.current
    const header = svg?.closest('#head')
    if (!svg || !header) return
    const motion = window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)')
    // Cursor motion deflects the rendered geometry, never rebuilds the lane layout.
    const streams = Array.from(svg.querySelectorAll('path')).map((path) => {
      const length = path.getTotalLength()
      const points = Array.from({ length: 101 }, (_, index) => path.getPointAtLength((length * index) / 100))
      return { path, points, initialPath: path.getAttribute('d') ?? '' }
    })
    const animation = { frame: 0, pointer: undefined as TPointer | undefined }
    const draw = (pointer: TPointer, strength = 1) => {
      streams.forEach(({ path, points }) => {
        const d = points
          .map(({ x, y }, index) => {
            const distance = y - pointer.y
            const bend =
              Math.exp(-(((x - pointer.x) / 110) ** 2)) *
              Math.max(0, 1 - Math.abs(distance) / 50) *
              Math.tanh(distance / 8) *
              12
            return `${index === 0 ? 'M' : 'L'}${x},${y + bend * strength}`
          })
          .join(' ')
        path.setAttribute('d', d)
      })
    }
    const onPointerMove = (event: Event) => {
      if (!(event instanceof PointerEvent) || event.pointerType !== 'mouse' || !motion.matches) return
      const bounds = header.getBoundingClientRect()
      window.cancelAnimationFrame(animation.frame)
      const pointer = { x: 1000 - ((event.clientX - bounds.left) / bounds.width) * 1000, y: event.clientY - bounds.top }
      animation.pointer = pointer
      draw(pointer)
    }
    const onPointerLeave = () => {
      window.cancelAnimationFrame(animation.frame)
      const pointer = animation.pointer
      if (!pointer) return
      const startedAt = performance.now()
      const settle = (now: number) => {
        const progress = motion.matches ? Math.min(1, (now - startedAt) / 300) : 1
        draw(pointer, (1 - progress) ** 3)
        if (progress < 1) {
          animation.frame = window.requestAnimationFrame(settle)
        } else {
          streams.forEach(({ path, initialPath }) => {
            path.setAttribute('d', initialPath)
          })
        }
      }
      animation.frame = window.requestAnimationFrame(settle)
    }
    header.addEventListener('pointermove', onPointerMove)
    header.addEventListener('pointerleave', onPointerLeave)
    return () => {
      window.cancelAnimationFrame(animation.frame)
      header.removeEventListener('pointermove', onPointerMove)
      header.removeEventListener('pointerleave', onPointerLeave)
    }
  }, [])

  return (
    <svg
      ref={svgRef}
      className="earn-header-streams"
      viewBox="0 0 1000 68"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {LANES.map((lane) => (
        <path key={lane} d={streamPath(lane)} />
      ))}
    </svg>
  )
}
