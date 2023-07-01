import {useMemo} from 'react';
import Link from 'next/link';
import {useStakingRewards} from '@vaults/contexts/useStakingRewards';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {ETH_TOKEN_ADDRESS, WETH_TOKEN_ADDRESS, WFTM_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {toBigInt, toNormalizedBN, toNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount, formatPercent, formatUSD} from '@yearn-finance/web-lib/utils/format.number';
import {isZero} from '@yearn-finance/web-lib/utils/isZero';
import TokenIcon from '@common/components/TokenIcon';
import {useBalance} from '@common/hooks/useBalance';
import {getVaultName} from '@common/utils';

import type {ReactElement} from 'react';
import type {TYDaemonVault} from '@common/schemas/yDaemonVaultsSchemas';

function VaultsListRow({currentVault}: {currentVault: TYDaemonVault}): ReactElement {
	const {safeChainID} = useChainID();
	const balanceOfWant = useBalance(currentVault.token.address);
	const balanceOfCoin = useBalance(ETH_TOKEN_ADDRESS);
	const balanceOfWrappedCoin = useBalance(toAddress(currentVault.token.address) === WFTM_TOKEN_ADDRESS ? WFTM_TOKEN_ADDRESS : WETH_TOKEN_ADDRESS);
	const deposited = useBalance(currentVault.address)?.normalized;
	const vaultName = useMemo((): string => getVaultName(currentVault), [currentVault]);
	const isEthMainnet = currentVault.chainID === 1;

	const {stakingRewardsByVault, positionsMap} = useStakingRewards();
	const stakedBalance = toNormalizedValue(toBigInt(positionsMap[toAddress(stakingRewardsByVault[currentVault.address])]?.stake), currentVault.decimals);
	const depositedAndStaked = deposited + stakedBalance;

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
							<TokenIcon
								chainID={currentVault.chainID}
								size={40}
								token={currentVault.token} />
						</div>
						<p>{vaultName}</p>
					</div>
				</div>

				<div className={'yearn--table-data-section'}>
					<div className={'yearn--table-data-section-item md:col-span-2'} datatype={'number'}>
						<label className={'yearn--table-data-section-item-label !font-aeonik'}>{'APY'}</label>
						<div className={'flex flex-col text-right'}>
							<b className={'yearn--table-data-section-item-value'}>
								{(currentVault.apy?.type === 'new' && isZero(currentVault.apy?.net_apy)) ? (
									'New'
								) : (
									formatPercent(((currentVault?.apy?.net_apy || 0) + (currentVault.apy?.staking_rewards_apr || 0)) * 100, 2, 2, 500)
								)}
							</b>
							<small className={'text-xs text-neutral-900'}>
								{isEthMainnet && currentVault.apy?.composite?.boost && !currentVault.apy?.staking_rewards_apr ? `BOOST ${formatAmount(currentVault.apy?.composite?.boost, 2, 2)}x` : null}
							</small>
							<small className={'text-xs text-neutral-900'}>
								{currentVault.apy?.staking_rewards_apr ? `REWARD ${formatPercent((currentVault.apy?.staking_rewards_apr || 0) * 100, 2, 2, 500)}` : null}
							</small>
						</div>
					</div>

					<div className={'yearn--table-data-section-item md:col-span-2'} datatype={'number'}>
						<label className={'yearn--table-data-section-item-label !font-aeonik'}>{'Available'}</label>
						<p className={`yearn--table-data-section-item-value ${isZero(availableToDeposit) ? 'text-neutral-400' : 'text-neutral-900'}`}>
							{formatAmount(availableToDeposit)}
						</p>
					</div>

					<div className={'yearn--table-data-section-item md:col-span-2'} datatype={'number'}>
						<label className={'yearn--table-data-section-item-label !font-aeonik'}>{'Deposited'}</label>
						<p className={`yearn--table-data-section-item-value ${isZero(depositedAndStaked) ? 'text-neutral-400' : 'text-neutral-900'}`}>
							{formatAmount(depositedAndStaked)}
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
