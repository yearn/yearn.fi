import React, {useMemo} from 'react';
import Link from 'next/link';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {ETH_TOKEN_ADDRESS, WETH_TOKEN_ADDRESS, WFTM_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {formatToNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {ImageWithFallback} from '@common/components/ImageWithFallback';
import {useBalance} from '@common/hooks/useBalance';
import {formatPercent, formatUSD, getVaultName} from '@common/utils';

import type {ReactElement} from 'react';
import type {TYearnVault} from '@common/types/yearn';

function	VaultsListRow({currentVault}: {currentVault: TYearnVault}): ReactElement {
	const {safeChainID} = useChainID();
	const balanceOfWant = useBalance(currentVault.token.address);
	const balanceOfCoin = useBalance(ETH_TOKEN_ADDRESS);
	const balanceOfWrappedCoin = useBalance(toAddress(currentVault.token.address) === WFTM_TOKEN_ADDRESS ? WFTM_TOKEN_ADDRESS : WETH_TOKEN_ADDRESS);
	const deposited = useBalance(currentVault.address)?.normalized;
	const vaultName = useMemo((): string => getVaultName(currentVault), [currentVault]);

	const availableToDeposit = useMemo((): number => {
		// Handle ETH native coin
		if ((toAddress(currentVault.token.address) === WETH_TOKEN_ADDRESS) || (toAddress(currentVault.token.address) === WFTM_TOKEN_ADDRESS)) {
			return (balanceOfWrappedCoin.normalized + balanceOfCoin.normalized);
		}
		return balanceOfWant.normalized;
	}, [balanceOfCoin.normalized, balanceOfWant.normalized, balanceOfWrappedCoin.normalized, currentVault.token.address]);
	
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
			<div className={'yearn--table-wrapper cursor-pointer transition-colors hover:bg-neutral-300'}>
				<div className={'yearn--table-token-section'}>
					<div className={'yearn--table-token-section-item'}>
						<div className={'yearn--table-token-section-item-image'}>
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

				<div className={'yearn--table-data-section'}>
					<div className={'yearn--table-data-section-item md:col-span-2'} datatype={'number'}>
						<label className={'yearn--table-data-section-item-label'}>{'APY'}</label>
						<b className={'yearn--table-data-section-item-value'}>
							{formatPercent((currentVault.apy?.net_apy || 0) * 100)}
						</b>
					</div>

					<div className={'yearn--table-data-section-item md:col-span-2'} datatype={'number'}>
						<label className={'yearn--table-data-section-item-label'}>{'Available'}</label>
						<p className={`yearn--table-data-section-item-value ${availableToDeposit === 0 ? 'text-neutral-400' : 'text-neutral-900'}`}>
							{formatAmount(availableToDeposit)}
						</p>
					</div>

					<div className={'yearn--table-data-section-item md:col-span-2'} datatype={'number'}>
						<label className={'yearn--table-data-section-item-label'}>{'Deposited'}</label>
						<p className={`yearn--table-data-section-item-value ${deposited === 0 ? 'text-neutral-400' : 'text-neutral-900'}`}>
							{formatAmount(deposited)}
						</p>
					</div>

					<div className={'yearn--table-data-section-item md:hidden'} datatype={'number'}>
						<label className={'yearn--table-data-section-item-label'}>{'TVL'}</label>
						<p className={'yearn--table-data-section-item-value'}>
							{formatUSD(currentVault.tvl?.tvl || 0, 0, 0)}
						</p>
					</div>

					<div className={'col-span-1 hidden h-8 flex-col items-end px-0 pt-0 md:col-span-2 md:flex md:h-14 md:pt-4'}>
						<p className={'yearn--table-data-section-item-value font-number text-end'}>
							{formatUSD(currentVault.tvl?.tvl || 0, 0, 0)}
						</p>
						<div className={'mt-1 w-2/3'}>
							<div className={'relative h-1 w-full bg-neutral-400'}>
								<div
									className={'absolute left-0 top-0 h-1 w-full bg-neutral-900'}
									style={{width: `${availableToDepositRatio}%`}} />
							</div>
						</div>
					</div>
				</div>
			</div>
		</Link>
	);
}

export {VaultsListRow};
