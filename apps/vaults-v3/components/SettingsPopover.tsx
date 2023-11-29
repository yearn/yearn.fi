import {Fragment, useMemo} from 'react';
import {Popover, Transition} from '@headlessui/react';
import {isSolverDisabled} from '@vaults/contexts/useSolver';
import {Renderable} from '@yearn-finance/web-lib/components/Renderable';
import {IconSettings} from '@yearn-finance/web-lib/icons/IconSettings';
import {cl} from '@yearn-finance/web-lib/utils/cl';
import {Switch} from '@common/components/Switch';
import {useYearn} from '@common/contexts/useYearn';
import {Solver} from '@common/schemas/yDaemonTokenListBalances';

import type {ReactElement} from 'react';
import type {TSolver} from '@common/schemas/yDaemonTokenListBalances';
import type {TYDaemonVault} from '@common/schemas/yDaemonVaultsSchemas';

type TSettingPopover = {
	vault: TYDaemonVault;
};

function Label({children}: {children: string}): ReactElement {
	return (
		<label
			htmlFor={'zapProvider'}
			className={'font-bold text-neutral-900'}>
			{children}
		</label>
	);
}

function MaxLossSection(): ReactElement {
	const {maxLoss, set_maxLoss} = useYearn();

	return (
		<div className={'flex flex-col space-y-1'}>
			<Label>{'Max Loss'}</Label>
			<legend className={'text-xs text-neutral-500'}>
				{'Maximum acceptable loss when withdrawing from vaults.'}
			</legend>
			<div className={'flex flex-row space-x-2 pt-2'}>
				<button
					onClick={(): void => set_maxLoss(100n)}
					className={`flex h-10 items-center rounded-lg border bg-neutral-100 px-1.5 py-2 ${
						maxLoss === 100n ? 'border-neutral-900/40' : 'border-transparent'
					}`}>
					<p className={'font-number px-2 text-center text-neutral-900 '}>{'1%'}</p>
				</button>
				<button
					onClick={(): void => set_maxLoss(200n)}
					className={`flex h-10 items-center rounded-lg border bg-neutral-100 px-1.5 py-2 ${
						maxLoss === 200n ? 'border-neutral-900/40' : 'border-transparent'
					}`}>
					<p className={'font-number px-2 text-center text-neutral-900 '}>{'2%'}</p>
				</button>
				<div
					className={`flex h-10 w-full min-w-[72px] items-center rounded-lg border bg-neutral-100 px-0 py-4 md:min-w-[160px] ${
						maxLoss !== 100n && maxLoss !== 200n ? 'border-neutral-900/40' : 'border-transparent'
					}`}>
					<input
						type={'number'}
						min={0}
						step={0.1}
						max={100}
						className={
							'font-number h-10 w-full overflow-x-scroll border-none bg-transparent p-2 text-right outline-none scrollbar-none'
						}
						value={(Number(maxLoss) / 100).toString()}
						onChange={(e): void => {
							const value = BigInt(Math.round(parseFloat(e.target.value || '0') * 100));
							if (value > 10000n) {
								return set_maxLoss(10000n);
							}
							set_maxLoss(value);
						}}
					/>
					<p className={'font-number mt-1 pr-2 text-neutral-900/60'}>{'%'}</p>
				</div>
			</div>
		</div>
	);
}

function ZapSection({chainID}: {chainID: number}): ReactElement {
	const {zapProvider, set_zapProvider, zapSlippage, set_zapSlippage} = useYearn();

	const currentZapProvider = useMemo((): TSolver => {
		if (chainID !== 1 && zapProvider === 'Cowswap') {
			return 'Portals';
		}
		return zapProvider;
	}, [chainID, zapProvider]);

	return (
		<>
			<div className={'mb-2 flex flex-col space-y-1'}>
				<Label>{'Zap Provider & slippage'}</Label>
				<legend className={'pb-2 text-xs text-neutral-500'}>
					{
						'When you want to deposit/withdraw a token that is not supported by the vault, we will use this provider to swap it to a supported token.'
					}
				</legend>
				<Renderable shouldRender={currentZapProvider === Solver.enum.Cowswap}>
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
				<Renderable shouldRender={currentZapProvider === Solver.enum.Portals}>
					<legend className={'text-xs text-neutral-500'}>
						{'Submit an order via'}&nbsp;
						<a
							className={'underline'}
							href={'https://portals.fi/'}
							target={'_blank'}
							rel={'noreferrer'}>
							{'Portals'}
						</a>
						&nbsp;{'(0.3% fee).'}
					</legend>
				</Renderable>
				<select
					id={'zapProvider'}
					onChange={(e): void => set_zapProvider(e.target.value as TSolver)}
					value={!isSolverDisabled(currentZapProvider) ? currentZapProvider : Solver.enum.Portals}
					className={
						'mt-1 h-10 w-full overflow-x-scroll rounded-lg border-none bg-neutral-100 p-2 outline-none scrollbar-none'
					}>
					{chainID === 1 ? (
						<option
							disabled={isSolverDisabled(Solver.enum.Cowswap)}
							value={Solver.enum.Cowswap}>
							{Solver.enum.Cowswap}
						</option>
					) : null}
					<option
						disabled={isSolverDisabled(Solver.enum.Portals)}
						value={Solver.enum.Portals}>
						{Solver.enum.Portals}
					</option>
				</select>
			</div>
			<div className={'flex flex-col space-y-1'}>
				<div className={'mt-1 flex flex-row space-x-2'}>
					<button
						onClick={(): void => set_zapSlippage(1)}
						className={`flex h-10 items-center rounded-lg border bg-neutral-100 px-1.5 py-2 ${
							zapSlippage === 1 ? 'border-neutral-900/40' : 'border-transparent'
						}`}>
						<p className={'font-number px-2 text-center text-neutral-900 '}>{'1%'}</p>
					</button>
					<button
						onClick={(): void => set_zapSlippage(2)}
						className={`flex h-10 items-center rounded-lg border bg-neutral-100 px-1.5 py-2 ${
							zapSlippage === 2 ? 'border-neutral-900/40' : 'border-transparent'
						}`}>
						<p className={'font-number px-2 text-center text-neutral-900 '}>{'2%'}</p>
					</button>
					<div
						className={`flex h-10 w-full min-w-[72px] items-center rounded-lg border bg-neutral-100 px-0 py-4 md:min-w-[160px] ${
							zapSlippage !== 1 && zapSlippage !== 2 ? 'border-neutral-900/40' : 'border-transparent'
						}`}>
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
								set_zapSlippage(parseFloat(e.target.value) || 0);
							}}
						/>
						<p className={'font-number mt-1 pr-2 text-neutral-900/60'}>{'%'}</p>
					</div>
				</div>
				<legend className={'pl-1 text-xs text-neutral-500'}>{'Maximum acceptable slippage for Zaps.'}</legend>
			</div>
		</>
	);
}

function StakingSection({currentVault}: {currentVault: TYDaemonVault}): ReactElement | null {
	const {isStakingOpBoostedVaults, set_isStakingOpBoostedVaults} = useYearn();

	if (!currentVault.staking.available) {
		return null;
	}

	return (
		<div className={'mt-6'}>
			<Label>{'OP Boosted Vaults'}</Label>
			<div className={'mt-1 flex flex-row space-x-2'}>
				<div className={'flex grow items-center justify-between'}>
					<p className={'mr-2 text-sm'}>{'Stake automatically'}</p>
					<Switch
						isEnabled={isStakingOpBoostedVaults}
						onSwitch={(): void => set_isStakingOpBoostedVaults(!isStakingOpBoostedVaults)}
					/>
				</div>
			</div>
		</div>
	);
}

export function SettingsPopover({vault}: TSettingPopover): ReactElement {
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
						<Popover.Panel
							className={cl(
								'absolute right-0 top-6 z-[1000] mt-3 w-screen max-w-xs md:-right-4 md:top-4 ',
								'bg-neutral-200 rounded-lg'
							)}>
							<div className={'relative p-4'}>
								<MaxLossSection />
								<div className={'my-6 h-[1px] w-full bg-neutral-900/20'} />
								<ZapSection chainID={vault.chainID} />
								<div className={'my-6 h-[1px] w-full bg-neutral-900/20'} />
								<StakingSection currentVault={vault} />
							</div>
						</Popover.Panel>
					</Transition>
				</>
			)}
		</Popover>
	);
}
