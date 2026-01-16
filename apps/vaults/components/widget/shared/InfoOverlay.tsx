import { Button } from '@lib/components/Button'
import { cl } from '@lib/utils'
import type { FC, ReactNode } from 'react'
import { CloseIcon } from './Icons'

interface InfoOverlayProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  hideButton?: boolean
}

export const InfoOverlay: FC<InfoOverlayProps> = ({ isOpen, onClose, title, children, hideButton }) => {
  return (
    <div
      className="absolute z-50"
      style={{
        top: '-48px',
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: isOpen ? 'auto' : 'none'
      }}
    >
      {/* Semi-transparent backdrop with fade animation */}
      <div
        className={cl(
          'absolute inset-0 bg-black/5 rounded-xl transition-opacity duration-200',
          isOpen ? 'opacity-100' : 'opacity-0'
        )}
        onClick={onClose}
      />
      {/* Overlay content with slide from right animation */}
      <div
        className={cl(
          'absolute inset-0 bg-surface rounded-xl transition-all duration-300 ease-out flex flex-col',
          isOpen ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
        )}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 hover:bg-surface-secondary rounded-lg transition-colors z-10"
          type="button"
        >
          <CloseIcon className="w-5 h-5 text-text-secondary" />
        </button>

        {/* Content */}
        <div className="flex-1 flex flex-col p-6 min-h-0">
          <h3 className="text-lg font-semibold text-text-primary mb-4 shrink-0">{title}</h3>
          <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain">{children}</div>
          {!hideButton && (
            <div className="mt-6 shrink-0">
              <Button
                onClick={onClose}
                variant="filled"
                className="w-full"
                classNameOverride="yearn--button--nextgen w-full"
              >
                Got it
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
