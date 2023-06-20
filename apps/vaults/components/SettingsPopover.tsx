import {Fragment} from 'react';
import {Popover, Transition} from '@headlessui/react';
import {isSolverDisabled} from '@vaults/contexts/useSolver';
import Renderable from '@yearn-finance/web-lib/components/Renderable';
import IconSettings from '@yearn-finance/web-lib/icons/IconSettings';
import {useYearn} from '@common/contexts/useYearn';
import {Solver} from '@common/schemas/yDaemonTokenListBalances';

import type {ReactElement} from 'react';
import type {TSolver} from '@common/schemas/yDaemonTokenListBalances';

export default function SettingsPopover(): ReactElement {
	const {zapProvider, set_zapProvider, zapSlippage, set_zapSlippage} = useYearn();

	return (
		<Popover className={'relative flex'}>
			{(): ReactElement => (
				<>
					<Popover.Button>
						<span className={'sr-only'}>{'Settings'}</span>
						<IconSettings className={'transition-color h-4 w-4 text-neutral-400 hover:text-neutral-900'} />
					</Popover.Button>
					<Transition
						as={Fragment}
						enter={'transition ease-out duration-200'}
						enterFrom={'opacity-0 translate-y-1'}
						enterTo={'opacity-100 translate-y-0'}
						leave={'transition ease-in duration-150'}
						leaveFrom={'opacity-100 translate-y-0'}
						leaveTo={'opacity-0 translate-y-1'}>
						<Popover.Panel className={'absolute right-0 top-6 z-[1000] mt-3 w-screen max-w-xs md:-right-4 md:top-4'}>
							<div className={'yearn--shadow'}>
								<div className={'relative bg-neutral-0 p-4'}>
									<div className={'mb-7 flex flex-col space-y-1'}>
										<label htmlFor={'zapProvider'} className={'text-neutral-900'}>{'Zap Provider'}</label>
										<select
											id={'zapProvider'}
											onChange={(e): void => set_zapProvider(e.target.value as TSolver)}
											value={zapProvider}
											className={'mt-1 h-10 w-full overflow-x-scroll border-none bg-neutral-100 p-2 outline-none scrollbar-none'}>
											<option
												disabled={isSolverDisabled[Solver.enum.Cowswap]}
												value={Solver.enum.Cowswap}>
												{Solver.enum.Cowswap}
											</option>
											<option
												disabled={isSolverDisabled[Solver.enum.Wido]}
												value={Solver.enum.Wido}>
												{Solver.enum.Wido}
											</option>
											<option
												disabled={isSolverDisabled[Solver.enum.Portals]}
												value={Solver.enum.Portals}>
												{Solver.enum.Portals}
											</option>
										</select>
										<Renderable shouldRender={zapProvider === Solver.enum.Cowswap}>
											<legend className={'text-xs italic text-neutral-500'}>
												{'Submit a'}&nbsp;
												<a
													className={'underline'}
													href={'https://docs.cow.fi/front-end/cowswap'}
													target={'_blank'}
													rel={'noreferrer'}>
													{'gasless order'}
												</a>
													&nbsp;{'using CoW Swap.'}
											</legend>
										</Renderable>
										<Renderable shouldRender={zapProvider === Solver.enum.Wido}>
											<legend className={'text-xs italic text-neutral-500'}>
												{'Submit an order via'}&nbsp;
												<a
													className={'underline'}
													href={'https://www.joinwido.com/'}
													target={'_blank'}
													rel={'noreferrer'}>
													{'Wido'}
												</a>
													&nbsp;{'(0.3% fee).'}
											</legend>
										</Renderable>
										<Renderable shouldRender={zapProvider === Solver.enum.Portals}>
											<legend>&nbsp;</legend>
										</Renderable>
									</div>
									<div>
										<label
											htmlFor={'slippageTolerance'}
											className={'text-neutral-900'}>
											{'Slippage tolerance'}
										</label>
										<div className={'mt-1 flex flex-row space-x-2'}>
											<button
												onClick={(): void => set_zapSlippage(1)}
												className={`flex h-10 items-center border bg-neutral-100 px-1.5 py-2 ${zapSlippage === 1 ? 'border-neutral-900' : 'border-transparent'}`}>
												<p className={'font-number pr-4 text-neutral-900'}>{'1%'}</p>
											</button>
											<button
												onClick={(): void => set_zapSlippage(2)}
												className={`flex h-10 items-center border bg-neutral-100 px-1.5 py-2 ${zapSlippage === 2 ? 'border-neutral-900' : 'border-transparent'}`}>
												<p className={'font-number pr-4 text-neutral-900'}>{'2%'}</p>
											</button>
											<div className={`flex h-10 w-full min-w-[72px] items-center border bg-neutral-100 px-0 py-4 md:min-w-[160px] ${zapSlippage !== 1 && zapSlippage !== 2 ? 'border-neutral-900' : 'border-transparent'}`}>
												<input
													id={'slippageTolerance'}
													type={'number'}
													min={0}
													step={0.1}
													max={100}
													className={'font-number h-10 w-full overflow-x-scroll border-none bg-transparent p-2 text-right outline-none scrollbar-none'}
													value={zapSlippage}
													onChange={(e): void => {
														set_zapSlippage(parseFloat(e.target.value) || 0);
													}} />
												<p className={'font-number mt-1 pr-2 text-neutral-900/60'}>{'%'}</p>
											</div>
										</div>
									</div>
								</div>
							</div>
						</Popover.Panel>
					</Transition>
				</>
			)}
		</Popover>
	);
}
