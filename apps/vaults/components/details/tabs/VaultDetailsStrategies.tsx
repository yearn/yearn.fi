import React, {useMemo} from 'react';
import dynamic from 'next/dynamic';
import IconCopy from '@yearn-finance/web-lib/icons/IconCopy';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {formatBN, formatToNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {formatDuration} from '@yearn-finance/web-lib/utils/format.time';
import {copyToClipboard, parseMarkdown} from '@yearn-finance/web-lib/utils/helpers';
import IconChevron from '@common/icons/IconChevron';
import {formatPercent} from '@common/utils';

import type {LoaderComponent} from 'next/dynamic';
import type {ReactElement} from 'react';
import type {TYearnVault, TYearnVaultStrategy} from '@common/types/yearn';
import type {TGraphForStrategyReportsProps} from '@vaults/components/graphs/GraphForStrategyReports';

const GraphForStrategyReports = dynamic<TGraphForStrategyReportsProps>(async (): LoaderComponent<TGraphForStrategyReportsProps> => import('@vaults/components/graphs/GraphForStrategyReports'), {ssr: false});

type TRiskScoreElementProps = {
	label: string;
	value: number;
};
function	RiskScoreElement({label, value}: TRiskScoreElementProps): ReactElement {
	return (
		<div className={'flex flex-row items-center justify-between'}>
			<p className={'text-sm text-neutral-500'}>{label}</p>
			<p className={'font-number text-sm text-neutral-900'}>{value}</p>
		</div>
	);
}

function	VaultDetailsStrategy({currentVault, strategy}: {currentVault: TYearnVault, strategy: TYearnVaultStrategy}): ReactElement {
	const	riskScoreElementsMap = useMemo((): TRiskScoreElementProps[] => {
		const {riskDetails} = strategy?.risk || {};
		return ([
			{label: 'TVL Impact', value: riskDetails?.TVLImpact || 0},
			{label: 'Audit Score', value: riskDetails?.auditScore || 0},
			{label: 'Code Review Score', value: riskDetails?.codeReviewScore || 0},
			{label: 'Complexity Score', value: riskDetails?.complexityScore || 0},
			{label: 'Longevity Impact', value: riskDetails?.longevityImpact || 0},
			{label: 'Protocol Safety Score', value: riskDetails?.protocolSafetyScore || 0},
			{label: 'Team Knowledge Score', value: riskDetails?.teamKnowledgeScore || 0},
			{label: 'Testing Score', value: riskDetails?.testingScore || 0}
		]);
	}, [strategy]);

	return (
		<details className={'p-0'}>
			<summary>
				<div>
					<b className={'text-neutral-900'}>{strategy.name}</b>
				</div>
				<div>
					<IconChevron className={'summary-chevron'} />
				</div>
			</summary>

			<div className={'bg-neutral-100 px-4 md:px-6'}>
				<div className={'mb-6 -mt-6 w-full space-y-6'}>
					<div>
						<div className={'flex flex-row items-center justify-start space-x-2 pb-4'}>
							<p className={'text-xxs text-neutral-900 md:text-xs'}>{toAddress(strategy.address)}</p>
							<button onClick={(): void => copyToClipboard(strategy.address)} className={'cursor-copy'}>
								<IconCopy className={'h-4 w-4 text-neutral-600 transition-colors hover:text-neutral-900'} />
							</button>
						</div>
						<p
							className={'text-neutral-600'}
							dangerouslySetInnerHTML={{__html: parseMarkdown(strategy.description.replaceAll('{{token}}', currentVault.token.symbol))}} />
						<p className={'text-neutral-600'}>{`Last report ${formatDuration((strategy?.details?.lastReport * 1000) - new Date().valueOf(), true)}.`}</p>
					</div>
				</div>

				<div className={'grid grid-cols-12 gap-4 pb-8 md:gap-10 lg:gap-24'}>
					<div className={'col-span-12 w-full space-y-4 md:col-span-6'}>
						<div className={'grid grid-cols-4 gap-4'}>
							<div className={'col-span-2 flex flex-col space-y-2 bg-neutral-200 p-2 md:p-4'}>
								<p className={'text-base text-neutral-600'}>
									{'Capital Allocation'}
								</p>
								<b className={'font-number text-lg text-neutral-900'}>
									{`${formatAmount(formatToNormalizedValue(formatBN(strategy?.details?.totalDebt), currentVault?.decimals), 0, 0)} ${currentVault.token.symbol}`}
								</b>
							</div>

							<div className={'col-span-2 flex flex-col space-y-2 bg-neutral-200 p-2 md:p-4'}>
								<p className={'text-base text-neutral-600'}>{'Total Gain'}</p>
								<b className={'font-number text-lg text-neutral-900'}>
									{`${formatAmount(formatToNormalizedValue(
										formatBN(strategy?.details?.totalGain).sub(formatBN(strategy?.details?.totalLoss)),
										currentVault?.decimals
									), 0, 0)} ${currentVault.token.symbol}`}
								</b>
							</div>
						</div>

						<div className={'flex flex-col space-y-4 bg-neutral-200 p-2 md:p-4'}>
							<p className={'text-base text-neutral-600'}>{'Risk score'}</p>
							<div className={'mt-0 grid grid-cols-1 gap-x-12 gap-y-2 md:grid-cols-2'}>
								{riskScoreElementsMap.map(({label, value}): ReactElement => (
									<RiskScoreElement
										key={label}
										label={label}
										value={value} />
								))}
							</div>
						</div>
					</div>
					<div className={'col-span-12 flex h-full w-full flex-col justify-between md:col-span-6'}>
						<div className={'grid grid-cols-6 gap-6 md:gap-8'}>
							<div className={'col-span-2 flex flex-col space-y-0 md:space-y-2'}>
								<p className={'text-xxs text-neutral-600 md:text-xs'}>{'APR'}</p>
								<b className={'font-number text-xl text-neutral-900'}>
									{formatPercent((strategy?.details?.apr || 0), 0)}
								</b>
							</div>

							<div className={'col-span-2 flex flex-col space-y-0 md:space-y-2'}>
								<p className={'text-xxs text-neutral-600 md:text-xs'}>
									{'Allocation'}
								</p>
								<b className={'font-number text-xl text-neutral-900'}>
									{formatPercent((strategy?.details?.debtRatio || 0) / 100, 0)}
								</b>
							</div>

							<div className={'col-span-2 flex flex-col space-y-0 md:space-y-2'}>
								<p className={'text-xxs text-neutral-600 md:text-xs'}>{'Perfomance fee'}</p>
								<b className={'font-number text-xl text-neutral-600'}>
									{formatPercent((strategy?.details?.performanceFee || 0) * 100, 0)}
								</b>
							</div>
						</div>

						<div className={'mt-auto pt-8'}>
							<p className={'text-neutral-600'}>{'Historical APR'}</p>
							<div className={'mt-4 flex flex-row border-b border-l border-neutral-300'}>
								<GraphForStrategyReports
									vaultDecimals={currentVault.decimals}
									vaultTicker={currentVault?.token?.symbol || 'token'}
									strategy={strategy} />
							</div>
						</div>
					</div>
				</div>
			</div>
		</details>	
	);
}

function	VaultDetailsStrategies({currentVault}: {currentVault: TYearnVault}): ReactElement {
	return (
		<div className={'grid grid-cols-1 bg-neutral-100'}>
			<div className={'col-span-1 w-full space-y-6 p-4 md:p-6'}>
				<div>
					<p className={'text-neutral-600'}>
						{'Strategies are the ways in which each Yearn Vault puts your assets to work within the DeFi ecosystem, returning the earned yield back to you.'}
					</p>
					<p className={'text-neutral-600'}>
						{'Vaults often have multiple strategies, which each go through comprehensive peer reviews and audits before being deployed.'}
					</p>
				</div>
			</div>
			<div className={'col-span-1 w-full border-t border-neutral-300'}>
				{(currentVault?.strategies || [])
					// .filter((strategy): boolean => (strategy?.details?.debtRatio || 0) > 0)
					.sort((a, b): number => (b?.details?.debtRatio || 0) - (a?.details?.debtRatio || 0))
					.map((strategy, index): ReactElement => (
						<VaultDetailsStrategy
							currentVault={currentVault}
							strategy={strategy}
							key={index} />
					))}
			</div>
		</div>
	);
}

export {VaultDetailsStrategies};
