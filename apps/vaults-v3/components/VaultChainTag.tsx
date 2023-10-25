import type {ReactElement} from 'react';

function VaultChainTag({chainID}: {chainID: number}): ReactElement {
	switch (chainID) {
		case 1:
			return (
				<div className={'w-fit'}>
					<div className={'rounded-2xl bg-[#627EEA] px-3.5 py-1 text-xs text-neutral-800'}>{'Ethereum'}</div>
				</div>
			);
		case 10:
			return (
				<div className={'w-fit'}>
					<div className={'rounded-2xl bg-[#C80016] px-3.5 py-1 text-xs text-neutral-800'}>{'Optimism'}</div>
				</div>
			);
		case 137:
			return (
				<div className={'w-fit'}>
					<div
						style={{background: 'linear-gradient(244deg, #7B3FE4 5.89%, #A726C1 94.11%)'}}
						className={'rounded-2xl px-3.5 py-1 text-neutral-900'}>
						{'Polygon PoS'}
					</div>
				</div>
			);
		case 250:
			return (
				<div className={'w-fit'}>
					<div className={'rounded-2xl bg-[#1969FF] px-3.5 py-1 text-xs text-neutral-800'}>{'Fantom'}</div>
				</div>
			);
		case 8453:
			return (
				<div className={'w-fit'}>
					<div className={'rounded-2xl bg-[#1C55F5] px-3.5 py-1 text-xs text-neutral-800'}>{'Base'}</div>
				</div>
			);
		case 42161:
			return (
				<div className={'w-fit'}>
					<div className={'rounded-2xl bg-[#2F3749] px-3.5 py-1 text-xs text-neutral-800'}>{'Arbitrum'}</div>
				</div>
			);
		default:
			return (
				<div className={'w-fit'}>
					<div className={'rounded-2xl bg-[#627EEA] px-3.5 py-1 text-xs text-neutral-800'}>{'Ethereum'}</div>
				</div>
			);
	}
}

export {VaultChainTag};
