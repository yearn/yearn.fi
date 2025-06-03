import {useMemo} from 'react';
import Link from 'next/link';
import {ImageWithFallback} from '@lib/components/ImageWithFallback';
import {Renderable} from '@lib/components/Renderable';
import {RenderAmount} from '@lib/components/RenderAmount';
import {useYearn} from '@lib/contexts/useYearn';
import {useYearnBalance} from '@lib/hooks/useYearnBalance';
import {cl, formatAmount, isZero, toAddress, toNormalizedBN} from '@lib/utils';
import {ETH_TOKEN_ADDRESS, WETH_TOKEN_ADDRESS, WFTM_TOKEN_ADDRESS} from '@lib/utils/constants';
import {getNetwork} from '@lib/utils/wagmi';

import type {ReactElement} from 'react';
import type {TNormalizedBN} from '@lib/types';
import type {TYDaemonVault} from '@lib/utils/schemas/yDaemonVaultsSchemas';

export function VaultForwardAPY({currentVault}: {currentVault: TYDaemonVault}): ReactElement {
	const isEthMainnet = currentVault.chainID === 1;
	const extraAPY = currentVault.apr.extra.stakingRewardsAPR + currentVault.apr.extra.gammaRewardAPR;

	if (currentVault.apr.forwardAPR.type === '') {
		const hasZeroAPY =
			isZero(currentVault.apr?.netAPR) || Number(Number(currentVault.apr?.netAPR || 0).toFixed(2)) === 0;
		const boostedAPY = extraAPY + currentVault.apr.netAPR;
		const hasZeroBoostedAPY = isZero(boostedAPY) || Number(boostedAPY.toFixed(2)) === 0;

		if (currentVault.apr?.extra.stakingRewardsAPR > 0) {
			return (
				<div className={'flex flex-col text-right'}>
					<span className={'tooltip'}>
						<b className={'yearn--table-data-section-item-value'}>
							<Renderable
								shouldRender={!currentVault.apr.forwardAPR?.type.includes('new')}
								fallback={'NEW'}>
								{'⚡️ '}
								<span
									className={
										'underline decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-opacity hover:decoration-neutral-600'
									}>
									<RenderAmount
										shouldHideTooltip={hasZeroBoostedAPY}
										value={boostedAPY}
										symbol={'percent'}
										decimals={6}
									/>
								</span>
							</Renderable>
						</b>
						<span className={'tooltipLight bottom-full mb-1'}>
							<div
								className={
									'font-number w-fit border border-neutral-300 bg-neutral-100 p-1 px-2 text-center text-xxs text-neutral-900'
								}>
								<div className={'flex flex-col items-start justify-start text-left'}>
									<div
										className={
											'font-number flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-400 md:text-xs'
										}>
										<p>{'• Base APY '}</p>
										<RenderAmount
											shouldHideTooltip
											value={currentVault.apr.netAPR}
											symbol={'percent'}
											decimals={6}
										/>
									</div>

									<div
										className={
											'font-number flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-400 md:text-xs'
										}>
										<p>{'• Rewards APY '}</p>
										<RenderAmount
											shouldHideTooltip
											value={extraAPY}
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
		return (
			<div className={'flex flex-col text-right'}>
				<b className={'yearn--table-data-section-item-value'}>
					<Renderable
						shouldRender={!currentVault.apr.forwardAPR?.type.includes('new')}
						fallback={'NEW'}>
						<RenderAmount
							value={currentVault.apr?.netAPR}
							shouldHideTooltip={hasZeroAPY}
							symbol={'percent'}
							decimals={6}
						/>
					</Renderable>
				</b>
			</div>
		);
	}

	if (isEthMainnet && currentVault.apr.forwardAPR.composite?.boost > 0 && !extraAPY) {
		const unBoostedAPY = currentVault.apr.forwardAPR.netAPR / currentVault.apr.forwardAPR.composite.boost;
		return (
			<span className={'tooltip'}>
				<div className={'flex flex-col text-right'}>
					<b
						className={
							'yearn--table-data-section-item-value underline decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-opacity hover:decoration-neutral-600'
						}>
						<Renderable
							shouldRender={!currentVault.apr.forwardAPR?.type.includes('new')}
							fallback={'NEW'}>
							<RenderAmount
								shouldHideTooltip
								value={currentVault.apr.forwardAPR.netAPR}
								symbol={'percent'}
								decimals={6}
							/>
						</Renderable>
					</b>
					<small className={'text-xs text-neutral-900'}>
						<Renderable
							shouldRender={
								isEthMainnet && currentVault.apr.forwardAPR.composite?.boost > 0 && !extraAPY
							}>
							{`BOOST ${formatAmount(currentVault.apr.forwardAPR.composite?.boost, 2, 2)}x`}
						</Renderable>
					</small>
					<span className={'tooltipLight bottom-full mb-1'}>
						<div
							className={
								'font-number w-fit border border-neutral-300 bg-neutral-100 p-1 px-2 text-center text-xxs text-neutral-900'
							}>
							<div className={'flex flex-col items-start justify-start text-left'}>
								<div
									className={
										'font-number flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-400 md:text-xs'
									}>
									<p>{'• Base APY '}</p>
									<RenderAmount
										shouldHideTooltip
										value={unBoostedAPY}
										symbol={'percent'}
										decimals={6}
									/>
								</div>

								<div
									className={
										'font-number flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-400 md:text-xs'
									}>
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

	if (extraAPY > 0) {
		const boostedAPY = extraAPY + currentVault.apr.forwardAPR.netAPR;
		const hasZeroBoostedAPY = isZero(boostedAPY) || Number(boostedAPY.toFixed(2)) === 0;
		return (
			<div className={'flex flex-col text-right'}>
				<span className={'tooltip'}>
					<b className={'yearn--table-data-section-item-value'}>
						<Renderable
							shouldRender={!currentVault.apr.forwardAPR?.type.includes('new')}
							fallback={'NEW'}>
							{'⚡️ '}
							<span
								className={
									'underline decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-opacity hover:decoration-neutral-600'
								}>
								<RenderAmount
									shouldHideTooltip={hasZeroBoostedAPY}
									value={boostedAPY}
									symbol={'percent'}
									decimals={6}
								/>
							</span>
						</Renderable>
					</b>
					<span className={'tooltipLight bottom-full mb-1'}>
						<div
							className={
								'font-number w-fit border border-neutral-300 bg-neutral-100 p-1 px-2 text-center text-xxs text-neutral-900'
							}>
							<div className={'flex flex-col items-start justify-start text-left'}>
								<div
									className={
										'font-number flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-400 md:text-xs'
									}>
									<p>{'• Base APY '}</p>
									<RenderAmount
										shouldHideTooltip
										value={currentVault.apr.forwardAPR.netAPR}
										symbol={'percent'}
										decimals={6}
									/>
								</div>

								<div
									className={
										'font-number flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-400 md:text-xs'
									}>
									<p>{'• Rewards APY '}</p>
									<RenderAmount
										shouldHideTooltip
										value={extraAPY}
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

	const hasZeroAPY =
		isZero(currentVault.apr?.netAPR) || Number(Number(currentVault.apr?.netAPR || 0).toFixed(2)) === 0;
	return (
		<div className={'flex flex-col text-right'}>
			<b className={'yearn--table-data-section-item-value'}>
				<Renderable
					shouldRender={!currentVault.apr.forwardAPR?.type.includes('new')}
					fallback={'NEW'}>
					<RenderAmount
						shouldHideTooltip={hasZeroAPY}
						value={currentVault.apr.forwardAPR.netAPR}
						symbol={'percent'}
						decimals={6}
					/>
				</Renderable>
			</b>
		</div>
	);
}

function VaultHistoricalAPY({currentVault}: {currentVault: TYDaemonVault}): ReactElement {
	const hasZeroAPY =
		isZero(currentVault.apr?.netAPR) || Number(Number(currentVault.apr?.netAPR || 0).toFixed(2)) === 0;
	const monthlyAPY = currentVault.apr.points.monthAgo;
	const weeklyAPY = currentVault.apr.points.weekAgo;

	if (currentVault.apr?.extra.stakingRewardsAPR > 0) {
		return (
			<div className={'flex flex-col text-right'}>
				<span className={'tooltip'}>
					<b className={'yearn--table-data-section-item-value'}>
						<Renderable
							shouldRender={!currentVault.apr?.type.includes('new')}
							fallback={'NEW'}>
							<span
								className={
									'underline decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-opacity hover:decoration-neutral-600'
								}>
								<RenderAmount
									shouldHideTooltip={hasZeroAPY}
									value={isZero(monthlyAPY) ? weeklyAPY : monthlyAPY}
									symbol={'percent'}
									decimals={6}
								/>
							</span>
						</Renderable>
					</b>
					<span className={'tooltipLight bottom-full mb-1'}>
						<div
							className={
								'font-number w-fit border border-neutral-300 bg-neutral-100 p-1 px-2 text-center text-xxs text-neutral-900'
							}>
							<div className={'flex flex-col items-start justify-start text-left'}>
								<div
									className={
										'font-number flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-400 md:text-xs'
									}>
									<p>{'• Base APY '}</p>
									<RenderAmount
										shouldHideTooltip
										value={isZero(monthlyAPY) ? weeklyAPY : monthlyAPY}
										symbol={'percent'}
										decimals={6}
									/>
								</div>

								<div
									className={
										'font-number flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-400 md:text-xs'
									}>
									<p>{'• Rewards APY '}</p>
									<p>{'N/A'}</p>
								</div>
							</div>
						</div>
					</span>
				</span>
			</div>
		);
	}

	return (
		<div className={'flex flex-col text-right'}>
			<b className={'yearn--table-data-section-item-value'}>
				<Renderable
					shouldRender={!currentVault.apr?.type.includes('new')}
					fallback={'NEW'}>
					<RenderAmount
						value={isZero(monthlyAPY) ? weeklyAPY : monthlyAPY}
						shouldHideTooltip={hasZeroAPY}
						symbol={'percent'}
						decimals={6}
					/>
				</Renderable>
			</b>
		</div>
	);
}

export function VaultStakedAmount({currentVault}: {currentVault: TYDaemonVault}): ReactElement {
	const {getToken, getPrice} = useYearn();

	const tokenPrice = useMemo(
		() => getPrice({address: currentVault.address, chainID: currentVault.chainID}),
		[currentVault.address, currentVault.chainID]
	);
	const staked = useMemo((): TNormalizedBN => {
		const vaultToken = getToken({chainID: currentVault.chainID, address: currentVault.address});
		if (currentVault.staking.available) {
			const stakingToken = getToken({chainID: currentVault.chainID, address: currentVault.staking.address});
			return toNormalizedBN(vaultToken.balance.raw + stakingToken.balance.raw, vaultToken.decimals);
		}
		return toNormalizedBN(vaultToken.balance.raw, vaultToken.decimals);
	}, [
		currentVault.address,
		currentVault.chainID,
		currentVault.staking.address,
		currentVault.staking.available,
		getToken
	]);

	return (
		<div className={'flex flex-col pt-0 text-right'}>
			<p
				className={`yearn--table-data-section-item-value ${
					isZero(staked.raw) ? 'text-neutral-400' : 'text-neutral-900'
				}`}>
				<RenderAmount
					value={staked.raw}
					symbol={currentVault.token.symbol}
					decimals={currentVault.token.decimals}
					options={{shouldDisplaySymbol: false, maximumFractionDigits: 4}}
				/>
			</p>
			<small className={cl('text-xs text-neutral-900/40', staked.raw === 0n ? 'invisible' : 'visible')}>
				<RenderAmount
					value={staked.normalized * tokenPrice.normalized}
					symbol={'USD'}
					decimals={0}
					options={{
						shouldCompactValue: true,
						maximumFractionDigits: 2,
						minimumFractionDigits: 2
					}}
				/>
			</small>
		</div>
	);
}

export function VaultsListRow({currentVault}: {currentVault: TYDaemonVault}): ReactElement {
	const balanceOfWant = useYearnBalance({chainID: currentVault.chainID, address: currentVault.token.address});
	const balanceOfCoin = useYearnBalance({chainID: currentVault.chainID, address: ETH_TOKEN_ADDRESS});
	const balanceOfWrappedCoin = useYearnBalance({
		chainID: currentVault.chainID,
		address: toAddress(currentVault.token.address) === WFTM_TOKEN_ADDRESS ? WFTM_TOKEN_ADDRESS : WETH_TOKEN_ADDRESS //TODO: Create a wagmi Chain upgrade to add the chain wrapper token address
	});
	const availableToDeposit = useMemo((): bigint => {
		if (toAddress(currentVault.token.address) === WETH_TOKEN_ADDRESS) {
			return balanceOfWrappedCoin.raw + balanceOfCoin.raw;
		}
		if (toAddress(currentVault.token.address) === WFTM_TOKEN_ADDRESS) {
			return balanceOfWrappedCoin.raw + balanceOfCoin.raw;
		}
		return balanceOfWant.raw;
	}, [balanceOfCoin.raw, balanceOfWant.raw, balanceOfWrappedCoin.raw, currentVault.token.address]);

	return (
		<Link
			key={`${currentVault.address}`}
			href={`/vaults/${currentVault.chainID}/${toAddress(currentVault.address)}`}>
			<div
				className={cl(
					'grid w-full grid-cols-1 md:grid-cols-12',
					'p-6 pt-2 md:px-10 bg-neutral-100 hover:bg-neutral-200 transition-colors',
					'cursor-pointer relative group'
				)}>
				<div className={cl('col-span-4 z-10', 'flex flex-row items-center justify-between')}>
					<div className={'flex flex-row gap-6 overflow-hidden'}>
						<div className={'mt-2.5 size-8 min-h-8 min-w-8 rounded-full md:flex'}>
							<ImageWithFallback
								src={`${process.env.BASE_YEARN_ASSETS_URI}/${currentVault.chainID}/${currentVault.token.address}/logo-128.png`}
								alt={''}
								width={32}
								height={32}
							/>
						</div>
						<div className={'truncate'}>
							<strong
								title={currentVault.name}
								className={'block truncate font-black text-neutral-800 md:-mb-0.5 md:text-lg'}>
								{currentVault.name}
							</strong>
							<div className={'flex flex-row items-center gap-1'}>
								<ImageWithFallback
									src={`${process.env.BASE_YEARN_CHAIN_URI}/${currentVault.chainID}/logo-32.png`}
									alt={`Chain ${currentVault.chainID}`}
									width={14}
									height={14}
								/>
								<p className={'block text-sm text-neutral-800/60'}>
									{currentVault.chainID === 10 ? 'Optimism' : getNetwork(currentVault.chainID).name}
								</p>
							</div>
						</div>
					</div>
				</div>

				<div />
				<div className={cl('col-span-7 z-10', 'grid grid-cols-2 md:grid-cols-10 gap-1', 'mt-4 md:mt-0')}>
					<div
						className={'yearn--table-data-section-item col-span-2 flex-row md:flex-col'}
						datatype={'number'}>
						<p className={'yearn--table-data-section-item-label !font-aeonik'}>{'Estimated APY'}</p>
						<VaultForwardAPY currentVault={currentVault} />
					</div>

					<div
						className={'yearn--table-data-section-item col-span-2 flex-row md:flex-col'}
						datatype={'number'}>
						<p className={'yearn--table-data-section-item-label !font-aeonik'}>{'Historical APY'}</p>
						<VaultHistoricalAPY currentVault={currentVault} />
					</div>

					<div
						className={'yearn--table-data-section-item col-span-2 flex-row md:flex-col'}
						datatype={'number'}>
						<p className={'yearn--table-data-section-item-label !font-aeonik'}>{'Available'}</p>
						<p
							className={`yearn--table-data-section-item-value ${
								isZero(availableToDeposit) ? 'text-neutral-400' : 'text-neutral-900'
							}`}>
							<RenderAmount
								value={availableToDeposit}
								symbol={currentVault.token.symbol}
								decimals={currentVault.token.decimals}
								options={{shouldDisplaySymbol: false, maximumFractionDigits: 4}}
							/>
						</p>
					</div>

					<div
						className={'yearn--table-data-section-item col-span-2 flex-row md:flex-col'}
						datatype={'number'}>
						<p className={'yearn--table-data-section-item-label !font-aeonik'}>{'Deposited'}</p>
						<VaultStakedAmount currentVault={currentVault} />
					</div>

					<div
						className={'yearn--table-data-section-item col-span-2 flex-row md:flex-col'}
						datatype={'number'}>
						<p className={'yearn--table-data-section-item-label !font-aeonik'}>{'TVL'}</p>
						<div className={'flex flex-col text-right'}>
							<p className={'yearn--table-data-section-item-value'}>
								<RenderAmount
									value={Number(
										toNormalizedBN(currentVault.tvl.totalAssets, currentVault.token.decimals)
											.normalized
									)}
									symbol={''}
									decimals={6}
									options={{
										shouldCompactValue: true,
										maximumFractionDigits: 2,
										minimumFractionDigits: 2
									}}
								/>
							</p>
							<small className={'text-xs text-neutral-900/40'}>
								<RenderAmount
									value={currentVault.tvl?.tvl}
									symbol={'USD'}
									decimals={0}
									options={{
										shouldCompactValue: true,
										maximumFractionDigits: 2,
										minimumFractionDigits: 0
									}}
								/>
							</small>
						</div>
					</div>
				</div>
			</div>
		</Link>
	);
}
