import {cl, formatAmount, formatPercent, isZero} from '@builtbymom/web3/utils';
import {useIsMounted} from '@react-hookz/web';
import {GraphForVaultEarnings} from '@vaults/components/graphs/GraphForVaultEarnings';
import {Renderable} from '@yearn-finance/web-lib/components/Renderable';
import {parseMarkdown} from '@yearn-finance/web-lib/utils/helpers';
import {RenderAmount} from '@common/components/RenderAmount';

import type {ReactElement} from 'react';
import type {TGraphData} from '@yearn-finance/web-lib/types';
import type {TYDaemonVault} from '@yearn-finance/web-lib/utils/schemas/yDaemonVaultsSchemas';

type TAPYLineItemProps = {
	currentVault: TYDaemonVault;
	label: string;
	value: number | string;
	apyType: string;
	hasUpperLimit?: boolean;
	isStaking?: boolean;
};

type TYearnFeesLineItem = {
	children: ReactElement;
	label: string;
	tooltip?: string;
};

function APYLineItem({currentVault, value, label, apyType, isStaking, hasUpperLimit}: TAPYLineItemProps): ReactElement {
	const isSourceVeYFI = currentVault.staking.source === 'VeYFI';
	const safeValue = Number(value) || 0;
	const isNew = apyType === 'new' && isZero(safeValue);

	if (isSourceVeYFI && isStaking) {
		const sumOfRewardsAPY = currentVault.apr.extra.stakingRewardsAPR + currentVault.apr.extra.gammaRewardAPR;
		const veYFIRange = [
			currentVault.apr.extra.stakingRewardsAPR / 10 + currentVault.apr.extra.gammaRewardAPR,
			sumOfRewardsAPY
		] as [number, number];
		const estAPYRange = [
			veYFIRange[0] + currentVault.apr.forwardAPR.netAPR,
			veYFIRange[1] + currentVault.apr.forwardAPR.netAPR
		] as [number, number];
		return (
			<div className={'flex flex-row items-center justify-between'}>
				<p className={'text-sm text-neutral-500'}>{label}</p>
				<p
					className={'font-number text-sm text-neutral-900'}
					suppressHydrationWarning>
					<RenderAmount
						shouldHideTooltip
						value={estAPYRange[0]}
						symbol={'percent'}
						decimals={6}
					/>
					&nbsp;&rarr;&nbsp;
					<RenderAmount
						shouldHideTooltip
						value={estAPYRange[1]}
						symbol={'percent'}
						decimals={6}
					/>
				</p>
			</div>
		);
	}

	return (
		<div className={'flex flex-row items-center justify-between'}>
			<p className={'text-sm text-neutral-500'}>{label}</p>
			<p
				className={'font-number text-sm text-neutral-900'}
				suppressHydrationWarning>
				{isNew
					? 'New'
					: hasUpperLimit
						? formatPercent(safeValue * 100)
						: formatPercent(safeValue * 100, 2, 2, 500)}
			</p>
		</div>
	);
}

function YearnFeesLineItem({children, label, tooltip}: TYearnFeesLineItem): ReactElement {
	return (
		<div className={'flex flex-col space-y-0 md:space-y-2'}>
			<p className={'text-xxs text-neutral-600 md:text-xs'}>{label}</p>
			<div
				className={cl(
					tooltip
						? 'tooltip underline decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-opacity hover:decoration-neutral-600'
						: ''
				)}>
				{tooltip ? (
					<span
						suppressHydrationWarning
						className={'tooltipFees bottom-full'}>
						<div
							className={
								'font-number w-96 border border-neutral-300 bg-neutral-100 p-1 px-2 text-center text-xxs text-neutral-900'
							}>
							{tooltip}
						</div>
					</span>
				) : null}
				{children}
			</div>
		</div>
	);
}

export function VaultDetailsAbout({
	currentVault,
	harvestData
}: {
	currentVault: TYDaemonVault;
	harvestData: TGraphData[];
}): ReactElement {
	const isMounted = useIsMounted();
	const {token, apr} = currentVault;

	function getVaultDescription(): string {
		if (currentVault.description) {
			return parseMarkdown(currentVault.description.replaceAll('{{token}}', currentVault.token.symbol));
		}
		if (token.description) {
			return parseMarkdown(token.description.replaceAll('{{token}}', currentVault.token.symbol));
		}
		return `Sorry, we don't have a description for this asset right now. But did you know the correct word for a blob of toothpaste is a "nurdle". Fascinating! We'll work on updating the asset description, but at least you learnt something interesting. Catch ya later nurdles.`;
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
					<b className={'text-neutral-900'}>{'APY'}</b>
					<div className={'mt-4 grid grid-cols-1 gap-x-12 md:grid-cols-2'}>
						<div className={'space-y-2'}>
							<APYLineItem
								currentVault={currentVault}
								label={'Weekly APY'}
								apyType={apr.type}
								value={apr.points.weekAgo}
							/>
							<APYLineItem
								currentVault={currentVault}
								label={'Monthly APY'}
								apyType={apr.type}
								value={apr.points.monthAgo}
							/>
							<APYLineItem
								currentVault={currentVault}
								label={'Inception APY'}
								apyType={apr.type}
								value={apr.points.inception}
							/>
						</div>
						<div className={'mt-2 space-y-0 md:mt-0'}>
							<APYLineItem
								currentVault={currentVault}
								hasUpperLimit
								label={'Net APY'}
								apyType={apr.type}
								value={apr.netAPR + apr.extra.stakingRewardsAPR}
							/>
							{apr.extra.stakingRewardsAPR > 0 && (
								<div className={'pl-2'}>
									<APYLineItem
										currentVault={currentVault}
										hasUpperLimit
										label={'• Base APY'}
										apyType={apr.type}
										value={apr.netAPR}
									/>
									<APYLineItem
										currentVault={currentVault}
										isStaking
										hasUpperLimit
										label={
											currentVault.staking.source === 'VeYFI'
												? '• veYFI APR'
												: '• Staking Reward APY'
										}
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
							<b className={'font-number text-xl text-neutral-900'}>
								{`${formatAmount(apr.fees.management * 100, 0, 2)} %`}
							</b>
						</YearnFeesLineItem>
						<YearnFeesLineItem label={'Performance fee'}>
							<b className={'font-number text-xl text-neutral-500'}>
								{`${formatAmount(apr.fees.performance * 100, 0, 2)} %`}
							</b>
						</YearnFeesLineItem>
						{(currentVault.apr.forwardAPR.composite?.keepVELO || 0) > 0 ? (
							<YearnFeesLineItem
								label={'keepVELO'}
								tooltip={`Percentage of VELO locked in each harvest. This is used to boost ${currentVault.category} vault pools, and is offset via yvOP staking rewards.`}>
								<b className={'font-number text-xl text-neutral-500'}>
									{`${formatAmount((currentVault.apr.forwardAPR.composite?.keepVELO || 0) * 100, 0, 2)} %`}
								</b>
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
