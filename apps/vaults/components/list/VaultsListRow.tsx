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
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {isZero} from '@yearn-finance/web-lib/utils/isZero';
import {ImageWithFallback} from '@common/components/ImageWithFallback';
import {RenderAmount} from '@common/components/RenderAmount';
import {useWallet} from '@common/contexts/useWallet';
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

export function VaultForwardAPR({currentVault}: {currentVault: TYDaemonVault}): ReactElement {
	const isEthMainnet = currentVault.chainID === 1;

	if (currentVault.apr?.extra.stakingRewardsAPR > 0) {
		const boostedAPR = currentVault.apr.extra.stakingRewardsAPR + currentVault.apr.forwardAPR.netAPR;
		return (
			<div className={'flex flex-col text-right'}>
				<span className={'tooltip'}>
					<b className={'yearn--table-data-section-item-value'}>
						<Renderable
							shouldRender={!(currentVault.apr?.type === 'new' && isZero(boostedAPR))}
							fallback={'New'}>
							{'⚡️ '}
							<RenderAmount
								shouldHideTooltip
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
										shouldHideTooltip
										value={currentVault.apr.forwardAPR.netAPR}
										symbol={'percent'}
										decimals={6}
									/>
								</div>

								<div className={'font-number flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-400 md:text-xs'}>
									<p>{'• Rewards APR '}</p>
									<RenderAmount
										shouldHideTooltip
										value={currentVault.apr.extra.stakingRewardsAPR}
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

	if (isEthMainnet && currentVault.apr.forwardAPR.composite?.boost > 0 && !currentVault.apr.extra.stakingRewardsAPR) {
		const unBoostedAPR = currentVault.apr.forwardAPR.netAPR / currentVault.apr.forwardAPR.composite.boost;
		return (
			<span className={'tooltip'}>
				<div className={'flex flex-col text-right'}>
					<b className={'yearn--table-data-section-item-value'}>
						<Renderable
							shouldRender={!(currentVault.apr?.type === 'new' && isZero(currentVault.apr.forwardAPR.netAPR))}
							fallback={'New'}>
							<RenderAmount
								value={currentVault.apr.forwardAPR.netAPR}
								symbol={'percent'}
								decimals={6}
							/>
						</Renderable>
					</b>
					<small className={'text-xs text-neutral-900'}>
						<Renderable shouldRender={isEthMainnet && currentVault.apr.forwardAPR.composite?.boost > 0 && !currentVault.apr.extra.stakingRewardsAPR}>
							{`BOOST ${formatAmount(currentVault.apr.forwardAPR.composite?.boost, 2, 2)}x`}
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
									<p>{`${formatAmount(currentVault.apr.forwardAPR.composite.boost, 2, 2)} x`}</p>
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
					shouldRender={!(currentVault.apr?.type === 'new' && isZero(currentVault.apr.forwardAPR.netAPR))}
					fallback={'New'}>
					<RenderAmount
						value={currentVault.apr.forwardAPR.netAPR}
						symbol={'percent'}
						decimals={6}
					/>
				</Renderable>
			</b>
		</div>
	);
}

export function VaultHistoricalAPR({currentVault}: {currentVault: TYDaemonVault}): ReactElement {
	if (currentVault.apr?.extra.stakingRewardsAPR > 0) {
		const boostedAPR = currentVault.apr.netAPR + currentVault.apr.extra.stakingRewardsAPR;

		return (
			<div className={'flex flex-col text-right'}>
				<span className={'tooltip'}>
					<b className={'yearn--table-data-section-item-value'}>
						<Renderable
							shouldRender={!(currentVault.apr?.type === 'new' && isZero(boostedAPR))}
							fallback={'New'}>
							<RenderAmount
								value={boostedAPR}
								symbol={'percent'}
								decimals={6}
							/>
						</Renderable>
					</b>
				</span>
			</div>
		);
	}

	return (
		<div className={'flex flex-col text-right'}>
			<b className={'yearn--table-data-section-item-value'}>
				<Renderable
					shouldRender={!(currentVault.apr?.type === 'new' && isZero(currentVault.apr?.netAPR))}
					fallback={'New'}>
					<RenderAmount
						value={currentVault.apr?.netAPR}
						symbol={'percent'}
						decimals={6}
					/>
				</Renderable>
			</b>
		</div>
	);
}

export function VaultsListRow({currentVault}: {currentVault: TYDaemonVault}): ReactElement {
	const {getToken} = useWallet();
	const balanceOfWant = useBalance({chainID: currentVault.chainID, address: currentVault.token.address});
	const balanceOfCoin = useBalance({chainID: currentVault.chainID, address: ETH_TOKEN_ADDRESS});
	const balanceOfWrappedCoin = useBalance({
		chainID: currentVault.chainID,
		address: toAddress(currentVault.token.address) === WFTM_TOKEN_ADDRESS ? WFTM_TOKEN_ADDRESS : WETH_TOKEN_ADDRESS //TODO: Create a wagmi Chain upgrade to add the chain wrapper token address
	});
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
		const token = getToken({chainID: currentVault.chainID, address: currentVault.address});
		const depositedAndStaked = token.balance.raw + token.stakingBalance.raw;
		return depositedAndStaked;
	}, [currentVault.address, positionsMap, stakingRewardsByVault]);

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

				<div className={'col-span-5 grid grid-cols-1 gap-0 md:grid-cols-10 md:gap-x-7'}>
					<div
						className={'yearn--table-data-section-item md:col-span-2'}
						datatype={'number'}>
						<label className={'yearn--table-data-section-item-label !font-aeonik'}>{'Estimated APR'}</label>
						<VaultForwardAPR currentVault={currentVault} />
					</div>

					<div
						className={'yearn--table-data-section-item md:col-span-2'}
						datatype={'number'}>
						<label className={'yearn--table-data-section-item-label !font-aeonik'}>{'Historical APR'}</label>
						<VaultHistoricalAPR currentVault={currentVault} />
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
