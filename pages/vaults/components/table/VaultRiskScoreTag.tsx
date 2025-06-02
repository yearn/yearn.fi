import {cl} from '@builtbymom/web3/utils';

import type {FC} from 'react';

export const VaultRiskScoreTag: FC<{riskLevel: number}> = ({riskLevel}) => {
	const level = riskLevel < 0 ? 0 : riskLevel > 5 ? 5 : riskLevel;
	const riskColor = [`transparent`, `#63C532`, `#F8A908`, `#F8A908`, `#C73203`, `#C73203`];
	return (
		<div className={'md:justify-centere col-span-3 flex flex-row items-end justify-between md:flex-col md:pt-4'}>
			<p className={'inline whitespace-nowrap text-start text-xs text-neutral-800/60 md:hidden'}>
				{'Risk Score'}
			</p>
			<div
				className={cl(
					'flex w-fit items-center justify-end gap-4 md:justify-center',
					'tooltip relative z-50 h-6'
				)}>
				<div
					className={'h-3 w-10 min-w-10 rounded-sm border border-neutral-300 p-[2px]'}
					style={{borderWidth: '1px'}}>
					<div
						className={'h-1.5 rounded-[1px]'}
						style={{
							backgroundColor: riskColor.length > level ? riskColor[level] : riskColor[0],
							width: `${(level / 5) * 100}%`
						}}
					/>
				</div>
				<span
					suppressHydrationWarning
					className={'tooltiptext top-full mt-1'}
					style={{marginRight: 'calc(-94px + 50%)'}}>
					<div
						className={
							'font-number relative border border-neutral-300 bg-neutral-100 p-1 px-2 text-center text-xxs text-neutral-900'
						}>
						<p>
							<b className={'text-xs font-semibold'}>{`${level} / 5 :`}</b>
							{` This reflects the vault's security, with 1 being most secure and 5 least secure, based on strategy complexity, loss exposure, and external dependencies.`}
						</p>
					</div>
				</span>
			</div>
		</div>
	);
};
