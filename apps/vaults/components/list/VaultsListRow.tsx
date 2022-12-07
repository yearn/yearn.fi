import React, {useMemo} from 'react';
import Link from 'next/link';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {ETH_TOKEN_ADDRESS, WETH_TOKEN_ADDRESS, WFTM_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {formatToNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {ImageWithFallback} from '@common/components/ImageWithFallback';
import {useWallet} from '@common/contexts/useWallet';
import {getVaultName} from '@common/utils';

import type {ReactElement} from 'react';
import type {TYearnVault} from '@common/types/yearn';

function	HumanizeRisk({risk}: {risk: number}): ReactElement {
	if (risk < 2) {
		return <span className={'text-neutral-600'}>{'Low'}</span>;
	} else if (risk < 4) {
		return <span className={'text-neutral-600'}>{'Medium'}</span>;
	} else {
		return <span className={'text-neutral-600'}>{'High'}</span>;
	}
}

function	VaultsListRow({currentVault}: {currentVault: TYearnVault}): ReactElement {
	const {balances} = useWallet();
	const {safeChainID} = useChainID();

	const availableToDeposit = useMemo((): number => {
		// Handle ETH native coin
		if (toAddress(currentVault.token.address) === WETH_TOKEN_ADDRESS) {
			const	ethPlusWEth = (
				(balances[WETH_TOKEN_ADDRESS]?.normalized || 0)
				+
				(balances[ETH_TOKEN_ADDRESS]?.normalized || 0)
			);
			return ethPlusWEth;
		}
		
		// Handle FTM native coin
		if (toAddress(currentVault.token.address) === WFTM_TOKEN_ADDRESS) {
			const	ftmPlusWFtm = (
				(balances[WFTM_TOKEN_ADDRESS]?.normalized || 0)
				+
				(balances[ETH_TOKEN_ADDRESS]?.normalized || 0)
			);
			return ftmPlusWFtm;
		}
		return balances[toAddress(currentVault.token.address)]?.normalized || 0;
	}, [balances, currentVault.token.address]);

	const deposited = useMemo((): number => {
		return balances[toAddress(currentVault.address)]?.normalized || 0;
	}, [balances, currentVault.address]);

	const vaultName = useMemo((): string => getVaultName(currentVault), [currentVault]);
	
	const availableToDepositRatio = useMemo((): number => {
		if (currentVault.details.depositLimit === '0') {
			return 100;
		}
		const	normalizedTotalAssets = formatToNormalizedValue(currentVault.tvl.total_assets, currentVault.token.decimals);
		const	normalizedDepositLimit = formatToNormalizedValue(currentVault.details.depositLimit, currentVault.token.decimals);
		return (normalizedTotalAssets / normalizedDepositLimit * 100);
	}, [currentVault.details.depositLimit, currentVault.token.decimals, currentVault.tvl.total_assets]);

	return (
		<Link key={`${currentVault.address}`} href={`/vaults/${safeChainID}/${toAddress(currentVault.address)}`}>
			<div className={'grid w-full cursor-pointer grid-cols-1 border-t border-neutral-200 py-2 px-4 transition-colors hover:bg-neutral-300 md:grid-cols-8 md:border-none md:px-10'}>
				<div className={'col-span-3 mb-2 flex flex-row items-center justify-between py-4 md:mb-0 md:py-0'}>
					<div className={'flex flex-row items-center space-x-4 md:space-x-6'}>
						<div className={'h-8 min-h-[32px] w-8 min-w-[32px] rounded-full bg-neutral-200 md:flex md:h-10 md:w-10'}>
							<ImageWithFallback
								alt={vaultName}
								width={40}
								height={40}
								quality={90}
								src={`${process.env.BASE_YEARN_ASSETS_URI}/${safeChainID}/${toAddress(currentVault.token.address)}/logo-128.png`}
								loading={'eager'} />
						</div>
						<p>{vaultName}</p>
					</div>
				</div>

				<div className={'col-span-5 grid grid-cols-1 md:grid-cols-8'}>
					<div className={'row col-span-1 flex h-8 flex-row justify-between pt-0 md:h-14 md:justify-end md:pt-4'}>
						<p className={'inline text-start text-neutral-500 md:hidden'}>{'APY'}</p>
						<b className={'text-end text-base tabular-nums text-neutral-900'}>
							{`${formatAmount((currentVault.apy?.net_apy || 0) * 100, 2, 2)}%`}
						</b>
					</div>

					<div className={'row col-span-1 flex h-8 flex-row justify-between px-0 pt-0 md:col-span-2 md:h-14 md:justify-end md:px-7 md:pt-4'}>
						<p className={'inline text-start text-neutral-500 md:hidden'}>{'Available'}</p>
						<p className={`text-base tabular-nums ${availableToDeposit === 0 ? 'text-neutral-400' : 'text-neutral-900'}`}>
							{`${formatAmount(availableToDeposit, 2, 2)}`}
						</p>
					</div>

					<div className={'row col-span-1 flex h-8 flex-row justify-between px-0 pt-0 md:col-span-2 md:h-14 md:justify-end md:pt-4 md:pl-7 md:pr-12'}>
						<p className={'inline text-start text-neutral-500 md:hidden'}>{'Deposited'}</p>
						<p className={`text-base tabular-nums ${deposited === 0 ? 'text-neutral-400' : 'text-neutral-900'}`}>
							{`${formatAmount(deposited, 2, 2)}`}
						</p>
					</div>

					<div className={'row col-span-1 flex h-8 flex-row justify-between px-0 pt-0 md:col-span-2 md:hidden md:h-14 md:justify-end md:pt-4 md:pl-7 md:pr-12'}>
						<p className={'inline text-start text-neutral-500 md:hidden'}>{'TVL'}</p>
						<p className={'text-end text-base tabular-nums text-neutral-900'}>
							{`$ ${formatAmount(currentVault.tvl?.tvl || 0, 0, 0)}`}
						</p>
					</div>

					<div className={'col-span-1 hidden h-8 flex-col items-end px-0 pt-0 md:col-span-2 md:flex md:h-14 md:px-7 md:pt-4'}>
						<p className={'text-base tabular-nums text-neutral-900'}>
							{`$ ${formatAmount(currentVault.tvl?.tvl || 0, 0, 0)}`}
						</p>
						<div className={'relative mt-1 h-1 w-full bg-neutral-400'}>
							<div
								className={'absolute left-0 top-0 h-1 w-full bg-neutral-900'}
								style={{width: `${availableToDepositRatio}%`}} />
						</div>
					</div>

					<div className={'col-span-1 flex h-8 flex-row items-center justify-between md:h-14 md:justify-end'}>
						<p className={'inline text-start text-neutral-500 md:hidden'}>{'Risk'}</p>
						<div className={'flex flex-row space-x-4'}>
							<HumanizeRisk risk={currentVault.riskScore} />
						</div>
					</div>
				</div>
			</div>
		</Link>
	);
}

export {VaultsListRow};
