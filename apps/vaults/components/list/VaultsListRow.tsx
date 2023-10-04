import {useMemo} from 'react';
import Link from 'next/link';
import {useStakingRewards} from '@vaults/contexts/useStakingRewards';
import {Renderable} from '@yearn-finance/web-lib/components/Renderable';
import {IconArbitrumChain} from '@yearn-finance/web-lib/icons/chains/IconArbitrumChain';
import {IconBaseChain} from '@yearn-finance/web-lib/icons/chains/IconBaseChain';
import {IconEtherumChain} from '@yearn-finance/web-lib/icons/chains/IconEtherumChain';
import {IconFantomChain} from '@yearn-finance/web-lib/icons/chains/IconFantomChain';
import {IconOptimismChain} from '@yearn-finance/web-lib/icons/chains/IconOptimismChain';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {ETH_TOKEN_ADDRESS, WETH_TOKEN_ADDRESS, WFTM_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {toBigInt} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {isZero} from '@yearn-finance/web-lib/utils/isZero';
import {ImageWithFallback} from '@common/components/ImageWithFallback';
import {RenderAmount} from '@common/components/RenderAmount';
import {useBalance} from '@common/hooks/useBalance';
import {getVaultName} from '@common/utils';

import type {ReactElement} from 'react';
import type {TYDaemonVault} from '@common/schemas/yDaemonVaultsSchemas';

export const ChainIconMap = new Map<number, ReactElement>([
	[1, <IconEtherumChain />],
	[10, <IconOptimismChain />],
	[250, <IconFantomChain />],
	[8453, <IconBaseChain />],
	[42161, <IconArbitrumChain />]
]);

export function VaultAPR({currentVault}: {currentVault: TYDaemonVault}): ReactElement {
	const isEthMainnet = currentVault.chainID === 1;

	if (currentVault.apy?.staking_rewards_apr > 0) {
		const boostedAPR = currentVault.apy.staking_rewards_apr + currentVault.apy.gross_apr;
		return (
			<div className={'flex flex-col text-right'}>
				<span className={'tooltip'}>
					<b className={'yearn--table-data-section-item-value'}>
						<Renderable
							shouldRender={!(currentVault.apy?.type === 'new' && isZero(boostedAPR))}
							fallback={'New'}>
							{'⚡️ '}
							<RenderAmount
								value={boostedAPR}
								symbol={'percent'}
								decimals={6}
							/>
						</Renderable>
					</b>
					<span className={'tooltipLight bottom-full mb-1'}>
						<div className={'font-number w-fit border border-neutral-300 bg-neutral-100 p-1 px-2 text-center text-xxs text-neutral-900'}>
							<div className={'flex flex-col items-start justify-start text-left'}>
								<div className={'font-number flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-400 md:text-xs'}>
									<p>{'• Base APR '}</p>
									<RenderAmount
										value={currentVault.apy?.gross_apr}
										symbol={'percent'}
										decimals={6}
									/>
								</div>

								<div className={'font-number flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-400 md:text-xs'}>
									<p>{'• Rewards APR '}</p>
									<RenderAmount
										value={currentVault.apy?.staking_rewards_apr}
										symbol={'percent'}
										decimals={6}
									/>
								</div>
							</div>
						</div>
					</span>
				</span>
			</div>
		);
	}

	if (isEthMainnet && currentVault.apy?.composite?.boost > 0 && !currentVault.apy?.staking_rewards_apr) {
		const unBoostedAPR = currentVault.apy.gross_apr / currentVault.apy.composite.boost;
		return (
			<span className={'tooltip'}>
				<div className={'flex flex-col text-right'}>
					<b className={'yearn--table-data-section-item-value'}>
						<Renderable
							shouldRender={!(currentVault.apy?.type === 'new' && isZero(currentVault.apy?.net_apy))}
							fallback={'New'}>
							<RenderAmount
								value={currentVault.apy?.net_apy}
								symbol={'percent'}
								decimals={6}
							/>
						</Renderable>
					</b>
					<small className={'text-xs text-neutral-900'}>
						<Renderable shouldRender={isEthMainnet && currentVault.apy?.composite?.boost > 0 && !currentVault.apy?.staking_rewards_apr}>
							{`BOOST ${formatAmount(currentVault.apy?.composite?.boost, 2, 2)}x`}
						</Renderable>
					</small>
					<span className={'tooltipLight bottom-full mb-1'}>
						<div className={'font-number w-fit border border-neutral-300 bg-neutral-100 p-1 px-2 text-center text-xxs text-neutral-900'}>
							<div className={'flex flex-col items-start justify-start text-left'}>
								<div className={'font-number flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-400 md:text-xs'}>
									<p>{'• Base APR '}</p>
									<RenderAmount
										value={unBoostedAPR}
										symbol={'percent'}
										decimals={6}
									/>
								</div>

								<div className={'font-number flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-400 md:text-xs'}>
									<p>{'• Boost '}</p>
									<p>{`${formatAmount(currentVault.apy?.composite?.boost, 2, 2)} x`}</p>
								</div>
							</div>
						</div>
					</span>
				</div>
			</span>
		);
	}

	return (
		<div className={'flex flex-col text-right'}>
			<b className={'yearn--table-data-section-item-value'}>
				<Renderable
					shouldRender={!(currentVault.apy?.type === 'new' && isZero(currentVault.apy?.net_apy))}
					fallback={'New'}>
					<RenderAmount
						value={currentVault.apy?.net_apy}
						symbol={'percent'}
						decimals={6}
					/>
				</Renderable>
			</b>
		</div>
	);
}

export function VaultsListRow({currentVault}: {currentVault: TYDaemonVault}): ReactElement {
	const balanceOfWant = useBalance({chainID: currentVault.chainID, address: currentVault.token.address});
	const balanceOfCoin = useBalance({chainID: currentVault.chainID, address: ETH_TOKEN_ADDRESS});
	const balanceOfWrappedCoin = useBalance({
		chainID: currentVault.chainID,
		address: toAddress(currentVault.token.address) === WFTM_TOKEN_ADDRESS ? WFTM_TOKEN_ADDRESS : WETH_TOKEN_ADDRESS //TODO: Create a wagmi Chain upgrade to add the chain wrapper token address
	});
	const deposited = useBalance({chainID: currentVault.chainID, address: currentVault.address}).raw;
	const vaultName = useMemo((): string => getVaultName(currentVault), [currentVault]);
	const {stakingRewardsByVault, positionsMap} = useStakingRewards();

	const availableToDeposit = useMemo((): bigint => {
		if (toAddress(currentVault.token.address) === WETH_TOKEN_ADDRESS) {
			// Handle ETH native coin
			return balanceOfWrappedCoin.raw + balanceOfCoin.raw;
		}
		if (toAddress(currentVault.token.address) === WFTM_TOKEN_ADDRESS) {
			// Handle FTM native coin
			return balanceOfWrappedCoin.raw + balanceOfCoin.raw;
		}
		return balanceOfWant.raw;
	}, [balanceOfCoin.raw, balanceOfWant.raw, balanceOfWrappedCoin.raw, currentVault.token.address]);

	const staked = useMemo((): bigint => {
		const stakedBalance = toBigInt(positionsMap[toAddress(stakingRewardsByVault[currentVault.address])]?.stake);
		const depositedAndStaked = deposited + stakedBalance;
		return depositedAndStaked;
	}, [currentVault.address, deposited, positionsMap, stakingRewardsByVault]);

	return (
		<Link
			key={`${currentVault.address}`}
			href={`/vaults/${currentVault.chainID}/${toAddress(currentVault.address)}`}>
			<div className={'yearn--table-wrapper cursor-pointer transition-colors hover:bg-neutral-300'}>
				<div className={'flex max-w-[32px] flex-row items-center'}>{ChainIconMap.get(currentVault.chainID) ?? <IconEtherumChain />}</div>
				<div className={'yearn--table-token-section'}>
					<div className={'yearn--table-token-section-item'}>
						<div className={'yearn--table-token-section-item-image'}>
							<ImageWithFallback
								src={`${process.env.BASE_YEARN_ASSETS_URI}/${currentVault.chainID}/${currentVault.token.address}/logo-128.png`}
								alt={`${process.env.BASE_YEARN_ASSETS_URI}/${currentVault.chainID}/${currentVault.token.address}/logo-128.png`}
								width={40}
								height={40}
							/>
						</div>
						<p>{vaultName}</p>
					</div>
				</div>

				<div className={'yearn--table-data-section'}>
					<div
						className={'yearn--table-data-section-item md:col-span-2'}
						datatype={'number'}>
						<label className={'yearn--table-data-section-item-label !font-aeonik'}>{'APY'}</label>
						<VaultAPR currentVault={currentVault} />
					</div>

					<div
						className={'yearn--table-data-section-item md:col-span-2'}
						datatype={'number'}>
						<label className={'yearn--table-data-section-item-label !font-aeonik'}>{'Available'}</label>
						<p className={`yearn--table-data-section-item-value ${isZero(availableToDeposit) ? 'text-neutral-400' : 'text-neutral-900'}`}>
							<RenderAmount
								value={availableToDeposit}
								symbol={currentVault.token.symbol}
								decimals={currentVault.token.decimals}
								options={{shouldDisplaySymbol: false}}
							/>
						</p>
					</div>

					<div
						className={'yearn--table-data-section-item md:col-span-2'}
						datatype={'number'}>
						<label className={'yearn--table-data-section-item-label !font-aeonik'}>{'Deposited'}</label>
						<p className={`yearn--table-data-section-item-value ${isZero(staked) ? 'text-neutral-400' : 'text-neutral-900'}`}>
							<RenderAmount
								value={staked}
								symbol={currentVault.token.symbol}
								decimals={currentVault.token.decimals}
								options={{shouldDisplaySymbol: false}}
							/>
						</p>
					</div>

					<div
						className={'yearn--table-data-section-item md:col-span-2'}
						datatype={'number'}>
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
								}}
							/>
						</p>
					</div>
				</div>
			</div>
		</Link>
	);
}
