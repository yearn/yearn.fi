import { Popover, PopoverButton, PopoverPanel, Transition } from '@headlessui/react'
import { Switch } from '@lib/components/Switch'
import { IconSettings } from '@lib/icons/IconSettings'
import { cl } from '@lib/utils'
import { useAppSettings } from '@vaults-v2/contexts/useAppSettings'
import type { ReactElement } from 'react'
import { Fragment } from 'react'

type TVautListOptions = {
  panelClassName?: string
}
export function VaultListOptions(props: TVautListOptions): ReactElement {
  const { shouldHideDust, onSwitchHideDust } = useAppSettings()

  return (
    <Popover className={'relative flex'}>
      {(): ReactElement => (
        <>
          <PopoverButton>
            <IconSettings
              className={'transition-color size-4 text-neutral-400 hover:text-neutral-900'}
            />
          </PopoverButton>
          <Transition
            as={Fragment}
            enter={'transition ease-out duration-200'}
            enterFrom={'opacity-0 translate-y-1'}
            enterTo={'opacity-100 translate-y-0'}
            leave={'transition ease-in duration-150'}
            leaveFrom={'opacity-100 translate-y-0'}
            leaveTo={'opacity-0 translate-y-1'}>
            <PopoverPanel
              className={
                'absolute right-0 top-6 z-[1000] mt-3 w-screen max-w-[180px] md:-right-4 md:top-4'
              }>
              <div className={'yearn--shadow overflow-hidden'}>
                <div className={cl(props.panelClassName, 'relative bg-neutral-0')}>
                  <div
                    className={
                      'flex cursor-pointer items-center justify-between p-4 transition-colors hover:bg-neutral-100/40'
                    }>
                    <p className={'text-xs'}>{'Hide dust'}</p>
                    <Switch isEnabled={shouldHideDust} onSwitch={onSwitchHideDust} />
                  </div>
                </div>
              </div>
            </PopoverPanel>
          </Transition>
        </>
      )}
    </Popover>
  )
}
