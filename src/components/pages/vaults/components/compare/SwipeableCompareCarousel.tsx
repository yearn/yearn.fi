import { CompareVaultCard } from '@pages/vaults/components/compare/CompareVaultCard'
import { getVaultKey } from '@shared/hooks/useVaultFilterUtils'
import { IconChevron } from '@shared/icons/IconChevron'
import { cl } from '@shared/utils'
import type { TYDaemonVault } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import { motion, type PanInfo, useAnimation } from 'framer-motion'
import { type ReactElement, useCallback, useEffect, useState } from 'react'

type TSwipeableCompareCarouselProps = {
  vaults: TYDaemonVault[]
  onRemove: (vaultKey: string) => void
}

const SWIPE_THRESHOLD = 50
const SWIPE_VELOCITY_THRESHOLD = 500

export function SwipeableCompareCarousel({ vaults, onRemove }: TSwipeableCompareCarouselProps): ReactElement {
  const [currentIndex, setCurrentIndex] = useState(0)
  const controls = useAnimation()

  const maxIndex = vaults.length - 1

  useEffect(() => {
    if (currentIndex > maxIndex) {
      setCurrentIndex(Math.max(0, maxIndex))
    }
  }, [currentIndex, maxIndex])

  const goToIndex = useCallback(
    (index: number) => {
      const clampedIndex = Math.max(0, Math.min(index, maxIndex))
      setCurrentIndex(clampedIndex)
      controls.start({ x: `-${clampedIndex * 100}%` })
    },
    [maxIndex, controls]
  )

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      goToIndex(currentIndex - 1)
    }
  }, [currentIndex, goToIndex])

  const goToNext = useCallback(() => {
    if (currentIndex < maxIndex) {
      goToIndex(currentIndex + 1)
    }
  }, [currentIndex, maxIndex, goToIndex])

  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const { offset, velocity } = info
      const swipe = Math.abs(offset.x) * velocity.x

      if (swipe < -SWIPE_VELOCITY_THRESHOLD || offset.x < -SWIPE_THRESHOLD) {
        goToNext()
      } else if (swipe > SWIPE_VELOCITY_THRESHOLD || offset.x > SWIPE_THRESHOLD) {
        goToPrevious()
      } else {
        controls.start({ x: `-${currentIndex * 100}%` })
      }
    },
    [currentIndex, goToNext, goToPrevious, controls]
  )

  const handleRemove = useCallback(
    (vaultKey: string) => {
      onRemove(vaultKey)
      if (currentIndex > 0 && currentIndex >= vaults.length - 1) {
        setCurrentIndex(currentIndex - 1)
      }
    },
    [onRemove, currentIndex, vaults.length]
  )

  if (vaults.length === 0) {
    return (
      <div className={'flex h-64 items-center justify-center rounded-2xl border border-border bg-surface-secondary/40'}>
        <p className={'text-sm text-text-secondary'}>{'No vaults to compare'}</p>
      </div>
    )
  }

  return (
    <div className={'flex flex-col gap-4'}>
      <div className={'relative overflow-hidden'}>
        <motion.div
          className={'flex'}
          animate={controls}
          initial={{ x: 0 }}
          drag={'x'}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.1}
          onDragEnd={handleDragEnd}
          style={{ touchAction: 'pan-y' }}
        >
          {vaults.map((vault) => {
            const vaultKey = getVaultKey(vault)
            return (
              <motion.div key={vaultKey} className={'w-full flex-shrink-0 px-1'} style={{ minWidth: '100%' }}>
                <div className={'h-[480px]'}>
                  <CompareVaultCard vault={vault} onRemove={handleRemove} />
                </div>
              </motion.div>
            )
          })}
        </motion.div>

        {currentIndex > 0 ? (
          <button
            type={'button'}
            onClick={goToPrevious}
            className={cl(
              'absolute left-2 top-1/2 z-10 -translate-y-1/2',
              'flex size-10 items-center justify-center rounded-full',
              'border border-border bg-surface/90 text-text-secondary shadow-lg backdrop-blur-sm',
              'hover:border-border-hover hover:text-text-primary',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
            )}
            aria-label={'Previous vault'}
          >
            <IconChevron direction={'left'} className={'size-5'} />
          </button>
        ) : null}

        {currentIndex < maxIndex ? (
          <button
            type={'button'}
            onClick={goToNext}
            className={cl(
              'absolute right-2 top-1/2 z-10 -translate-y-1/2',
              'flex size-10 items-center justify-center rounded-full',
              'border border-border bg-surface/90 text-text-secondary shadow-lg backdrop-blur-sm',
              'hover:border-border-hover hover:text-text-primary',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
            )}
            aria-label={'Next vault'}
          >
            <IconChevron direction={'right'} className={'size-5'} />
          </button>
        ) : null}
      </div>

      <CarouselIndicators total={vaults.length} current={currentIndex} onSelect={goToIndex} />

      <div className={'text-center text-xs text-text-secondary'}>
        <span>{'Swipe or use arrows to compare'}</span>
        {vaults.length > 1 ? (
          <span className={'ml-1'}>
            {'·'} {currentIndex + 1} {'/'} {vaults.length}
          </span>
        ) : null}
      </div>
    </div>
  )
}

type TCarouselIndicatorsProps = {
  total: number
  current: number
  onSelect: (index: number) => void
}

function CarouselIndicators({ total, current, onSelect }: TCarouselIndicatorsProps): ReactElement {
  return (
    <div className={'flex items-center justify-center gap-2'} role={'tablist'} aria-label={'Vault carousel indicators'}>
      {Array.from({ length: total }).map((_, index) => {
        const isActive = index === current

        return (
          <button
            // biome-ignore lint/suspicious/noArrayIndexKey: Static indicator dots don't reorder
            key={index}
            type={'button'}
            role={'tab'}
            aria-selected={isActive}
            aria-label={`Go to vault ${index + 1}`}
            onClick={(): void => onSelect(index)}
            className={cl(
              'h-2 rounded-full transition-all duration-200',
              isActive ? 'w-6 bg-primary' : 'w-2 bg-border hover:bg-border-hover'
            )}
          />
        )
      })}
    </div>
  )
}
