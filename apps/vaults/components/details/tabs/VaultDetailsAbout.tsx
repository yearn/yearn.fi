import {useIsMounted} from '@react-hookz/web';
import {GraphForVaultEarnings} from '@vaults/components/graphs/GraphForVaultEarnings';
import {Renderable} from '@yearn-finance/web-lib/components/Renderable';
import {cl} from '@yearn-finance/web-lib/utils/cl';
import {formatPercent} from '@yearn-finance/web-lib/utils/format.number';
import {parseMarkdown} from '@yearn-finance/web-lib/utils/helpers';
import {isZero} from '@yearn-finance/web-lib/utils/isZero';

import type {ReactElement} from 'react';
import type {TYDaemonVault} from '@common/schemas/yDaemonVaultsSchemas';
import type {TGraphData} from '@common/types/types';

type TAPRLineItemProps = {
	label: string;
	value: number | string;
	apyType: string;
	hasUpperLimit?: boolean;
};

type TYearnFeesLineItem = {
	children: ReactElement;
	label: string;
	tooltip?: string;
};

function APRLineItem({value, label, apyType, hasUpperLimit}: TAPRLineItemProps): ReactElement {
	const safeValue = Number(value) || 0;
	const isNew = apyType === 'new' && isZero(safeValue);

	return (
		<div className={'flex flex-row items-center justify-between'}>
			<p className={'text-sm text-neutral-500'}>{label}</p>
			<p
				className={'font-number text-sm text-neutral-900'}
				suppressHydrationWarning>
				{isNew ? 'New' : hasUpperLimit ? formatPercent(safeValue * 100) : formatPercent(safeValue * 100, 2, 2, 500)}
			</p>
		</div>
	);
}

function YearnFeesLineItem({children, label, tooltip}: TYearnFeesLineItem): ReactElement {
	return (
		<div className={'flex flex-col space-y-0 md:space-y-2'}>
			<p className={'text-xxs text-neutral-600 md:text-xs'}>{label}</p>
			<div className={cl(tooltip ? 'tooltip underline decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-opacity hover:decoration-neutral-600' : '')}>
				{tooltip ? (
					<span
						suppressHydrationWarning
						className={'tooltipFees bottom-full'}>
						<div className={'font-number w-96 border border-neutral-300 bg-neutral-100 p-1 px-2 text-center text-xxs text-neutral-900'}>{tooltip}</div>
					</span>
				) : null}
				{children}
			</div>
		</div>
	);
}

export function VaultDetailsAbout({currentVault, harvestData}: {currentVault: TYDaemonVault; harvestData: TGraphData[]}): ReactElement {
	const isMounted = useIsMounted();
	const {token, apr} = currentVault;

	function getVaultDescription(): string {
		if (token.description) {
			return parseMarkdown(token.description);
		}
		return 'Sorry, we don\'t have a description for this asset right now. But did you know the correct word for a blob of toothpaste is a "nurdle". Fascinating! We\'ll work on updating the asset description, but at least you learnt something interesting. Catch ya later nurdles.';
	}

	return (
		<div className={'grid grid-cols-1 gap-10 bg-neutral-100 p-4 md:grid-cols-2 md:gap-32 md:p-8'}>
			<div className={'col-span-1 w-full space-y-6'}>
				<div>
					<b className={'text-neutral-900'}>{'Description'}</b>
					<p
						className={'mt-4 text-neutral-600'}
						dangerouslySetInnerHTML={{
							__html: getVaultDescription()
						}}
					/>
				</div>
				<div>
					<b className={'text-neutral-900'}>{'APR'}</b>
					<div className={'mt-4 grid grid-cols-1 gap-x-12 md:grid-cols-2'}>
						<div className={'space-y-2'}>
							<APRLineItem
								label={'Weekly APR'}
								apyType={apr.type}
								value={apr.points.weekAgo}
							/>
							<APRLineItem
								label={'Monthly APR'}
								apyType={apr.type}
								value={apr.points.monthAgo}
							/>
							<APRLineItem
								label={'Inception APR'}
								apyType={apr.type}
								value={apr.points.inception}
							/>
						</div>
						<div className={'mt-2 space-y-0 md:mt-0'}>
							<APRLineItem
								hasUpperLimit
								label={'Net APR'}
								apyType={apr.type}
								value={apr.netAPR + apr.extra.stakingRewardsAPR}
							/>
							{apr.extra.stakingRewardsAPR > 0 && (
								<div className={'pl-2'}>
									<APRLineItem
										hasUpperLimit
										label={'• Base APR'}
										apyType={apr.type}
										value={apr.netAPR}
									/>
									<APRLineItem
										hasUpperLimit
										label={'• Staking Reward APR'}
										apyType={apr.type}
										value={apr.extra.stakingRewardsAPR}
									/>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
			<div className={'col-span-1 w-full space-y-8'}>
				<div>
					<b className={'text-neutral-900'}>{'Yearn Fees'}</b>
					<div className={'mt-4 flex flex-row space-x-6 md:space-x-8'}>
						<YearnFeesLineItem label={'Deposit/Withdrawal fee'}>
							<b className={'font-number text-xl text-neutral-900'}>{formatPercent(0, 0, 0)}</b>
						</YearnFeesLineItem>
						<YearnFeesLineItem label={'Management fee'}>
							<b className={'font-number text-xl text-neutral-900'}>{formatPercent((apr.fees.management || 0) / 100, 0)}</b>
						</YearnFeesLineItem>
						<YearnFeesLineItem label={'Performance fee'}>
							<b className={'font-number text-xl text-neutral-500'}>{formatPercent((apr.fees.performance || 0) / 100, 0)}</b>
						</YearnFeesLineItem>
						{currentVault.category === 'Velodrome' || currentVault.category === 'Aerodrome' ? (
							<YearnFeesLineItem
								label={'keepVELO'}
								tooltip={`Percentage of VELO locked in each harvest. This is used to boost ${currentVault.category} vault pools, and is offset via yvOP staking rewards.`}>
								<b className={'font-number text-xl text-neutral-500'}>{formatPercent(currentVault.apr.fees.keepVelo * 100, 0)}</b>
							</YearnFeesLineItem>
						) : null}
					</div>
				</div>
				<div>
					<b className={'text-neutral-900'}>{'Cumulative Earnings'}</b>
					<div
						className={'-mx-2 mt-4 flex flex-row border-b border-l border-neutral-300 md:mx-0'}
						style={{height: 160}}>
						<Renderable shouldRender={isMounted()}>
							<GraphForVaultEarnings
								currentVault={currentVault}
								harvestData={harvestData}
								height={160}
							/>
						</Renderable>
					</div>
				</div>
			</div>
		</div>
	);
}
