import React, {lazy, Suspense} from 'react';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';

import type {ReactElement} from 'react';
import type {TGraphData} from '@common/types/types';
import type {TYearnVault} from '@common/types/yearn';

const GraphForVaultEarnings = lazy(async (): Promise<any> => import('@vaults/components/graphs/GraphForVaultEarnings'));

function	VaultDetailsAbout({currentVault, harvestData}: {currentVault: TYearnVault, harvestData: TGraphData[]}): ReactElement {
	return (
		<div className={'grid grid-cols-1 gap-10 bg-neutral-100 p-4 md:grid-cols-2 md:gap-32 md:p-8'}>
			<div className={'col-span-1 w-full space-y-6'}>
				<div>
					<b className={'text-neutral-900'}>{'Description'}</b>
					<p className={'mt-4 text-neutral-600'}>
						{currentVault?.token?.description || 'Sorry, we don’t have a description for this asset right now. But did you know the correct word for a blob of toothpaste is a “nurdle”. Fascinating! We’ll work on updating the asset description, but at least you learnt something interesting. Catch ya later nurdles.'}
					</p>
				</div>
				<div>
					<b className={'text-neutral-900'}>{`Risk score: ${formatAmount(currentVault.riskScore, 0, 2)}`}</b>
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
							<b className={'text-xl tabular-nums text-neutral-900'}>{`${formatAmount((currentVault?.apy?.fees?.management || 0) * 100, 0, 2)} %`}</b>
						</div>
						<div className={'flex flex-col space-y-0 md:space-y-2'}>
							<p className={'text-xxs text-neutral-600 md:text-xs'}>{'Perfomance fee'}</p>
							<b className={'text-xl tabular-nums text-neutral-500'}>{`${formatAmount((currentVault?.apy?.fees?.performance || 0) * 100, 0, 2)} %`}</b>
						</div>
					</div>
				</div>
				<div>
					<b className={'text-neutral-900'}>{'Cumulative Earnings'}</b>
					<div className={'-mx-2 mt-4 flex flex-row border-b border-l border-neutral-300 md:mx-0'}>
						<Suspense>
							<GraphForVaultEarnings
								currentVault={currentVault}
								harvestData={harvestData}
								height={160} />
						</Suspense>
					</div>
				</div>
			</div>
		</div>
	);
}

export {VaultDetailsAbout};