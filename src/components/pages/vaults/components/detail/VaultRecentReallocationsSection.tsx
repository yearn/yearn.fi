import { useDarkMode } from '@shared/components/AllocationChart'
import { IconChevron } from '@shared/icons/IconChevron'
import { cl, formatPercent, SELECTOR_BAR_STYLES } from '@shared/utils'
import type { ReactElement, TouchEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
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
  color: string
  path: string
  sourceName: string
  targetName: string
  value: number
}

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
  backgroundStrokeColor
}: {
  node: TSankeyNode
  textColor: string
  mutedTextColor: string
  backgroundStrokeColor: string
}): ReactElement {
  const chartHeight = VIEWBOX_HEIGHT - CHART_TOP - CHART_BOTTOM
  const centerY = CHART_TOP + (node.localY + node.heightRatio / 2) * chartHeight
  const labelLines = [...node.labelText.split('\n'), formatPercent(node.value, 1, 1)]
  const x = node.side === 'before' ? BEFORE_NODE_X + NODE_WIDTH + NODE_LABEL_PADDING : AFTER_NODE_X - NODE_LABEL_PADDING
  const textAnchor = node.side === 'before' ? 'start' : 'end'
  const lineHeight = 22
  const startY = centerY - ((labelLines.length - 1) * lineHeight) / 2

  return (
    <text
      x={x}
      y={startY}
      textAnchor={textAnchor}
      fontSize={18}
      fill={textColor}
      stroke={backgroundStrokeColor}
      strokeWidth={5}
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

        const color =
          colorByStrategyId.get(sourceNode.id.replace('before:', '')) ??
          colorByStrategyId.get(targetNode.id.replace('after:', '')) ??
          '#9ca3af'

        return {
          sourceOffsets: nextSourceOffsets,
          targetOffsets: nextTargetOffsets,
          ribbons: [
            ...state.ribbons,
            {
              color,
              path: buildRibbonPath({
                sourceLeft: BEFORE_NODE_X,
                sourceTop: CHART_TOP + (sourceNode.localY + sourceOffsetRatio) * chartHeight,
                sourceBottom: CHART_TOP + (sourceNode.localY + sourceOffsetRatio + sourceHeightRatio) * chartHeight,
                targetLeft: AFTER_NODE_X,
                targetTop: CHART_TOP + (targetNode.localY + targetOffsetRatio) * chartHeight,
                targetBottom: CHART_TOP + (targetNode.localY + targetOffsetRatio + targetHeightRatio) * chartHeight
              }),
              sourceName: sourceNode.displayName,
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

  if (graph.nodes.length === 0 || ribbons.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-text-secondary">
        {'No allocation flow data available.'}
      </div>
    )
  }

  const beforeHeading = panel.kind === 'proposal' ? 'Current' : 'Before'
  const afterHeading = panel.kind === 'proposal' ? 'Proposed' : 'After'

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      className="h-full w-full"
      role="img"
      aria-label="Recent reallocation sankey chart"
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

      {ribbons.map((ribbon) => (
        <path
          key={`${ribbon.path}-${ribbon.value}`}
          d={ribbon.path}
          fill={withAlpha(ribbon.color, isActive ? (isDark ? 0.34 : 0.22) : isDark ? 0.22 : 0.14)}
          stroke={withAlpha(ribbon.color, isActive ? (isDark ? 0.5 : 0.34) : isDark ? 0.34 : 0.2)}
          strokeWidth={1}
        >
          <title>{`${ribbon.sourceName} → ${ribbon.targetName} • ${formatPercent(ribbon.value, 2, 2)}`}</title>
        </path>
      ))}

      {graph.nodes.map((node) => {
        const color = colorByStrategyId.get(node.id.replace(`${node.side}:`, '')) ?? '#9ca3af'
        const x = node.side === 'before' ? BEFORE_NODE_X : AFTER_NODE_X
        const y = CHART_TOP + node.localY * chartHeight
        const height = node.heightRatio * chartHeight

        return (
          <g key={node.id}>
            <rect x={x} y={y} width={NODE_WIDTH} height={height} fill={color} stroke={borderColor} strokeWidth={1}>
              <title>{`${node.displayName} • ${formatPercent(node.value, 2, 2)}`}</title>
            </rect>
            {isActive ? (
              <SankeyNodeLabel
                node={node}
                textColor={textColor}
                mutedTextColor={mutedTextColor}
                backgroundStrokeColor={backgroundStrokeColor}
              />
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
  activeIndex,
  panelCount,
  onOlder,
  onNewer
}: {
  activeIndex: number
  panelCount: number
  onOlder: () => void
  onNewer: () => void
}): ReactElement | null {
  if (panelCount <= 1) {
    return null
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 top-4 z-20 flex justify-center px-4">
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
        <TimelineControls activeIndex={activeIndex} panelCount={panels.length} onOlder={goOlder} onNewer={goNewer} />

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
