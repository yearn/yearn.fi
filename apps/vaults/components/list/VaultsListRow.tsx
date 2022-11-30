import React, {useMemo} from 'react';
import Link from 'next/link';
import {format, toAddress} from '@yearn-finance/web-lib/utils';
import {ImageWithFallback} from '@common/components/ImageWithFallback';
import {useWallet} from '@common/contexts/useWallet';
import {getVaultName} from '@common/utils';
import {ETH_TOKEN_ADDRESS, WETH_TOKEN_ADDRESS} from '@common/utils/constants';

import type {ReactElement} from 'react';
import type {TYearnVault} from '@common/types/yearn';

export function	HumanizeRisk({risk}: {risk: number}): ReactElement {
	if (risk === 0) {
		return <p className={'text-base'}>{'None'}</p>;
	}
	if (risk <= 1) {
		return <b className={'text-base'}>{'Low'}</b>;
	}
	if (risk <= 2) {
		return <b className={'text-base text-yellow-900'}>{'Medium'}</b>;
	}
	if (risk <= 3) {
		return <b className={'text-base text-pink-900'}>{'Severe'}</b>;
	}
	if (risk <= 4) {
		return <b className={'text-base text-pink-900'}>{'High'}</b>;
	}
	return <b className={'text-base text-red-900'}>{'Critical'}</b>;
}

function	VaultsListRow({currentVault}: {currentVault: TYearnVault}): ReactElement {
	const	{balances} = useWallet();

	const	availableToDeposit = useMemo((): number => {
		if (toAddress(currentVault.token.address) === WETH_TOKEN_ADDRESS) {
			const	ethPlusWEth = (
				(balances[WETH_TOKEN_ADDRESS]?.normalized || 0)
				+
				(balances[ETH_TOKEN_ADDRESS]?.normalized || 0)
			);
			return ethPlusWEth;
		}
		return balances[toAddress(currentVault.token.address)]?.normalized || 0;
	}, [balances, currentVault.token.address]);

	const	deposited = useMemo((): number => {
		return balances[toAddress(currentVault.address)]?.normalized || 0;
	}, [balances, currentVault.address]);

	const	vaultName = useMemo((): string => getVaultName(currentVault), [currentVault]);
	
	const	availableToDepositRatio = useMemo((): number => {
		if (currentVault.details.depositLimit === '0') {
			return 100;
		}
		const	normalizedTotalAssets = format.toNormalizedValue(currentVault.tvl.total_assets, currentVault.token.decimals);
		const	normalizedDepositLimit = format.toNormalizedValue(currentVault.details.depositLimit, currentVault.token.decimals);
		return (normalizedTotalAssets / normalizedDepositLimit * 100);
	}, [currentVault.details.depositLimit, currentVault.token.decimals, currentVault.tvl.total_assets]);

	return (
		<Link key={`${currentVault.address}`} href={`/vaults/${toAddress(currentVault.address)}`}>
			<div className={'grid w-full cursor-pointer grid-cols-1 border-t border-neutral-200 py-2 px-4 transition-colors hover:bg-neutral-300 md:grid-cols-8 md:border-none md:px-10'}>
				<div className={'col-span-3 mb-2 flex flex-row items-center justify-between py-4 md:mb-0 md:py-0'}>
					<div className={'flex flex-row items-center space-x-4 md:space-x-6'}>
						<div className={'h-8 min-h-[32px] w-8 min-w-[32px] rounded-full bg-neutral-200 md:flex md:h-10 md:w-10'}>
							<ImageWithFallback
								alt={vaultName}
								width={40}
								height={40}
								quality={90}
								src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${toAddress(currentVault.token.address)}/logo-128.png`}
								loading={'eager'} />
						</div>
						<p>{vaultName}</p>
					</div>
				</div>

				<div className={'col-span-5 grid grid-cols-1 md:grid-cols-8'}>
					<div className={'row col-span-1 flex h-8 flex-row justify-between pt-0 md:h-14 md:justify-end md:pt-4'}>
						<p className={'inline text-start text-neutral-500 md:hidden'}>{'APY'}</p>
						<b className={'text-end text-base tabular-nums text-neutral-900'}>
							{`${format.amount((currentVault.apy?.net_apy || 0) * 100, 2, 2)}%`}
						</b>
					</div>

					<div className={'row col-span-1 flex h-8 flex-row justify-between px-0 pt-0 md:col-span-2 md:h-14 md:justify-end md:px-7 md:pt-4'}>
						<p className={'inline text-start text-neutral-500 md:hidden'}>{'Available'}</p>
						<p className={`text-base tabular-nums ${availableToDeposit === 0 ? 'text-neutral-400' : 'text-neutral-900'}`}>
							{`${format.amount(availableToDeposit, 2, 2)}`}
						</p>
					</div>

					<div className={'row col-span-1 flex h-8 flex-row justify-between px-0 pt-0 md:col-span-2 md:h-14 md:justify-end md:pt-4 md:pl-7 md:pr-12'}>
						<p className={'inline text-start text-neutral-500 md:hidden'}>{'Deposited'}</p>
						<p className={`text-base tabular-nums ${deposited === 0 ? 'text-neutral-400' : 'text-neutral-900'}`}>
							{`${format.amount(deposited, 2, 2)}`}
						</p>
					</div>

					<div className={'row col-span-1 flex h-8 flex-row justify-between px-0 pt-0 md:col-span-2 md:hidden md:h-14 md:justify-end md:pt-4 md:pl-7 md:pr-12'}>
						<p className={'inline text-start text-neutral-500 md:hidden'}>{'TVL'}</p>
						<p className={'text-end text-base tabular-nums text-neutral-900'}>
							{`$ ${format.amount(currentVault.tvl?.tvl || 0, 0, 0)}`}
						</p>
					</div>

					<div className={'col-span-1 hidden h-8 flex-col items-end px-0 pt-0 md:col-span-2 md:flex md:h-14 md:px-7 md:pt-4'}>
						<p className={'text-base tabular-nums text-neutral-900'}>
							{`$ ${format.amount(currentVault.tvl?.tvl || 0, 0, 0)}`}
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
							{format.amount(currentVault.safetyScore, 2, 2)}
						</div>
					</div>
				</div>
			</div>
		</Link>
	);
}

export {VaultsListRow};
