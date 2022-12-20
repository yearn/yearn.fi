import React from 'react';
import dynamic from 'next/dynamic';
import {formatPercent} from '@common/utils';

import type {ReactElement} from 'react';
import type {TGraphData} from '@common/types/types';
import type {TYearnVault} from '@common/types/yearn';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GraphForVaultEarnings = dynamic(async (): Promise<any> => import('@vaults/components/graphs/GraphForVaultEarnings'), {ssr: false}) as any;

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
					<b className={'text-neutral-900'}>{'APY'}</b>
					<div className={'mt-4 grid grid-cols-1 gap-x-12 md:grid-cols-2'}>
						<div className={'space-y-2'}>
							<div className={'flex flex-row items-center justify-between'}>
								<p className={'text-sm text-neutral-500'}>{'Weekly APY'}</p>
								<p className={'font-number text-sm text-neutral-900'}>
									{formatPercent((currentVault?.apy?.points?.week_ago || 0) * 100)}
								</p>
							</div>
							<div className={'flex flex-row items-center justify-between'}>
								<p className={'text-sm text-neutral-500'}>{'Monthly APY'}</p>
								<p className={'font-number text-sm text-neutral-900'}>
									{formatPercent((currentVault?.apy?.points?.month_ago || 0) * 100)}
								</p>
							</div>
							<div className={'flex flex-row items-center justify-between'}>
								<p className={'text-sm text-neutral-500'}>{'Inception APY'}</p>
								<p className={'font-number text-sm text-neutral-900'}>
									{formatPercent((currentVault?.apy?.points?.inception || 0) * 100)}
								</p>
							</div>
						</div>
						<div className={'space-y-2'}>
							<div className={'flex flex-row items-center justify-between'}>
								<p className={'text-sm text-neutral-500'}>{'Gross APR'}</p>
								<p className={'font-number text-sm text-neutral-900'}>
									{formatPercent((currentVault?.apy?.gross_apr || 0) * 100)}
								</p>
							</div>
							<div className={'flex flex-row items-center justify-between'}>
								<p className={'text-sm text-neutral-500'}>{'Net APY'}</p>
								<p className={'font-number text-sm text-neutral-900'}>
									{formatPercent((currentVault?.apy?.net_apy || 0) * 100)}
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div className={'col-span-1 w-full space-y-8'}>
				<div>
					<b className={'text-neutral-900'}>{'Yearn Fees'}</b>
					<div className={'mt-4 flex flex-row space-x-6 md:space-x-8'}>
						<div className={'flex flex-col space-y-0 md:space-y-2'}>
							<p className={'text-xxs text-neutral-600 md:text-xs'}>{'Deposit/Withdrawal fee'}</p>
							<b className={'font-number text-xl text-neutral-900'}>
								{formatPercent(0, 0, 0)}
							</b>
						</div>
						<div className={'flex flex-col space-y-0 md:space-y-2'}>
							<p className={'text-xxs text-neutral-600 md:text-xs'}>{'Management fee'}</p>
							<b className={'font-number text-xl text-neutral-900'}>
								{formatPercent((currentVault?.apy?.fees?.management || 0) * 100, 0)}
							</b>
						</div>
						<div className={'flex flex-col space-y-0 md:space-y-2'}>
							<p className={'text-xxs text-neutral-600 md:text-xs'}>{'Perfomance fee'}</p>
							<b className={'font-number text-xl text-neutral-500'}>
								{formatPercent((currentVault?.apy?.fees?.performance || 0) * 100, 0)}
							</b>
						</div>
					</div>
				</div>
				<div>
					<b className={'text-neutral-900'}>{'Cumulative Earnings'}</b>
					<div className={'-mx-2 mt-4 flex flex-row border-b border-l border-neutral-300 md:mx-0'} style={{height: 160}}>
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