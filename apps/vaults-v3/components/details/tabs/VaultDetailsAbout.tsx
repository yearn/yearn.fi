import {cl} from '@yearn-finance/web-lib/utils/cl';
import {formatPercent} from '@yearn-finance/web-lib/utils/format.number';
import {parseMarkdown} from '@yearn-finance/web-lib/utils/helpers';
import {isZero} from '@yearn-finance/web-lib/utils/isZero';

import type {ReactElement} from 'react';
import type {TYDaemonVault} from '@common/schemas/yDaemonVaultsSchemas';

type TAPRLineItemProps = {
	label: string;
	value: number | string;
	apyType: string;
	hasUpperLimit?: boolean;
	tooltip?: string;
};

function APRLineItem({value, label, tooltip, apyType, hasUpperLimit}: TAPRLineItemProps): ReactElement {
	const safeValue = Number(value) || 0;
	const isNew = apyType === 'new' && isZero(safeValue);

	return (
		<div className={'flex flex-row items-center justify-between'}>
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
				<p className={'text-sm text-neutral-900/50'}>{label}</p>
			</div>
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

export function VaultDetailsAbout({currentVault}: {currentVault: TYDaemonVault}): ReactElement {
	const {token, apr} = currentVault;

	function getVaultDescription(): string {
		if (token.description) {
			return parseMarkdown(token.description);
		}
		return 'Sorry, we don\'t have a description for this asset right now. But did you know the correct word for a blob of toothpaste is a "nurdle". Fascinating! We\'ll work on updating the asset description, but at least you learnt something interesting. Catch ya later nurdles.';
	}

	return (
		<div className={'grid grid-cols-1 gap-10 p-4 md:grid-cols-12 md:p-8'}>
			<div className={'col-span-6 w-full pr-28'}>
				<div>
					<b className={'text-neutral-900'}>{'Description'}</b>
					<p
						className={'mt-4 text-neutral-900/50'}
						dangerouslySetInnerHTML={{
							__html: getVaultDescription()
						}}
					/>
				</div>
			</div>
			<div className={'col-span-6 w-full space-y-10'}>
				<div>
					<div className={'grid grid-cols-1 gap-x-12 md:grid-cols-2'}>
						<div className={'space-y-4'}>
							<b className={'text-neutral-900'}>{'APR'}</b>
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
							{apr.extra.stakingRewardsAPR > 0 && (
								<APRLineItem
									hasUpperLimit
									label={'• Staking Reward APR'}
									apyType={apr.type}
									value={apr.extra.stakingRewardsAPR}
								/>
							)}
						</div>

						<div className={'space-y-4'}>
							<b className={'text-neutral-900'}>{'Fees'}</b>
							<APRLineItem
								label={'Management fee'}
								apyType={''}
								value={apr.fees.management}
							/>
							<APRLineItem
								label={'Performance fee'}
								apyType={''}
								value={apr.fees.performance}
							/>

							{currentVault.apr.fees.keepCRV > 0 && (
								<APRLineItem
									label={'keepCRV'}
									apyType={''}
									value={currentVault.apr.fees.keepCRV}
								/>
							)}
							{currentVault.category === 'Velodrome' ||
								(currentVault.category === 'Aerodrome' && (
									<APRLineItem
										label={'KeepVELO'}
										tooltip={`Percentage of VELO locked in each harvest. This is used to boost ${currentVault.category} vault pools, and is offset via yvOP staking rewards.`}
										apyType={''}
										value={currentVault.apr.fees.keepVelo}
									/>
								))}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
