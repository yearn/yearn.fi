import {useMemo} from 'react';
import Link from 'next/link';
import {cl, formatAmount, isZero, toAddress, toNormalizedBN} from '@builtbymom/web3/utils';
import {Renderable} from '@yearn-finance/web-lib/components/Renderable';
import {IconLinkOut} from '@yearn-finance/web-lib/icons/IconLinkOut';
import {ETH_TOKEN_ADDRESS, WETH_TOKEN_ADDRESS, WFTM_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {getNetwork} from '@yearn-finance/web-lib/utils/wagmi/utils';
import {ImageWithFallback} from '@common/components/ImageWithFallback';
import {RenderAmount} from '@common/components/RenderAmount';
import {useYearn} from '@common/contexts/useYearn';
import {useYearnBalance} from '@common/hooks/useYearnBalance';

import {VaultChainTag} from '../VaultChainTag';

import type {ReactElement} from 'react';
import type {TYDaemonVault} from '@yearn-finance/web-lib/utils/schemas/yDaemonVaultsSchemas';
import type {TNormalizedBN} from '@builtbymom/web3/types';

function VaultForwardAPR({currentVault}: {currentVault: TYDaemonVault}): ReactElement {
	const isEthMainnet = currentVault.chainID === 1;
	const hasPendleArbRewards =
		currentVault.address === toAddress('0x044E75fCbF7BD3f8f4577FF317554e9c0037F145') ||
		currentVault.address === toAddress('0x0F2ae7531A83982F15ff1D26B165E2bF3D7566da') ||
		currentVault.address === toAddress('0x1Dd930ADD968ff5913C3627dAA1e6e6FCC9dc544') ||
		currentVault.address === toAddress('0x34a2b066AF16409648eF15d239E656edB8790ca0');

	if (currentVault.apr.forwardAPR.type === '') {
		const hasZeroAPR = isZero(currentVault.apr?.netAPR) || Number((currentVault.apr?.netAPR || 0).toFixed(2)) === 0;
		const boostedAPR = currentVault.apr.extra.stakingRewardsAPR + currentVault.apr.netAPR;
		const hasZeroBoostedAPR = isZero(boostedAPR) || Number(boostedAPR.toFixed(2)) === 0;

		if (currentVault.apr?.extra.stakingRewardsAPR > 0) {
			return (
				<div className={'flex flex-col md:text-right'}>
					<span className={'tooltip'}>
						<b className={'yearn--table-data-section-item-value'}>
							<Renderable
								shouldRender={!currentVault.apr.forwardAPR?.type.includes('new')}
								/* TEMPORARY CODE TO NOTIFY 1500 ARB PER WEEK REWARD FOR SOME VAULTS */
								fallback={'NEW'}>
								{'⚡️ '}
								<span
									className={
										'underline decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-opacity hover:decoration-neutral-600'
									}>
									<RenderAmount
										shouldHideTooltip={hasZeroBoostedAPR}
										value={boostedAPR}
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
										<p>{'• Base APR '}</p>
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
					{/* TEMPORARY CODE TO NOTIFY 1500 ARB PER WEEK REWARD FOR SOME VAULTS */}
					<small
						className={cl(
							'whitespace-nowrap text-xs text-neutral-800 self-end',
							hasPendleArbRewards ? '-mb-4' : ''
						)}>
						<Renderable shouldRender={hasPendleArbRewards}>{`+ 1500 ARB per week 🚀`}</Renderable>
					</small>
				</div>
			);
		}
		return (
			<div className={'flex flex-col md:text-right'}>
				<b className={'yearn--table-data-section-item-value'}>
					<Renderable
						shouldRender={!currentVault.apr.forwardAPR?.type.includes('new')}
						/* TEMPORARY CODE TO NOTIFY 1500 ARB PER WEEK REWARD FOR SOME VAULTS */
						fallback={'NEW'}>
						<RenderAmount
							value={currentVault.apr?.netAPR}
							shouldHideTooltip={hasZeroAPR}
							symbol={'percent'}
							decimals={6}
						/>
					</Renderable>
				</b>
				{/* TEMPORARY CODE TO NOTIFY 1500 ARB PER WEEK REWARD FOR SOME VAULTS */}
				<small
					className={cl(
						'whitespace-nowrap text-xs text-neutral-800 self-end',
						hasPendleArbRewards ? '-mb-4' : ''
					)}>
					<Renderable shouldRender={hasPendleArbRewards}>{`+ 1500 ARB per week 🚀`}</Renderable>
				</small>
			</div>
		);
	}

	if (isEthMainnet && currentVault.apr.forwardAPR.composite?.boost > 0 && !currentVault.apr.extra.stakingRewardsAPR) {
		const unBoostedAPR = currentVault.apr.forwardAPR.netAPR / currentVault.apr.forwardAPR.composite.boost;
		return (
			<span className={'tooltip'}>
				<div className={'flex flex-col md:text-right'}>
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
					<small className={'text-xs text-neutral-800'}>
						<Renderable
							shouldRender={
								isEthMainnet &&
								currentVault.apr.forwardAPR.composite?.boost > 0 &&
								!currentVault.apr.extra.stakingRewardsAPR
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
									<p>{'• Base APR '}</p>
									<RenderAmount
										shouldHideTooltip
										value={unBoostedAPR}
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

	/**********************************************************************************************
	 ** Display the APR including the rewards APR if the rewards APR is greater than 0.
	 **********************************************************************************************/
	const sumOfRewardsAPR = currentVault.apr.extra.stakingRewardsAPR + currentVault.apr.extra.gammaRewardAPR;
	if (sumOfRewardsAPR > 0) {
		const boostedAPR = sumOfRewardsAPR + currentVault.apr.forwardAPR.netAPR;
		const hasZeroBoostedAPR = isZero(boostedAPR) || Number(boostedAPR.toFixed(2)) === 0;
		return (
			<div className={'flex flex-col md:text-right'}>
				<span className={'tooltip'}>
					<b className={'yearn--table-data-section-item-value whitespace-nowrap'}>
						<Renderable
							shouldRender={!currentVault.apr.forwardAPR?.type.includes('new')}
							/* TEMPORARY CODE TO NOTIFY 1500 ARB PER WEEK REWARD FOR SOME VAULTS */
							fallback={'NEW'}>
							{'⚡️ '}
							<span
								className={
									'underline decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-opacity hover:decoration-neutral-600'
								}>
								<RenderAmount
									shouldHideTooltip={hasZeroBoostedAPR}
									value={boostedAPR}
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
									<p>{'• Base APR '}</p>
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
									<p>{'• Rewards APR '}</p>
									<RenderAmount
										shouldHideTooltip
										value={sumOfRewardsAPR}
										symbol={'percent'}
										decimals={6}
									/>
								</div>
							</div>
						</div>
					</span>
				</span>
				{/* TEMPORARY CODE TO NOTIFY 1500 ARB PER WEEK REWARD FOR SOME VAULTS */}
				<small
					className={cl(
						'whitespace-nowrap text-xs text-neutral-800 self-end',
						hasPendleArbRewards ? '-mb-4' : ''
					)}>
					<Renderable shouldRender={hasPendleArbRewards}>{`+ 1500 ARB per week 🚀`}</Renderable>
				</small>
			</div>
		);
	}

	/**********************************************************************************************
	 ** Display the current spot APR, retrieved from the V3Oracle, only if the current APR is
	 ** greater than 0.
	 **********************************************************************************************/
	const hasCurrentAPR = !isZero(currentVault?.apr.forwardAPR.netAPR);
	if (hasCurrentAPR) {
		return (
			<div className={'flex flex-col md:text-right'}>
				<b className={'yearn--table-data-section-item-value'}>
					<Renderable
						shouldRender={!currentVault.apr.forwardAPR?.type.includes('new')}
						/* TEMPORARY CODE TO NOTIFY 1500 ARB PER WEEK REWARD FOR SOME VAULTS */
						fallback={'NEW'}>
						{currentVault?.info?.isBoosted ? '⚡️ ' : ''}
						<RenderAmount
							shouldHideTooltip
							value={currentVault?.apr.forwardAPR.netAPR}
							symbol={'percent'}
							decimals={6}
						/>
					</Renderable>
				</b>
				{/* TEMPORARY CODE TO NOTIFY 1500 ARB PER WEEK REWARD FOR SOME VAULTS */}
				<small
					className={cl(
						'whitespace-nowrap text-xs text-neutral-800 self-end',
						hasPendleArbRewards ? '-mb-4' : ''
					)}>
					<Renderable shouldRender={hasPendleArbRewards}>{`+ 1500 ARB per week 🚀`}</Renderable>
				</small>
			</div>
		);
	}

	const hasZeroAPR = isZero(currentVault.apr?.netAPR) || Number((currentVault.apr?.netAPR || 0).toFixed(2)) === 0;
	return (
		<div className={'flex flex-col md:text-right'}>
			<b className={'yearn--table-data-section-item-value'}>
				<Renderable
					shouldRender={
						!currentVault.apr.forwardAPR?.type.includes('new') && !currentVault.apr.type.includes('new')
					}
					/* TEMPORARY CODE TO NOTIFY 1500 ARB PER WEEK REWARD FOR SOME VAULTS */
					fallback={'NEW'}>
					{currentVault?.info?.isBoosted ? '⚡️ ' : ''}
					<RenderAmount
						shouldHideTooltip={hasZeroAPR}
						value={currentVault.apr.netAPR}
						symbol={'percent'}
						decimals={6}
					/>
				</Renderable>
			</b>
			{/* TEMPORARY CODE TO NOTIFY 1500 ARB PER WEEK REWARD FOR SOME VAULTS */}
			<small
				className={cl(
					'whitespace-nowrap text-xs text-neutral-800 self-end',
					hasPendleArbRewards ? '-mb-4' : ''
				)}>
				<Renderable shouldRender={hasPendleArbRewards}>{`+ 1500 ARB per week 🚀`}</Renderable>
			</small>
		</div>
	);
}

function VaultHistoricalAPR({currentVault}: {currentVault: TYDaemonVault}): ReactElement {
	const hasZeroAPR = isZero(currentVault.apr?.netAPR) || Number((currentVault.apr?.netAPR || 0).toFixed(2)) === 0;
	const monthlyAPR = currentVault.apr.points.monthAgo;
	const weeklyAPR = currentVault.apr.points.weekAgo;

	if (currentVault.apr?.extra.stakingRewardsAPR > 0) {
		return (
			<div className={'flex flex-col md:text-right'}>
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
									shouldHideTooltip={hasZeroAPR}
									value={isZero(monthlyAPR) ? weeklyAPR : monthlyAPR}
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
									<p>{'• Base APR '}</p>
									<RenderAmount
										shouldHideTooltip
										value={isZero(monthlyAPR) ? weeklyAPR : monthlyAPR}
										symbol={'percent'}
										decimals={6}
									/>
								</div>

								<div
									className={
										'font-number flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-400 md:text-xs'
									}>
									<p>{'• Rewards APR '}</p>
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
		<div className={'flex flex-col md:text-right'}>
			<b className={'yearn--table-data-section-item-value'}>
				<Renderable
					shouldRender={!currentVault.apr?.type.includes('new')}
					fallback={'NEW'}>
					<RenderAmount
						value={isZero(monthlyAPR) ? weeklyAPR : monthlyAPR}
						shouldHideTooltip={hasZeroAPR}
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
		<div className={'flex flex-col pt-0 text-right md:pt-8'}>
			<p
				className={`yearn--table-data-section-item-value ${
					isZero(staked.raw) ? 'text-neutral-400' : 'text-neutral-900'
				}`}>
				<RenderAmount
					value={staked.normalized}
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
						minimumFractionDigits: 0
					}}
				/>
			</small>
		</div>
	);
}

export function VaultsV3ListRow({currentVault}: {currentVault: TYDaemonVault}): ReactElement {
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
			href={`/v3/${currentVault.chainID}/${toAddress(currentVault.address)}`}
			scroll={false}>
			<div
				className={cl(
					'grid w-full grid-cols-1 md:grid-cols-12 rounded-3xl',
					'p-6 pt-2 md:pr-10',
					'cursor-pointer relative group'
				)}>
				<div
					className={cl(
						'absolute inset-0 rounded-3xl',
						'opacity-20 transition-opacity group-hover:opacity-100 pointer-events-none',
						'bg-[linear-gradient(80deg,_#2C3DA6,_#D21162)]'
					)}
				/>

				<div className={cl('col-span-5 z-10', 'flex flex-row items-center justify-between')}>
					<div className={'flex flex-row gap-6'}>
						<div className={'mt-2.5 size-8 min-h-8 min-w-8 rounded-full md:flex'}>
							<ImageWithFallback
								src={`${process.env.BASE_YEARN_ASSETS_URI}/${currentVault.chainID}/${currentVault.token.address}/logo-128.png`}
								alt={``}
								width={32}
								height={32}
							/>
						</div>
						<div>
							<strong className={'mb-0 block text-[18px] font-black text-neutral-800 md:mb-1 md:text-xl'}>
								{currentVault.name}
							</strong>
							<p className={'mb-0 block text-neutral-800 md:mb-2'}>{currentVault.token.name}</p>
							<div className={'hidden flex-row items-center md:flex'}>
								<VaultChainTag chainID={currentVault.chainID} />
								<Link
									href={`${getNetwork(currentVault.chainID)?.defaultBlockExplorer}/address/${
										currentVault.address
									}`}
									onClick={(event): void => event.stopPropagation()}
									className={'text-neutral-900/50 transition-opacity hover:text-neutral-900'}
									target={'_blank'}
									rel={'noopener noreferrer'}>
									<div className={'px-2'}>
										<IconLinkOut className={'inline-block size-4'} />
									</div>
								</Link>
							</div>
						</div>
					</div>
				</div>

				<div
					className={cl(
						'col-span-7 z-10',
						'grid grid-cols-2 md:grid-cols-10',
						'gap-1 md:gap-x-7',
						'mt-4 md:mt-0'
					)}>
					<div
						className={'yearn--table-data-section-item col-span-2 flex-row md:flex-col'}
						datatype={'number'}>
						<p className={'inline text-start text-xs text-neutral-800/60 md:hidden'}>{'Estimated APR'}</p>
						<VaultForwardAPR currentVault={currentVault} />
					</div>

					<div
						className={'yearn--table-data-section-item col-span-2 flex-row md:flex-col'}
						datatype={'number'}>
						<p className={'inline text-start text-xs text-neutral-800/60 md:hidden'}>{'Historical APR'}</p>
						<VaultHistoricalAPR currentVault={currentVault} />
					</div>

					<div
						className={'yearn--table-data-section-item col-span-2 flex-row md:flex-col'}
						datatype={'number'}>
						<p className={'inline text-start text-xs text-neutral-800/60 md:hidden'}>{'Available'}</p>
						<p
							className={`yearn--table-data-section-item-value ${
								isZero(availableToDeposit) ? 'text-neutral-400' : 'text-neutral-900'
							}`}>
							<RenderAmount
								value={availableToDeposit}
								symbol={currentVault.token.symbol}
								decimals={currentVault.token.decimals}
								options={{
									shouldDisplaySymbol: false,
									maximumFractionDigits:
										Number(
											toNormalizedBN(availableToDeposit, currentVault.token.decimals).normalized
										) > 1000
											? 2
											: 4
								}}
							/>
						</p>
					</div>

					<div
						className={'yearn--table-data-section-item col-span-2 !mt-0 flex-row md:!mt-4 md:flex-col'}
						datatype={'number'}>
						<p className={'inline text-start text-xs text-neutral-800/60 md:hidden'}>{'Deposited'}</p>
						<VaultStakedAmount currentVault={currentVault} />
					</div>

					<div
						className={'yearn--table-data-section-item col-span-2 !mt-0 flex-row md:!mt-4 md:flex-col'}
						datatype={'number'}>
						<p className={'inline text-start text-xs text-neutral-800/60 md:hidden'}>{'TVL'}</p>
						<div className={'flex flex-col pt-0 text-right md:pt-8'}>
							<p className={'yearn--table-data-section-item-value'}>
								<RenderAmount
									value={Number(
										toNormalizedBN(currentVault.tvl.totalAssets, currentVault.token.decimals)
											.normalized
									)}
									symbol={''}
									decimals={6}
									shouldFormatDust
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

				<div className={'mt-4 flex flex-row items-center border-t border-neutral-900/20 pt-4 md:hidden'}>
					<VaultChainTag chainID={currentVault.chainID} />
					<Link
						href={`${getNetwork(currentVault.chainID)?.defaultBlockExplorer}/address/${
							currentVault.address
						}`}
						onClick={(event): void => event.stopPropagation()}
						className={'text-neutral-900/50 transition-opacity hover:text-neutral-900'}
						target={'_blank'}
						rel={'noopener noreferrer'}>
						<div className={'px-2'}>
							<IconLinkOut className={'inline-block size-4'} />
						</div>
					</Link>
				</div>
			</div>
		</Link>
	);
}
