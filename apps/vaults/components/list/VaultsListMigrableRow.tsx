import React, {useMemo, useState} from 'react';
import {ethers} from 'ethers';
import {useMigrableWallet} from '@vaults/contexts/useMigrableWallet';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {ETH_TOKEN_ADDRESS, WETH_TOKEN_ADDRESS, WFTM_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {formatToNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {defaultTxStatus, Transaction} from '@yearn-finance/web-lib/utils/web3/transaction';
import {ImageWithFallback} from '@common/components/ImageWithFallback';
import {formatPercent, getVaultName} from '@common/utils';
import {approveERC20, isApprovedERC20} from '@common/utils/actions/approveToken';
import {migrateShares} from '@common/utils/actions/migrateShares';

import type {ReactElement} from 'react';
import type {TYearnVault} from '@common/types/yearn';

function	VaultsListMigrableRow({currentVault}: {currentVault: TYearnVault}): ReactElement {
	const {isActive, provider} = useWeb3();
	const {balances, refresh} = useMigrableWallet();
	const {safeChainID} = useChainID();
	const [txStatus, set_txStatus] = useState(defaultTxStatus);

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

	async function onMigrateFlow(): Promise<void> {
		const	isApproved = await isApprovedERC20(
			provider as ethers.providers.Web3Provider, 
			toAddress(currentVault.address), //from
			toAddress(currentVault.migration.contract), //migrator
			balances[toAddress(currentVault.address)]?.raw || ethers.constants.Zero
		);

		if (isApproved) {
			new Transaction(provider, migrateShares, set_txStatus).populate(
				toAddress(currentVault.migration.contract), //migrator
				toAddress(currentVault.address), //from
				toAddress(currentVault.migration.address) //to
			).onSuccess(async (): Promise<void> => {
				await refresh();
			}).perform();
		} else {
			new Transaction(provider, approveERC20, set_txStatus).populate(
				toAddress(currentVault.address), //from
				toAddress(currentVault.migration.contract), //migrator
				ethers.constants.MaxUint256 //amount
			).onSuccess(async (): Promise<void> => {
				await onMigrateFlow();
			}).perform();
		}
	}

	return (
		<button onClick={onMigrateFlow}>
			<div className={'yearn--table-wrapper'}>
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
							{formatPercent(0)}
						</b>
					</div>

					<div className={'yearn--table-data-section-item md:col-span-2'} datatype={'number'}>
						<label className={'yearn--table-data-section-item-label'}>{'Available'}</label>
						<p className={`yearn--table-data-section-item-value ${availableToDeposit === 0 ? 'text-neutral-400' : 'text-neutral-900'}`}>
							{formatAmount(0)}
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
							{`$ ${formatAmount(currentVault.tvl?.tvl || 0, 0, 0)}`}
						</p>
					</div>

					<div className={'col-span-1 hidden h-8 flex-col items-end px-0 pt-0 md:col-span-2 md:flex md:h-14 md:pt-4'}>
						<p className={'yearn--table-data-section-item-value'}>
							{`$ ${formatAmount(currentVault.tvl?.tvl || 0, 0, 0)}`}
						</p>
						<div className={'relative mt-1 h-1 w-full bg-neutral-400'}>
							<div
								className={'absolute left-0 top-0 h-1 w-full bg-neutral-900'}
								style={{width: formatPercent(availableToDepositRatio)}} />
						</div>
					</div>

					<div className={'col-span-1 flex h-8 flex-row items-center justify-between md:h-14 md:justify-end'}>
						<Button
							className={'yearn--button-smaller !w-full'}
							isBusy={txStatus.pending}
							isDisabled={!isActive}>
							{'Migrate'}
						</Button>
					</div>
				</div>
			</div>
		</button>
	);
}

export {VaultsListMigrableRow};
