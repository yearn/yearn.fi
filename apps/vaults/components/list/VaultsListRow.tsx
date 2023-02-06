import React, {useMemo} from 'react';
import Link from 'next/link';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {ETH_TOKEN_ADDRESS, WETH_TOKEN_ADDRESS, WFTM_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
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
		if (toAddress(currentVault.token.address) === WETH_TOKEN_ADDRESS) {
			return (balanceOfWrappedCoin.normalized + balanceOfCoin.normalized);
		}
		if (toAddress(currentVault.token.address) === WFTM_TOKEN_ADDRESS) {
			return (balanceOfWrappedCoin.normalized + Number(toNormalizedBN(balanceOfCoin.raw, 18).normalized));
		}
		return balanceOfWant.normalized;
	}, [balanceOfCoin.normalized, balanceOfCoin.raw, balanceOfWant.normalized, balanceOfWrappedCoin.normalized, currentVault.token.address]);

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
						<label className={'yearn--table-data-section-item-label !font-aeonik'}>{'APY'}</label>
						<div className={'flex flex-col text-right'}>
							<b className={'yearn--table-data-section-item-value'}>
								{(currentVault.apy?.type === 'new' && currentVault.apy?.net_apy == 0) ? (
									'New'
								) : (currentVault.apy?.net_apy || 0) > 5 ? (
									`≧ ${formatPercent(500)}`
								) : (
									formatPercent((currentVault.apy?.net_apy || 0) * 100)
								)}
							</b>
							<small className={'text-xs text-neutral-900'}>
								{currentVault.apy?.composite?.boost ? `BOOST ${formatAmount(currentVault.apy?.composite?.boost, 2, 2)}x` : null}
							</small>
						</div>
					</div>

					<div className={'yearn--table-data-section-item md:col-span-2'} datatype={'number'}>
						<label className={'yearn--table-data-section-item-label !font-aeonik'}>{'Available'}</label>
						<p className={`yearn--table-data-section-item-value ${availableToDeposit === 0 ? 'text-neutral-400' : 'text-neutral-900'}`}>
							{formatAmount(availableToDeposit)}
						</p>
					</div>

					<div className={'yearn--table-data-section-item md:col-span-2'} datatype={'number'}>
						<label className={'yearn--table-data-section-item-label !font-aeonik'}>{'Deposited'}</label>
						<p className={`yearn--table-data-section-item-value ${deposited === 0 ? 'text-neutral-400' : 'text-neutral-900'}`}>
							{formatAmount(deposited)}
						</p>
					</div>

					<div className={'yearn--table-data-section-item md:col-span-2'} datatype={'number'}>
						<label className={'yearn--table-data-section-item-label !font-aeonik'}>{'TVL'}</label>
						<p className={'yearn--table-data-section-item-value'}>
							{formatUSD(currentVault.tvl?.tvl || 0, 0, 0)}
						</p>
					</div>
				</div>
			</div>
		</Link>
	);
}

export {VaultsListRow};
