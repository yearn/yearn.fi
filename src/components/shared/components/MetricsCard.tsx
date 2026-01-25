import { Dialog, Transition } from '@headlessui/react'
import { Tooltip } from '@shared/components/Tooltip'
import { cl } from '@shared/utils'
import { Fragment, type ReactElement, useState } from 'react'

export const METRIC_VALUE_CLASS = 'font-semibold text-[20px] leading-tight md:text-[22px]'
export const METRIC_FOOTNOTE_CLASS = 'text-xs text-text-secondary'

export type TMetricBlock = {
  key: string
  header: ReactElement
  value: ReactElement
  footnote?: ReactElement
  secondaryLabel?: ReactElement
}

function MetricInfoModal({
  description,
  isOpen,
  onClose,
  title
}: {
  description: string
  isOpen: boolean
  onClose: () => void
  title: string
}): ReactElement {
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as={'div'} className={'relative z-50'} onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter={'ease-out duration-300'}
          enterFrom={'opacity-0'}
          enterTo={'opacity-100'}
          leave={'ease-in duration-200'}
          leaveFrom={'opacity-100'}
          leaveTo={'opacity-0'}
        >
          <div className={'fixed inset-0 bg-neutral-900/30'} />
        </Transition.Child>

        <div className={'fixed inset-0 overflow-y-auto'}>
          <div className={'flex min-h-full items-center justify-center p-4 text-center'}>
            <Transition.Child
              as={Fragment}
              enter={'ease-out duration-300'}
              enterFrom={'opacity-0 scale-95'}
              enterTo={'opacity-100 scale-100'}
              leave={'ease-in duration-200'}
              leaveFrom={'opacity-100 scale-100'}
              leaveTo={'opacity-0 scale-95'}
            >
              <Dialog.Panel
                className={
                  'w-full max-w-md transform overflow-hidden rounded-2xl bg-surface p-6 text-left align-middle shadow-lg transition-all'
                }
              >
                <Dialog.Title as={'h3'} className={'text-lg font-semibold leading-6 text-text-primary'}>
                  {title}
                </Dialog.Title>
                <p className={'mt-4 text-sm text-text-secondary'}>
                  {description}
                  <span className={'mt-2 block text-xs text-text-secondary'}>
                    {'More information about this metric is coming soon.'}
                  </span>
                </p>
                <div className={'mt-6'}>
                  <button
                    type={'button'}
                    className={
                      'inline-flex w-full items-center justify-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-neutral-0 transition-colors hover:bg-neutral-800'
                    }
                    onClick={onClose}
                  >
                    {'Got it'}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}

export function MetricsCard({
  footnoteDisplay = 'inline',
  hideFootnotes = false,
  items,
  className,
  isCompressed = false
}: {
  items: TMetricBlock[]
  footnoteDisplay?: 'inline' | 'tooltip'
  hideFootnotes?: boolean
  className?: string
  isCompressed?: boolean
}): ReactElement {
  return (
    <div
      className={cl(
        'rounded-lg  bg-surface text-text-primary',
        isCompressed ? 'border-l border-border rounded-tl-0' : 'border border-border',
        className
      )}
    >
      <div className={'divide-y divide-neutral-300 md:flex md:divide-y-0'}>
        {items.map((item, index): ReactElement => {
          const showFootnote = Boolean(item.footnote) && !hideFootnotes
          const useTooltip = showFootnote && footnoteDisplay === 'tooltip'
          const valueContent = useTooltip ? (
            <Tooltip
              className={'gap-0 h-auto'}
              openDelayMs={150}
              toggleOnClick
              tooltip={
                <div className={'rounded-lg border border-border bg-surface-secondary px-2 py-1 text-xs'}>
                  {item.footnote}
                </div>
              }
            >
              <div className={'inline-flex'}>{item.value}</div>
            </Tooltip>
          ) : (
            item.value
          )

          return (
            <div
              key={item.key}
              className={cl(
                'flex flex-1 flex-col gap-1 px-5 py-3',
                index < items.length - 1 ? 'md:border-r md:border-border' : ''
              )}
            >
              <div className={'flex items-center justify-between'}>{item.header}</div>
              <div className={'[&_b.yearn--table-data-section-item-value]:text-left font-semibold'}>{valueContent}</div>
              {showFootnote && footnoteDisplay === 'inline' ? <div>{item.footnote}</div> : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function MetricHeader({ label, tooltip }: { label: string; tooltip?: string }): ReactElement {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const infoButton = (
    <button
      type={'button'}
      onClick={(): void => setIsModalOpen(true)}
      aria-label={`Learn more about ${label}`}
      className={
        'inline-flex size-4 items-center justify-center rounded-full border bg-surface border-border text-[10px] font-normal text-text-secondary transition-colors hover:border-neutral-500 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 md:hidden'
      }
    >
      <span className={'leading-none'}>{'i'}</span>
    </button>
  )

  return (
    <>
      <p className={'flex items-center gap-1 text-xs font-normal uppercase tracking-wide text-text-secondary'}>
        {tooltip ? (
          <>
            <Tooltip
              align={'center'}
              openDelayMs={150}
              className={'hidden md:inline'}
              tooltip={
                <div
                  className={'rounded-lg border border-border bg-surface-secondary px-2 py-1 text-xs text-text-primary'}
                >
                  {tooltip}
                </div>
              }
            >
              <span
                className={
                  'hidden cursor-pointer underline decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-colors hover:decoration-neutral-600 md:inline'
                }
              >
                {label}
              </span>
            </Tooltip>
            <span className={'md:hidden'}>{label}</span>
            {infoButton}
          </>
        ) : (
          <span>{label}</span>
        )}
      </p>
      {tooltip ? (
        <MetricInfoModal
          description={tooltip}
          isOpen={isModalOpen}
          onClose={(): void => setIsModalOpen(false)}
          title={label}
        />
      ) : null}
    </>
  )
}
