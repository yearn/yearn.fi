import {useMemo} from 'react';
import Link from 'next/link';
import {useStakingRewards} from '@vaults/contexts/useStakingRewards';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {ETH_TOKEN_ADDRESS, WETH_TOKEN_ADDRESS, WFTM_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {toBigInt} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount, formatPercent} from '@yearn-finance/web-lib/utils/format.number';
import {isZero} from '@yearn-finance/web-lib/utils/isZero';
import {ImageWithFallback} from '@common/components/ImageWithFallback';
import {useBalance} from '@common/hooks/useBalance';
import {getVaultName} from '@common/utils';
import {RenderAmount} from '@common/utils/format';

import type {ReactElement} from 'react';
import type {TYDaemonVault} from '@common/schemas/yDaemonVaultsSchemas';

function VaultsListRow({currentVault}: {currentVault: TYDaemonVault}): ReactElement {
	const {safeChainID} = useChainID();
	const balanceOfWant = useBalance(currentVault.token.address);
	const balanceOfCoin = useBalance(ETH_TOKEN_ADDRESS);
	const balanceOfWrappedCoin = useBalance(toAddress(currentVault.token.address) === WFTM_TOKEN_ADDRESS ? WFTM_TOKEN_ADDRESS : WETH_TOKEN_ADDRESS);
	const vaultName = useMemo((): string => getVaultName(currentVault), [currentVault]);
	const isEthMainnet = currentVault.chainID === 1;
	const deposited = useBalance(currentVault.address)?.raw;
	const {stakingRewardsByVault, positionsMap} = useStakingRewards();

	const availableToDeposit = useMemo((): bigint => {
		if (toAddress(currentVault.token.address) === WETH_TOKEN_ADDRESS) { // Handle ETH native coin
			return (balanceOfWrappedCoin.raw + balanceOfCoin.raw);
		}
		if (toAddress(currentVault.token.address) === WFTM_TOKEN_ADDRESS) { // Handle FTM native coin
			return (balanceOfWrappedCoin.raw + balanceOfCoin.raw);
		}
		return balanceOfWant.raw;
	}, [balanceOfCoin.raw, balanceOfWant.raw, balanceOfWrappedCoin.raw, currentVault.token.address]);

	const staked = useMemo((): bigint => {
		const stakedBalance = toBigInt(positionsMap[toAddress(stakingRewardsByVault[currentVault.address])]?.stake);
		const depositedAndStaked = deposited + stakedBalance;
		return depositedAndStaked;
	}, [currentVault.address, deposited, positionsMap, stakingRewardsByVault]);

	return (
		<Link key={`${currentVault.address}`} href={`/vaults/${safeChainID}/${toAddress(currentVault.address)}`}>
			<div className={'yearn--table-wrapper cursor-pointer transition-colors hover:bg-neutral-300'}>
				<div className={'yearn--table-token-section'}>
					<div className={'yearn--table-token-section-item'}>
						<div className={'yearn--table-token-section-item-image'}>
							<ImageWithFallback
								src={`${process.env.BASE_YEARN_ASSETS_URI}/${currentVault.chainID}/${currentVault.token.address}/logo-128.png`}
								alt={`${process.env.BASE_YEARN_ASSETS_URI}/${currentVault.chainID}/${currentVault.token.address}/logo-128.png`}
								width={40}
								height={40} />
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
							<RenderAmount
								value={availableToDeposit}
								symbol={currentVault.token.symbol}
								decimals={currentVault.token.decimals}
								options={{shouldDisplaySymbol: false}} />
						</p>
					</div>

					<div className={'yearn--table-data-section-item md:col-span-2'} datatype={'number'}>
						<label className={'yearn--table-data-section-item-label !font-aeonik'}>{'Deposited'}</label>
						<p className={`yearn--table-data-section-item-value ${isZero(staked) ? 'text-neutral-400' : 'text-neutral-900'}`}>
							<RenderAmount
								value={staked}
								symbol={currentVault.token.symbol}
								decimals={currentVault.token.decimals}
								options={{shouldDisplaySymbol: false}} />
						</p>
					</div>

					<div className={'yearn--table-data-section-item md:col-span-2'} datatype={'number'}>
						<label className={'yearn--table-data-section-item-label !font-aeonik'}>{'TVL'}</label>
						<p className={'yearn--table-data-section-item-value'}>
							<RenderAmount
								value={currentVault.tvl?.tvl}
								symbol={'USD'}
								decimals={0}
								options={{
									shouldCompactValue: false,
									maximumFractionDigits: 0,
									minimumFractionDigits: 0
								}} />
						</p>
					</div>
				</div>
			</div>
		</Link>
	);
}

export {VaultsListRow};
