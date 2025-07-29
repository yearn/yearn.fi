import {cl, formatAmount, formatPercent} from '@lib/utils';
import {parseMarkdown} from '@lib/utils/helpers';

import type {ReactElement} from 'react';
import type {TYDaemonVault} from '@lib/utils/schemas/yDaemonVaultsSchemas';

export function YearnFeesLineItem({children, label, tooltip}: any): ReactElement {
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

export function VaultDetailsAbout({currentVault}: {currentVault: TYDaemonVault}): ReactElement {
	const {token, apr} = currentVault;

	function getVaultDescription(): string {
		if (currentVault.description) {
			return parseMarkdown(currentVault.description.replaceAll('{{token}}', currentVault.token.symbol));
		}
		if (token.description) {
			return parseMarkdown(token.description.replaceAll('{{token}}', currentVault.token.symbol));
		}
		return (
		  <>
		    Sorry, we don't have a description for this vault right now. To learn more about how Yearn Vaults work, check out our{' '}
		    <a href="https://docs.yearn.fi" target="_blank" rel="noopener noreferrer">docs</a>, or if you want to learn more about this vault, head to our{' '}
		    <a href="https://discord.gg/yearn" target="_blank" rel="noopener noreferrer">discord</a> or{' '}
		    <a href="https://t.me/yearnfinance" target="_blank" rel="noopener noreferrer">telegram</a> and ask.
		  </>
		);
	}

	return (
		<div className={'grid grid-cols-1 gap-4 p-4 md:grid-cols-12 md:gap-10 md:p-8'}>
			<div className={'col-span-12 w-full pr-0 md:col-span-7 md:pr-28'}>
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

			<div className={'col-span-12 mt-6 w-full space-y-10 md:col-span-5 md:mt-0'}>
				<div className={'grid grid-cols-1 gap-x-12 md:grid-cols-1'}>
					<div className={'mb-4 md:mb-10'}>
						<b className={'text-neutral-900'}>{'APY'}</b>
						<div className={'mt-4 grid grid-cols-3 gap-8'}>
							<YearnFeesLineItem label={'Last 7 days'}>
								<b className={'font-number text-xl text-neutral-900'}>
									{apr.type.includes('new') ? 'New' : formatPercent(apr.points.weekAgo * 100, 0)}
								</b>
							</YearnFeesLineItem>
							<YearnFeesLineItem label={'Last 30 days'}>
								<b className={'font-number text-xl text-neutral-900'}>
									{apr.type.includes('new') ? '-' : formatPercent(apr.points.monthAgo * 100, 0)}
								</b>
							</YearnFeesLineItem>

							<YearnFeesLineItem label={'Inception'}>
								<b className={'font-number text-xl text-neutral-900'}>
									{apr.type.includes('new') ? '-' : formatPercent(apr.points.inception * 100, 0)}
								</b>
							</YearnFeesLineItem>
						</div>
					</div>
					<div>
						<b className={'text-neutral-900'}>{'Fees'}</b>
						<div className={'mt-4 grid grid-cols-4 gap-8'}>
							<YearnFeesLineItem label={'Management'}>
								<b className={'font-number text-xl text-neutral-900'}>
									{formatPercent((apr.fees.management || 0) * 100, 0)}
								</b>
							</YearnFeesLineItem>
							<YearnFeesLineItem label={'Performance'}>
								<b className={'font-number text-xl text-neutral-900'}>
									{formatPercent((apr.fees.performance || 0) * 100, 0)}
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
				</div>
			</div>
		</div>
	);
}
