import { useDarkMode } from '@shared/components/AllocationChart'
import { IconChevron } from '@shared/icons/IconChevron'
import { cl, formatPercent, SELECTOR_BAR_STYLES } from '@shared/utils'
import type { ReactElement, TouchEvent } from 'react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  buildColorByStrategyId,
  buildStateTransitionSankeyGraph,
  type TReallocationPanel,
  type TSankeyNode
} from '@/components/pages/vaults/utils/reallocations'

type TVaultRecentReallocationsSectionProps = {
  panels: TReallocationPanel[]
  isLoading: boolean
  hasError: boolean
}

type TRibbon = {
  id: string
  path: string
  sourceColor: string
  sourceId: string
  sourceName: string
  targetColor: string
  targetId: string
  targetName: string
  value: number
}

type THoverTarget =
  | {
      type: 'node'
      id: string
    }
  | {
      type: 'ribbon'
      id: string
    }
  | null

const VIEWBOX_WIDTH = 1000
const VIEWBOX_HEIGHT = 675
const NODE_WIDTH = 22
const BEFORE_NODE_X = 44
const AFTER_NODE_X = VIEWBOX_WIDTH - BEFORE_NODE_X - NODE_WIDTH
const CHART_TOP = 150
const CHART_BOTTOM = 50
const NODE_LABEL_PADDING = 20
const MAX_VISIBLE_PANELS = 3
const PANEL_WIDTH_PERCENT = 92
const PANEL_STEP_PERCENT = 82
const PANEL_TRANSITION_DURATION_MS = 300
const INCOMING_PANEL_EDGE_MASK_PERCENT = 12
const SWIPE_THRESHOLD_PX = 40

const timestampFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'UTC'
})

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function getWindowStart(activePanelIndex: number, panelCount: number): number {
  if (panelCount <= MAX_VISIBLE_PANELS) {
    return 0
  }

  return clamp(activePanelIndex - 1, 0, panelCount - MAX_VISIBLE_PANELS)
}

function formatPanelTimestamp(timestamp: string | null): string {
  if (!timestamp) {
    return 'Timestamp unavailable'
  }

  const parsedDate = new Date(timestamp.replace(' UTC', 'Z').replace(' ', 'T'))
  if (Number.isNaN(parsedDate.getTime())) {
    return timestamp
  }

  return `${timestampFormatter.format(parsedDate)} UTC`
}

function getReallocationTypeLabel(panel: TReallocationPanel): string | null {
  return panel.reallocationType === 'automatic'
    ? 'Automatic reallocation'
    : panel.reallocationType === 'manual'
      ? 'Manual reallocation'
      : null
}

function toSvgSafeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-')
}

function withAlpha(color: string, alpha: number): string {
  if (!color.startsWith('#')) {
    return color
  }

  const normalized = color.slice(1)
  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map((value) => `${value}${value}`)
          .join('')
      : normalized
  const [red, green, blue] = expanded.match(/.{1,2}/g)?.map((value) => Number.parseInt(value, 16)) ?? [156, 163, 175]

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function buildRibbonPath({
  sourceLeft,
  sourceTop,
  sourceBottom,
  targetLeft,
  targetTop,
  targetBottom
}: {
  sourceLeft: number
  sourceTop: number
  sourceBottom: number
  targetLeft: number
  targetTop: number
  targetBottom: number
}): string {
  const sourceRight = sourceLeft + NODE_WIDTH
  const curveDelta = (targetLeft - sourceRight) * 0.42
  const sourceControlX = sourceRight + curveDelta
  const targetControlX = targetLeft - curveDelta

  return [
    `M ${sourceRight} ${sourceTop}`,
    `C ${sourceControlX} ${sourceTop}, ${targetControlX} ${targetTop}, ${targetLeft} ${targetTop}`,
    `L ${targetLeft} ${targetBottom}`,
    `C ${targetControlX} ${targetBottom}, ${sourceControlX} ${sourceBottom}, ${sourceRight} ${sourceBottom}`,
    'Z'
  ].join(' ')
}

function SankeyNodeLabel({
  node,
  textColor,
  mutedTextColor,
  backgroundStrokeColor,
  fontSize = 18,
  lineHeight = 22,
  strokeWidth = 5
}: {
  node: TSankeyNode
  textColor: string
  mutedTextColor: string
  backgroundStrokeColor: string
  fontSize?: number
  lineHeight?: number
  strokeWidth?: number
}): ReactElement {
  const chartHeight = VIEWBOX_HEIGHT - CHART_TOP - CHART_BOTTOM
  const centerY = CHART_TOP + (node.localY + node.heightRatio / 2) * chartHeight
  const labelLines = [...node.labelText.split('\n'), formatPercent(node.value, 1, 1)]
  const x = node.side === 'before' ? BEFORE_NODE_X + NODE_WIDTH + NODE_LABEL_PADDING : AFTER_NODE_X - NODE_LABEL_PADDING
  const textAnchor = node.side === 'before' ? 'start' : 'end'
  const startY = centerY - ((labelLines.length - 1) * lineHeight) / 2

  return (
    <text
      x={x}
      y={startY}
      textAnchor={textAnchor}
      fontSize={fontSize}
      fill={textColor}
      stroke={backgroundStrokeColor}
      strokeWidth={strokeWidth}
      paintOrder="stroke"
    >
      {labelLines.map((line, index) => (
        <tspan
          key={`${node.id}-${line}`}
          x={x}
          dy={index === 0 ? 0 : lineHeight}
          fill={index === labelLines.length - 1 ? mutedTextColor : textColor}
          fontWeight={index === labelLines.length - 1 ? 500 : 600}
        >
          {line}
        </tspan>
      ))}
      <title>{`${node.displayName} • ${formatPercent(node.value, 2, 2)}`}</title>
    </text>
  )
}

function ReallocationSankeyChart({
  panel,
  colorByStrategyId,
  isDark,
  isActive
}: {
  panel: TReallocationPanel
  colorByStrategyId: Map<string, string>
  isDark: boolean
  isActive: boolean
}): ReactElement {
  const graph = useMemo(() => {
    return buildStateTransitionSankeyGraph(panel.beforeState.strategies, panel.afterState.strategies)
  }, [panel.afterState.strategies, panel.beforeState.strategies])
  const [hoverTarget, setHoverTarget] = useState<THoverTarget>(null)
  const gradientPrefix = useId().replace(/:/g, '-')

  const nodeById = useMemo(() => {
    return new Map(graph.nodes.map((node) => [node.id, node]))
  }, [graph.nodes])

  const chartHeight = VIEWBOX_HEIGHT - CHART_TOP - CHART_BOTTOM
  const textColor = isDark ? '#f9fafb' : '#111827'
  const mutedTextColor = isDark ? '#9ca3af' : '#6b7280'
  const borderColor = isDark ? '#111827' : '#e5e7eb'
  const backgroundStrokeColor = isDark ? 'rgba(17, 24, 39, 0.78)' : 'rgba(248, 250, 252, 0.9)'
  const ribbons = useMemo(() => {
    return graph.links.reduce(
      (state, link) => {
        const sourceNode = nodeById.get(link.source)
        const targetNode = nodeById.get(link.target)
        if (!sourceNode || !targetNode || sourceNode.value <= 0 || targetNode.value <= 0) {
          return state
        }

        const sourceOffsetRatio = state.sourceOffsets.get(link.source) ?? 0
        const targetOffsetRatio = state.targetOffsets.get(link.target) ?? 0
        const sourceScale = sourceNode.heightRatio / sourceNode.value
        const targetScale = targetNode.heightRatio / targetNode.value
        const sourceHeightRatio = link.value * sourceScale
        const targetHeightRatio = link.value * targetScale
        const nextSourceOffsets = new Map(state.sourceOffsets)
        nextSourceOffsets.set(link.source, sourceOffsetRatio + sourceHeightRatio)
        const nextTargetOffsets = new Map(state.targetOffsets)
        nextTargetOffsets.set(link.target, targetOffsetRatio + targetHeightRatio)

        const sourceColor = colorByStrategyId.get(sourceNode.id.replace('before:', '')) ?? '#9ca3af'
        const targetColor = colorByStrategyId.get(targetNode.id.replace('after:', '')) ?? '#9ca3af'

        return {
          sourceOffsets: nextSourceOffsets,
          targetOffsets: nextTargetOffsets,
          ribbons: [
            ...state.ribbons,
            {
              path: buildRibbonPath({
                sourceLeft: BEFORE_NODE_X,
                sourceTop: CHART_TOP + (sourceNode.localY + sourceOffsetRatio) * chartHeight,
                sourceBottom: CHART_TOP + (sourceNode.localY + sourceOffsetRatio + sourceHeightRatio) * chartHeight,
                targetLeft: AFTER_NODE_X,
                targetTop: CHART_TOP + (targetNode.localY + targetOffsetRatio) * chartHeight,
                targetBottom: CHART_TOP + (targetNode.localY + targetOffsetRatio + targetHeightRatio) * chartHeight
              }),
              id: `${link.source}->${link.target}`,
              sourceColor,
              sourceName: sourceNode.displayName,
              sourceId: sourceNode.id,
              targetColor,
              targetId: targetNode.id,
              targetName: targetNode.displayName,
              value: link.value
            }
          ]
        }
      },
      {
        sourceOffsets: new Map<string, number>(),
        targetOffsets: new Map<string, number>(),
        ribbons: [] as TRibbon[]
      }
    ).ribbons
  }, [chartHeight, colorByStrategyId, graph.links, nodeById])
  const hoverState = useMemo(() => {
    if (!isActive || !hoverTarget) {
      return null
    }

    const focusedRibbonIds = new Set<string>()
    const focusedNodeIds = new Set<string>()

    if (hoverTarget.type === 'node') {
      focusedNodeIds.add(hoverTarget.id)

      ribbons.forEach((ribbon) => {
        if (ribbon.sourceId === hoverTarget.id || ribbon.targetId === hoverTarget.id) {
          focusedRibbonIds.add(ribbon.id)
          focusedNodeIds.add(ribbon.sourceId)
          focusedNodeIds.add(ribbon.targetId)
        }
      })
    } else {
      const focusedRibbon = ribbons.find((ribbon) => ribbon.id === hoverTarget.id)
      if (focusedRibbon) {
        focusedRibbonIds.add(focusedRibbon.id)
        focusedNodeIds.add(focusedRibbon.sourceId)
        focusedNodeIds.add(focusedRibbon.targetId)
      }
    }

    return {
      focusedRibbonIds,
      focusedNodeIds
    }
  }, [hoverTarget, isActive, ribbons])
  const visibleRibbons = useMemo(() => {
    if (!hoverState) {
      return ribbons
    }

    return [...ribbons].sort((firstRibbon, secondRibbon) => {
      const firstIsFocused = hoverState.focusedRibbonIds.has(firstRibbon.id)
      const secondIsFocused = hoverState.focusedRibbonIds.has(secondRibbon.id)
      return Number(firstIsFocused) - Number(secondIsFocused)
    })
  }, [hoverState, ribbons])
  const gradientIdByRibbonId = useMemo(() => {
    return new Map(ribbons.map((ribbon) => [ribbon.id, `${gradientPrefix}-${toSvgSafeId(ribbon.id)}`]))
  }, [gradientPrefix, ribbons])

  useEffect(() => {
    if (!isActive) {
      setHoverTarget(null)
    }
  }, [isActive, panel.id])

  if (graph.nodes.length === 0 || ribbons.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-text-secondary">
        {'No allocation flow data available.'}
      </div>
    )
  }

  const beforeHeading = panel.kind === 'proposal' ? 'Current' : panel.kind === 'current' ? 'Last Seen' : 'Before'
  const afterHeading = panel.kind === 'proposal' ? 'Proposed' : panel.kind === 'current' ? 'Current' : 'After'

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      className="h-full w-full"
      role="img"
      aria-label="Recent reallocation sankey chart"
      onMouseLeave={() => setHoverTarget(null)}
    >
      {isActive ? (
        <>
          <text x={44} y={42} fontSize={18} fontWeight={700} fill={textColor}>
            {beforeHeading}
          </text>
          <text x={44} y={68} fontSize={16} fill={mutedTextColor}>
            {formatPanelTimestamp(panel.beforeTimestampUtc)}
          </text>
          <text x={VIEWBOX_WIDTH - 44} y={42} textAnchor="end" fontSize={18} fontWeight={700} fill={textColor}>
            {afterHeading}
          </text>
          <text x={VIEWBOX_WIDTH - 44} y={68} textAnchor="end" fontSize={16} fill={mutedTextColor}>
            {formatPanelTimestamp(panel.afterTimestampUtc)}
          </text>
        </>
      ) : null}

      <defs>
        {ribbons.map((ribbon) => {
          const gradientId = gradientIdByRibbonId.get(ribbon.id)
          if (!gradientId) {
            return null
          }

          return (
            <linearGradient
              key={gradientId}
              id={gradientId}
              gradientUnits="userSpaceOnUse"
              x1={BEFORE_NODE_X + NODE_WIDTH}
              y1={0}
              x2={AFTER_NODE_X}
              y2={0}
            >
              <stop offset="0%" stopColor={ribbon.sourceColor} />
              <stop offset="100%" stopColor={ribbon.targetColor} />
            </linearGradient>
          )
        })}
      </defs>

      {visibleRibbons.map((ribbon) => {
        const isRibbonFocused = hoverState?.focusedRibbonIds.has(ribbon.id) ?? false
        const hasHover = Boolean(hoverState)
        const fillOpacity = isActive ? (isDark ? 0.34 : 0.22) : isDark ? 0.22 : 0.14
        const strokeOpacity = isActive ? (isDark ? 0.5 : 0.34) : isDark ? 0.34 : 0.2
        const isHoveredRibbon = hoverTarget?.type === 'ribbon' && hoverTarget.id === ribbon.id
        const gradientId = gradientIdByRibbonId.get(ribbon.id)

        return (
          <path
            key={ribbon.id}
            d={ribbon.path}
            onMouseEnter={() => {
              if (isActive) {
                setHoverTarget({ type: 'ribbon', id: ribbon.id })
              }
            }}
            onMouseLeave={() => {
              setHoverTarget((currentHoverTarget) =>
                currentHoverTarget?.type === 'ribbon' && currentHoverTarget.id === ribbon.id ? null : currentHoverTarget
              )
            }}
            fill={gradientId ? `url(#${gradientId})` : ribbon.sourceColor}
            stroke={gradientId ? `url(#${gradientId})` : ribbon.sourceColor}
            strokeWidth={1}
            style={{
              cursor: isActive ? 'pointer' : 'default',
              fillOpacity: hasHover
                ? isRibbonFocused
                  ? fillOpacity + (isHoveredRibbon ? 0.16 : 0.1)
                  : fillOpacity * 0.3
                : fillOpacity,
              strokeOpacity: hasHover
                ? isRibbonFocused
                  ? strokeOpacity + (isHoveredRibbon ? 0.2 : 0.12)
                  : strokeOpacity * 0.3
                : strokeOpacity,
              opacity: hasHover ? (isRibbonFocused ? (isHoveredRibbon ? 1 : 0.92) : 0.16) : 1,
              transition: 'opacity 180ms ease, fill-opacity 180ms ease, stroke-opacity 180ms ease'
            }}
          >
            <title>{`${ribbon.sourceName} → ${ribbon.targetName} • ${formatPercent(ribbon.value, 2, 2)}`}</title>
          </path>
        )
      })}

      {graph.nodes.map((node) => {
        const color = colorByStrategyId.get(node.id.replace(`${node.side}:`, '')) ?? '#9ca3af'
        const x = node.side === 'before' ? BEFORE_NODE_X : AFTER_NODE_X
        const y = CHART_TOP + node.localY * chartHeight
        const height = node.heightRatio * chartHeight
        const hasHover = Boolean(hoverState)
        const isHoveredNode = hoverTarget?.type === 'node' && hoverTarget.id === node.id
        const isFocusedNode = hoverState?.focusedNodeIds.has(node.id) ?? false
        const nodeOpacity = hasHover ? (isFocusedNode ? (isHoveredNode ? 1 : 0.94) : 0.16) : 1
        const labelOpacity = hasHover ? (isFocusedNode ? (isHoveredNode ? 1 : 0.9) : 0.14) : 1
        const labelScale = hasHover ? (isHoveredNode ? 1.18 : isFocusedNode ? 1.08 : 1) : 1
        const labelFontSize = 18 * labelScale
        const labelLineHeight = 22 * labelScale
        const labelStrokeWidth = 5 * (1 + (labelScale - 1) * 0.85)
        const nodeStrokeColor = isHoveredNode ? withAlpha(textColor, isDark ? 0.92 : 0.72) : borderColor
        const nodeStrokeWidth = isHoveredNode ? 2 : 1

        return (
          <g
            key={node.id}
            onMouseEnter={() => {
              if (isActive) {
                setHoverTarget({ type: 'node', id: node.id })
              }
            }}
            onMouseLeave={() => {
              setHoverTarget((currentHoverTarget) =>
                currentHoverTarget?.type === 'node' && currentHoverTarget.id === node.id ? null : currentHoverTarget
              )
            }}
            style={{
              cursor: isActive ? 'pointer' : 'default',
              opacity: nodeOpacity,
              transition: 'opacity 180ms ease'
            }}
          >
            <rect
              x={x}
              y={y}
              width={NODE_WIDTH}
              height={height}
              fill={color}
              stroke={nodeStrokeColor}
              strokeWidth={nodeStrokeWidth}
              style={{
                transition: 'stroke 180ms ease, stroke-width 180ms ease'
              }}
            >
              <title>{`${node.displayName} • ${formatPercent(node.value, 2, 2)}`}</title>
            </rect>
            {isActive ? (
              <g
                style={{
                  opacity: labelOpacity,
                  transition: 'opacity 180ms ease'
                }}
              >
                <SankeyNodeLabel
                  node={node}
                  textColor={textColor}
                  mutedTextColor={mutedTextColor}
                  backgroundStrokeColor={backgroundStrokeColor}
                  fontSize={labelFontSize}
                  lineHeight={labelLineHeight}
                  strokeWidth={labelStrokeWidth}
                />
              </g>
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}

function LoadingState(): ReactElement {
  return (
    <div className="border-t border-border bg-surface-secondary">
      <div className="h-[440px] w-full animate-pulse bg-surface-secondary md:h-[620px]" />
    </div>
  )
}

function ErrorState(): ReactElement {
  return (
    <div className="border-t border-border bg-surface-secondary px-4 py-6 text-sm text-text-secondary md:px-6">
      {'Recent reallocation data is temporarily unavailable.'}
    </div>
  )
}

function TimelineControls({
  activePanel,
  activeIndex,
  panelCount,
  onOlder,
  onNewer
}: {
  activePanel: TReallocationPanel
  activeIndex: number
  panelCount: number
  onOlder: () => void
  onNewer: () => void
}): ReactElement | null {
  if (panelCount <= 1) {
    return null
  }

  const reallocationTypeLabel = getReallocationTypeLabel(activePanel)

  return (
    <div className="pointer-events-none absolute inset-x-0 top-4 z-20 flex justify-center px-4">
      <div className="flex flex-col items-center gap-2">
        <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-border bg-surface/90 p-1 shadow-sm backdrop-blur">
          <span className="px-2 text-xs tabular-nums text-text-tertiary">{`${activeIndex + 1} / ${panelCount}`}</span>
          <div className={cl('flex items-center gap-1', SELECTOR_BAR_STYLES.container)}>
            <button
              type="button"
              onClick={onOlder}
              disabled={activeIndex === 0}
              className={cl(
                'inline-flex min-h-[34px] items-center gap-1 rounded-sm border px-3 py-2 text-xs font-semibold transition-all md:min-h-0 md:py-1',
                SELECTOR_BAR_STYLES.buttonBase,
                activeIndex === 0
                  ? 'cursor-not-allowed border-transparent text-text-tertiary opacity-50'
                  : SELECTOR_BAR_STYLES.buttonInactive
              )}
            >
              <IconChevron direction="left" className="size-3" />
              {'Older'}
            </button>
            <button
              type="button"
              onClick={onNewer}
              disabled={activeIndex >= panelCount - 1}
              className={cl(
                'inline-flex min-h-[34px] items-center gap-1 rounded-sm border px-3 py-2 text-xs font-semibold transition-all md:min-h-0 md:py-1',
                SELECTOR_BAR_STYLES.buttonBase,
                activeIndex >= panelCount - 1
                  ? 'cursor-not-allowed border-transparent text-text-tertiary opacity-50'
                  : SELECTOR_BAR_STYLES.buttonInactive
              )}
            >
              {'Newer'}
              <IconChevron direction="right" className="size-3" />
            </button>
          </div>
        </div>

        {reallocationTypeLabel ? (
          <div className="text-center text-xs font-semibold text-text-secondary">
            <span>{reallocationTypeLabel}</span>
            <span className="ml-1" aria-hidden="true">
              {activePanel.reallocationType === 'automatic' ? '🤖' : '👷'}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function Timeline({ panels, isDark }: { panels: TReallocationPanel[]; isDark: boolean }): ReactElement {
  const [activePanelIndex, setActivePanelIndex] = useState(Math.max(panels.length - 1, 0))
  const [animationState, setAnimationState] = useState<{
    fromIndex: number
    toIndex: number
    windowStart: number
  } | null>(null)
  const [isIncomingPanelRevealActive, setIsIncomingPanelRevealActive] = useState(false)
  const touchStartXRef = useRef<number | null>(null)
  const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const latestPanelId = panels[panels.length - 1]?.id ?? 'empty'
  const colorByStrategyId = useMemo(() => buildColorByStrategyId(panels, isDark), [isDark, panels])

  useEffect(() => {
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current)
      animationTimeoutRef.current = null
    }
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    setAnimationState(null)
    setIsIncomingPanelRevealActive(false)
    setActivePanelIndex(Math.max(panels.length - 1, 0))
  }, [latestPanelId, panels.length])

  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current)
      }
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  const activeIndex = clamp(activePanelIndex, 0, Math.max(0, panels.length - 1))
  // Keep the existing 3-panel window mounted while the slide runs. Swapping the
  // window immediately causes a fresh edge preview panel to pop in mid-transition.
  const windowStart = animationState?.windowStart ?? getWindowStart(activeIndex, panels.length)
  const windowPanels = panels.slice(windowStart, windowStart + MAX_VISIBLE_PANELS)
  const activeWindowIndex = (animationState?.toIndex ?? activeIndex) - windowStart

  const transitionToPanel = (nextIndex: number): void => {
    const clampedNextIndex = clamp(nextIndex, 0, Math.max(0, panels.length - 1))
    if (clampedNextIndex === activeIndex) {
      return
    }

    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current)
    }
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    setIsIncomingPanelRevealActive(false)
    setAnimationState({
      fromIndex: activeIndex,
      toIndex: clampedNextIndex,
      windowStart: getWindowStart(activeIndex, panels.length)
    })
    setActivePanelIndex(clampedNextIndex)
    animationFrameRef.current = requestAnimationFrame(() => {
      animationFrameRef.current = requestAnimationFrame(() => {
        setIsIncomingPanelRevealActive(true)
        animationFrameRef.current = null
      })
    })
    animationTimeoutRef.current = setTimeout(() => {
      setAnimationState(null)
      setIsIncomingPanelRevealActive(false)
      animationTimeoutRef.current = null
    }, PANEL_TRANSITION_DURATION_MS)
  }

  const goOlder = (): void => {
    transitionToPanel(activeIndex - 1)
  }

  const goNewer = (): void => {
    transitionToPanel(activeIndex + 1)
  }

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>): void => {
    touchStartXRef.current = event.touches[0]?.clientX ?? null
  }

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>): void => {
    if (touchStartXRef.current === null) {
      return
    }

    const touchEndX = event.changedTouches[0]?.clientX ?? touchStartXRef.current
    const deltaX = touchEndX - touchStartXRef.current
    touchStartXRef.current = null

    if (deltaX <= -SWIPE_THRESHOLD_PX) {
      goNewer()
      return
    }

    if (deltaX >= SWIPE_THRESHOLD_PX) {
      goOlder()
    }
  }

  if (panels.length === 0) {
    return <div className="hidden" />
  }

  return (
    <div className="bg-surface-primary" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="relative h-[440px] w-full overflow-hidden md:h-[500px]">
        <TimelineControls
          activePanel={panels[activeIndex]!}
          activeIndex={activeIndex}
          panelCount={panels.length}
          onOlder={goOlder}
          onNewer={goNewer}
        />

        {windowPanels.map((panel, windowIndex) => {
          const panelIndex = windowStart + windowIndex
          const isActive = panelIndex === activeIndex
          const offsetFromActive = windowIndex - activeWindowIndex
          const leftPercent =
            panels.length === 1 ? 0 : 50 - PANEL_WIDTH_PERCENT / 2 + offsetFromActive * PANEL_STEP_PERCENT
          const zIndex = animationState
            ? panelIndex === animationState.fromIndex
              ? 3
              : panelIndex === animationState.toIndex
                ? 2
                : 1
            : isActive
              ? 2
              : 1
          const opacity = animationState
            ? panelIndex === animationState.fromIndex || panelIndex === animationState.toIndex
              ? 1
              : 0.72
            : isActive
              ? 1
              : 0.72
          const isIncomingPanel = panelIndex === animationState?.toIndex
          const incomingMaskEdge =
            animationState && isIncomingPanel
              ? animationState.toIndex > animationState.fromIndex
                ? 'left'
                : 'right'
              : null

          return (
            <div
              key={panel.id}
              className="absolute top-0 h-full overflow-hidden bg-surface-primary transition-[left,opacity] duration-300 ease-out"
              style={{
                width: panels.length === 1 ? '100%' : `${PANEL_WIDTH_PERCENT}%`,
                left: `${leftPercent}%`,
                opacity,
                zIndex
              }}
            >
              <ReallocationSankeyChart
                panel={panel}
                colorByStrategyId={colorByStrategyId}
                isDark={isDark}
                isActive={isActive}
              />
              {incomingMaskEdge ? (
                <div
                  className={cl(
                    'pointer-events-none absolute inset-y-0 z-10 bg-surface-primary transition-[width] duration-300 ease-out',
                    incomingMaskEdge === 'left' ? 'left-0' : 'right-0'
                  )}
                  style={{
                    width: isIncomingPanelRevealActive ? '0%' : `${INCOMING_PANEL_EDGE_MASK_PERCENT}%`
                  }}
                />
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function VaultRecentReallocationsSection({
  panels,
  isLoading,
  hasError
}: TVaultRecentReallocationsSectionProps): ReactElement {
  const isDark = useDarkMode()

  if (isLoading && panels.length === 0) {
    return <LoadingState />
  }

  if (hasError && panels.length === 0) {
    return <ErrorState />
  }

  if (panels.length === 0) {
    return <div className="hidden" />
  }

  return <Timeline panels={panels} isDark={isDark} />
}
