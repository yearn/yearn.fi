import React from 'react';
import {GraphForVaultEarnings} from '@vaults/components/graphs/GraphForVaultEarnings';
import {format} from '@yearn-finance/web-lib/utils';

import type {ReactElement} from 'react';
import type {TGraphData} from '@common/types/types';
import type {TYearnVault} from '@common/types/yearn';

function	VaultDetailsAbout({currentVault, harvestData}: {currentVault: TYearnVault, harvestData: TGraphData[]}): ReactElement {
	return (
		<div className={'grid grid-cols-1 gap-10 bg-neutral-100 p-4 md:grid-cols-2 md:gap-32 md:p-8'}>
			<div className={'col-span-1 w-full space-y-6'}>
				<div>
					<b className={'text-neutral-900'}>{'Description'}</b>
					<p className={'mt-4 text-neutral-600'}>
						{currentVault?.token?.description || 'Yearn Finance is a suite of products in Decentralized Finance (DeFi) that provides yield aggregation, a decentralized money market, and several other DeFi building blocks on the Ethereum blockchain. The protocol is maintained by various independent developers and is governed by YFI holders.'}
					</p>
				</div>
				<div>
					<b className={'text-neutral-900'}>{`Trust score: ${format.amount(currentVault.safetyScore)}`}</b>
				</div>
			</div>
			<div className={'col-span-1 w-full space-y-8'}>
				<div>
					<b className={'text-neutral-900'}>{'Yearn Fees'}</b>
					<div className={'mt-4 flex flex-row space-x-6 md:space-x-8'}>
						<div className={'flex flex-col space-y-0 md:space-y-2'}>
							<p className={'text-xxs text-neutral-600 md:text-xs'}>{'Deposit/Withdrawal fee'}</p>
							<b className={'text-xl tabular-nums text-neutral-900'}>{'0 %'}</b>
						</div>
						<div className={'flex flex-col space-y-0 md:space-y-2'}>
							<p className={'text-xxs text-neutral-600 md:text-xs'}>{'Management fee'}</p>
							<b className={'text-xl tabular-nums text-neutral-900'}>{`${format.amount((currentVault?.apy?.fees?.management || 0) * 100, 0, 2)} %`}</b>
						</div>
						<div className={'flex flex-col space-y-0 md:space-y-2'}>
							<p className={'text-xxs text-neutral-600 md:text-xs'}>{'Perfomance fee'}</p>
							<b className={'text-xl tabular-nums text-neutral-500'}>{`${format.amount((currentVault?.apy?.fees?.performance || 0) * 100, 0, 2)} %`}</b>
						</div>
					</div>
				</div>
				<div>
					<b className={'text-neutral-900'}>{'Cumulative Earnings'}</b>
					<div className={'-mx-2 mt-4 flex flex-row border-b border-l border-neutral-300 md:mx-0'}>
						<GraphForVaultEarnings
							currentVault={currentVault}
							harvestData={harvestData}
							height={160} />
					</div>
				</div>
			</div>
		</div>
	);
}

export {VaultDetailsAbout};