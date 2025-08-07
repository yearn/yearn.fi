import { Popover, PopoverButton, PopoverPanel, Transition } from '@headlessui/react'
import { Renderable } from '@lib/components/Renderable'
import { Switch } from '@lib/components/Switch'
import { useYearn } from '@lib/contexts/useYearn'
import { IconSettings } from '@lib/icons/IconSettings'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { isSolverDisabled } from '@vaults-v2/contexts/useSolver'
import type { TSolver } from '@vaults-v2/types/solvers'
import { Solver } from '@vaults-v2/types/solvers'
import type { ReactElement } from 'react'
import { Fragment, useMemo } from 'react'

type TSettingPopover = {
  vault: TYDaemonVault
}

function Label({ children }: { children: string }): ReactElement {
  return (
    <label htmlFor={'zapProvider'} className={'font-bold text-neutral-900'}>
      {children}
    </label>
  )
}

export function SettingsPopover({ vault }: TSettingPopover): ReactElement {
  const { zapProvider, setZapProvider, zapSlippage, setZapSlippage, isAutoStakingEnabled, setIsAutoStakingEnabled } =
    useYearn()
  const hasStakingRewards = vault.staking.available

  const currentZapProvider = useMemo((): TSolver => {
    if (vault.chainID !== 1 && zapProvider === 'Cowswap') {
      return 'Portals'
    }
    return zapProvider
  }, [vault.chainID, zapProvider])

  return (
    <Popover className={'relative flex'}>
      {(): ReactElement => (
        <>
          <PopoverButton>
            <span className={'sr-only'}>{'Settings'}</span>
            <IconSettings className={'transition-color size-4 text-neutral-400 hover:text-neutral-900'} />
          </PopoverButton>
          <Transition
            as={Fragment}
            enter={'transition ease-out duration-200'}
            enterFrom={'opacity-0 translate-y-1'}
            enterTo={'opacity-100 translate-y-0'}
            leave={'transition ease-in duration-150'}
            leaveFrom={'opacity-100 translate-y-0'}
            leaveTo={'opacity-0 translate-y-1'}
          >
            <PopoverPanel className={'absolute right-0 top-6 z-[1000] mt-3 w-screen max-w-xs md:-right-4 md:top-4'}>
              <div className={'yearn--shadow'}>
                <div className={'relative bg-neutral-0 p-4'}>
                  <div className={'mb-6 flex flex-col space-y-1'}>
                    <p>{'Zap Provider'}</p>
                    <select
                      id={'zapProvider'}
                      onChange={(e): void => setZapProvider(e.target.value as TSolver)}
                      value={!isSolverDisabled(currentZapProvider) ? currentZapProvider : Solver.enum.Portals}
                      className={
                        'mt-1 h-10 w-full overflow-x-scroll border-none bg-neutral-100 p-2 outline-none scrollbar-none'
                      }
                    >
                      {vault.chainID === 1 ? (
                        <option disabled={isSolverDisabled(Solver.enum.Cowswap)} value={Solver.enum.Cowswap}>
                          {Solver.enum.Cowswap}
                        </option>
                      ) : null}
                      <option disabled={isSolverDisabled(Solver.enum.Portals)} value={Solver.enum.Portals}>
                        {Solver.enum.Portals}
                      </option>
                    </select>
                    <Renderable shouldRender={currentZapProvider === Solver.enum.Cowswap}>
                      <legend className={'text-xs italic text-neutral-500'}>
                        {'Submit a'}&nbsp;
                        <a
                          className={'underline'}
                          href={'https://docs.cow.fi/front-end/cowswap'}
                          target={'_blank'}
                          rel={'noreferrer'}
                        >
                          {'gasless order'}
                        </a>
                        &nbsp;{'using CoW Swap.'}
                      </legend>
                    </Renderable>
                    <Renderable shouldRender={currentZapProvider === Solver.enum.Portals}>
                      <legend className={'ml-2 text-xs text-neutral-500'}>
                        {'Submit an order via'}&nbsp;
                        <a className={'underline'} href={'https://portals.fi/'} target={'_blank'} rel={'noreferrer'}>
                          {'Portals'}
                        </a>
                        &nbsp;{'(0.3% fee).'}
                      </legend>
                    </Renderable>
                  </div>
                  <div className={'flex flex-col space-y-1'}>
                    <Label>{'Slippage'}</Label>
                    <div className={'mt-1 flex flex-row space-x-2'}>
                      <button
                        onClick={(): void => setZapSlippage(1)}
                        className={`flex h-10 items-center border bg-neutral-100 px-1.5 py-2 ${
                          zapSlippage === 1 ? 'border-neutral-900' : 'border-transparent'
                        }`}
                      >
                        <p className={'font-number pr-4 text-neutral-900'}>{'1%'}</p>
                      </button>
                      <button
                        onClick={(): void => setZapSlippage(2)}
                        className={`flex h-10 items-center border bg-neutral-100 px-1.5 py-2 ${
                          zapSlippage === 2 ? 'border-neutral-900' : 'border-transparent'
                        }`}
                      >
                        <p className={'font-number pr-4 text-neutral-900'}>{'2%'}</p>
                      </button>
                      <div
                        className={`flex h-10 w-full min-w-[72px] items-center border bg-neutral-100 px-0 py-4 md:min-w-[160px] ${
                          zapSlippage !== 1 && zapSlippage !== 2 ? 'border-neutral-900' : 'border-transparent'
                        }`}
                      >
                        <input
                          id={'slippageTolerance'}
                          type={'number'}
                          min={0}
                          step={0.1}
                          max={100}
                          className={
                            'font-number h-10 w-full overflow-x-scroll border-none bg-transparent p-2 text-right outline-none scrollbar-none'
                          }
                          value={zapSlippage}
                          onChange={(e): void => {
                            setZapSlippage(parseFloat(e.target.value) || 0)
                          }}
                        />
                        <p className={'font-number mt-1 pr-2 text-neutral-900/60'}>{'%'}</p>
                      </div>
                    </div>
                  </div>
                  {hasStakingRewards ? (
                    <div className={'mt-6'}>
                      <Label>{'Staking Vaults'}</Label>
                      <legend className={'pb-2 text-xs text-neutral-500'}>
                        {
                          'Some Vaults offer boosted yields or token rewards via staking. Enable automatic staking to (you guessed it) automatically stake for these boosts.'
                        }
                      </legend>
                      <div className={'mt-1 flex flex-row space-x-2'}>
                        <div className={'flex grow items-center justify-between'}>
                          <p className={'mr-2'}>{'Stake automatically'}</p>
                          <Switch
                            isEnabled={isAutoStakingEnabled}
                            onSwitch={(): void => setIsAutoStakingEnabled(!isAutoStakingEnabled)}
                          />
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </PopoverPanel>
          </Transition>
        </>
      )}
    </Popover>
  )
}
