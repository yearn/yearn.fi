import {useIsMounted} from '@react-hookz/web';
import {GraphForVaultEarnings} from '@vaults/components/graphs/GraphForVaultEarnings';
import Renderable from '@yearn-finance/web-lib/components/Renderable';
import {formatPercent} from '@yearn-finance/web-lib/utils/format.number';
import {parseMarkdown} from '@yearn-finance/web-lib/utils/helpers';

import type {ReactElement} from 'react';
import type {TYDaemonVault} from '@common/schemas/yDaemonVaultsSchemas';
import type {TGraphData} from '@common/types/types';

type TAPYLineItemProps = {
	label: string;
	value: number | string;
	hasUpperLimit?: boolean;
}
;
type TYearnFeesLineItem = {
	children: ReactElement;
	label: string;
};

function APYLineItem({value, label, hasUpperLimit}: TAPYLineItemProps): ReactElement {
	const safeValue = Number(value) || 0;

	return (
		<div className={'flex flex-row items-center justify-between'}>
			<p className={'text-sm text-neutral-500'}>{label}</p>
			<p className={'font-number text-sm text-neutral-900'} suppressHydrationWarning>
				{hasUpperLimit ? formatPercent(safeValue * 100) : formatPercent(safeValue * 100, 2, 2, 500)}
			</p>
		</div>
	);
}

function YearnFeesLineItem({children, label}: TYearnFeesLineItem): ReactElement {
	return (
		<div className={'flex flex-col space-y-0 md:space-y-2'}>
			<p className={'text-xxs text-neutral-600 md:text-xs'}>{label}</p>
			{children}
		</div>
	);
}

function VaultDetailsAbout({currentVault, harvestData}: {currentVault: TYDaemonVault, harvestData: TGraphData[]}): ReactElement {
	const isMounted = useIsMounted();
	const {token, apy, details} = currentVault;

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
					<p className={'mt-4 text-neutral-600'} dangerouslySetInnerHTML={{__html: getVaultDescription()}} />
				</div>
				<div>
					<b className={'text-neutral-900'}>{'APY'}</b>
					<div className={'mt-4 grid grid-cols-1 gap-x-12 md:grid-cols-2'}>
						<div className={'space-y-2'}>
							<APYLineItem label={'Weekly APY'} value={apy.points.week_ago} />
							<APYLineItem label={'Monthly APY'} value={apy.points.month_ago} />
							<APYLineItem label={'Inception APY'} value={apy.points.inception} />
						</div>
						<div className={'mt-2 space-y-2 md:mt-0'}>
							<APYLineItem label={'Gross APR'} value={apy.gross_apr} />
							<APYLineItem label={'Net APY'} value={(apy.net_apy || 0) + (apy.staking_rewards_apr || 0)} hasUpperLimit />
							{apy.staking_rewards_apr > 0 && <APYLineItem label={'Reward APR'} value={apy.staking_rewards_apr} hasUpperLimit />}
						</div>
					</div>
				</div>
			</div>
			<div className={'col-span-1 w-full space-y-8'}>
				<div>
					<b className={'text-neutral-900'}>{'Yearn Fees'}</b>
					<div className={'mt-4 flex flex-row space-x-6 md:space-x-8'}>
						<YearnFeesLineItem label={'Deposit/Withdrawal fee'}>
							<b className={'font-number text-xl text-neutral-900'}>
								{formatPercent(0, 0, 0)}
							</b>
						</YearnFeesLineItem>
						<YearnFeesLineItem label={'Management fee'}>
							<b className={'font-number text-xl text-neutral-900'}>
								{formatPercent((details.managementFee || 0) / 100, 0)}
							</b>
						</YearnFeesLineItem>
						<YearnFeesLineItem label={'Performance fee'}>
							<b className={'font-number text-xl text-neutral-500'}>
								{formatPercent((details.performanceFee || 0) / 100, 0)}
							</b>
						</YearnFeesLineItem>
					</div>
				</div>
				<div>
					<b className={'text-neutral-900'}>{'Cumulative Earnings'}</b>
					<div className={'-mx-2 mt-4 flex flex-row border-b border-l border-neutral-300 md:mx-0'} style={{height: 160}}>
						<Renderable shouldRender={isMounted()}>
							<GraphForVaultEarnings currentVault={currentVault} harvestData={harvestData} height={160} />
						</Renderable>
					</div>
				</div>
			</div>
		</div>
	);
}

export {VaultDetailsAbout};
