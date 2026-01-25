import { cl } from '@shared/utils'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import type { ReactElement } from 'react'
import { useLayoutEffect, useRef, useState } from 'react'

type TVirtualizedVaultsListProps<TItem> = {
  items: TItem[]
  estimateSize?: number
  overscan?: number
  getItemKey: (item: TItem, index: number) => string
  renderItem: (item: TItem, index: number) => ReactElement
  placeholderCount?: number
  renderPlaceholder?: (index: number) => ReactElement
  className?: string
  itemSpacingClassName?: string
}

export function VirtualizedVaultsList<TItem>({
  items,
  estimateSize = 81,
  overscan = 5,
  getItemKey,
  renderItem,
  placeholderCount,
  renderPlaceholder,
  className,
  itemSpacingClassName
}: TVirtualizedVaultsListProps<TItem>): ReactElement {
  const parentRef = useRef<HTMLDivElement | null>(null)
  const [scrollMargin, setScrollMargin] = useState(0)
  const totalPlaceholderCount = renderPlaceholder ? Math.max(0, placeholderCount ?? 0) : 0
  const totalCount = items.length + totalPlaceholderCount

  useLayoutEffect(() => {
    const update = (): void => {
      const node = parentRef.current
      if (!node) return
      setScrollMargin(node.getBoundingClientRect().top + window.scrollY)
    }

    update()

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    observer?.observe(document.body)
    window.addEventListener('resize', update)

    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [])

  const rowVirtualizer = useWindowVirtualizer({
    count: totalCount,
    estimateSize: () => estimateSize,
    overscan,
    scrollMargin
  })

  useLayoutEffect(() => {
    rowVirtualizer.measure()
  }, [rowVirtualizer])

  const virtualItems = rowVirtualizer.getVirtualItems()
  const totalSize = rowVirtualizer.getTotalSize()

  return (
    <div ref={parentRef} className={cl('relative w-full', className)} style={{ height: totalSize }}>
      {virtualItems.map((virtualRow) => {
        const isPlaceholder = virtualRow.index >= items.length
        const isLast = virtualRow.index === totalCount - 1
        let key: string
        let content: ReactElement | null

        if (isPlaceholder) {
          key = `placeholder-${virtualRow.index}`
          content = renderPlaceholder?.(virtualRow.index) ?? null
        } else {
          const item = items[virtualRow.index]
          key = getItemKey(item, virtualRow.index)
          content = renderItem(item, virtualRow.index)
        }
        return (
          <div
            key={key}
            ref={rowVirtualizer.measureElement}
            data-index={virtualRow.index}
            className={cl(!isLast ? itemSpacingClassName : undefined)}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start - rowVirtualizer.options.scrollMargin}px)`
            }}
          >
            {content}
          </div>
        )
      })}
    </div>
  )
}
