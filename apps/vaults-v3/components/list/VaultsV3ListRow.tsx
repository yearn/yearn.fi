import {useMemo} from 'react';
import Link from 'next/link';
import {Renderable} from '@yearn-finance/web-lib/components/Renderable';
import {IconLinkOut} from '@yearn-finance/web-lib/icons/IconLinkOut';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {cl} from '@yearn-finance/web-lib/utils/cl';
import {ETH_TOKEN_ADDRESS, WETH_TOKEN_ADDRESS, WFTM_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {isZero} from '@yearn-finance/web-lib/utils/isZero';
import {getNetwork} from '@yearn-finance/web-lib/utils/wagmi/utils';
import {ImageWithFallback} from '@common/components/ImageWithFallback';
import {RenderAmount} from '@common/components/RenderAmount';
import {useWallet} from '@common/contexts/useWallet';
import {useBalance} from '@common/hooks/useBalance';

import {VaultChainTag} from '../VaultChainTag';

import type {ReactElement} from 'react';
import type {TYDaemonVault} from '@common/schemas/yDaemonVaultsSchemas';

function VaultForwardAPR({currentVault}: {currentVault: TYDaemonVault}): ReactElement {
	const isEthMainnet = currentVault.chainID === 1;
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
								shouldRender={!(currentVault.apr?.type === 'new' && hasZeroBoostedAPR)}
								fallback={'New'}>
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
				</div>
			);
		}
		return (
			<div className={'flex flex-col md:text-right'}>
				<b className={'yearn--table-data-section-item-value'}>
					<Renderable
						shouldRender={!(currentVault.apr?.type === 'new' && hasZeroAPR)}
						fallback={'New'}>
						<RenderAmount
							value={currentVault.apr?.netAPR}
							shouldHideTooltip={hasZeroAPR}
							symbol={'percent'}
							decimals={6}
						/>
					</Renderable>
				</b>
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
							shouldRender={
								!(currentVault.apr?.type === 'new' && isZero(currentVault.apr.forwardAPR.netAPR))
							}
							fallback={'New'}>
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

	if (currentVault.apr?.extra.stakingRewardsAPR > 0) {
		const boostedAPR = currentVault.apr.extra.stakingRewardsAPR + currentVault.apr.forwardAPR.netAPR;
		const hasZeroBoostedAPR = isZero(boostedAPR) || Number(boostedAPR.toFixed(2)) === 0;
		return (
			<div className={'flex flex-col md:text-right'}>
				<span className={'tooltip'}>
					<b className={'yearn--table-data-section-item-value'}>
						<Renderable
							shouldRender={!(currentVault.apr?.type === 'new' && hasZeroBoostedAPR)}
							fallback={'New'}>
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

	const hasZeroAPR = isZero(currentVault.apr?.netAPR) || Number((currentVault.apr?.netAPR || 0).toFixed(2)) === 0;
	return (
		<div className={'flex flex-col md:text-right'}>
			<b className={'yearn--table-data-section-item-value'}>
				<Renderable
					shouldRender={!(currentVault.apr?.type === 'new' && isZero(currentVault.apr.forwardAPR.netAPR))}
					fallback={'New'}>
					<RenderAmount
						shouldHideTooltip={hasZeroAPR}
						value={currentVault.apr.forwardAPR.netAPR}
						symbol={'percent'}
						decimals={6}
					/>
				</Renderable>
			</b>
		</div>
	);
}

function VaultHistoricalAPR({currentVault}: {currentVault: TYDaemonVault}): ReactElement {
	const hasZeroAPR = isZero(currentVault.apr?.netAPR) || Number((currentVault.apr?.netAPR || 0).toFixed(2)) === 0;

	if (currentVault.apr?.extra.stakingRewardsAPR > 0) {
		return (
			<div className={'flex flex-col md:text-right'}>
				<span className={'tooltip'}>
					<b className={'yearn--table-data-section-item-value'}>
						<Renderable
							shouldRender={!(currentVault.apr?.type === 'new' && hasZeroAPR)}
							fallback={'New'}>
							<span
								className={
									'underline decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-opacity hover:decoration-neutral-600'
								}>
								<RenderAmount
									shouldHideTooltip={hasZeroAPR}
									value={currentVault.apr?.netAPR}
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
					shouldRender={!(currentVault.apr?.type === 'new' && hasZeroAPR)}
					fallback={'New'}>
					<RenderAmount
						value={currentVault.apr?.netAPR}
						shouldHideTooltip={hasZeroAPR}
						symbol={'percent'}
						decimals={6}
					/>
				</Renderable>
			</b>
		</div>
	);
}

export function VaultsV3ListRow({currentVault}: {currentVault: TYDaemonVault}): ReactElement {
	const {getToken} = useWallet();
	const balanceOfWant = useBalance({chainID: currentVault.chainID, address: currentVault.token.address});
	const balanceOfCoin = useBalance({chainID: currentVault.chainID, address: ETH_TOKEN_ADDRESS});
	const balanceOfWrappedCoin = useBalance({
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

	const staked = useMemo((): bigint => {
		const token = getToken({chainID: currentVault.chainID, address: currentVault.address});
		const depositedAndStaked = token.balance.raw + token.stakingBalance.raw;
		return depositedAndStaked;
	}, [currentVault.address, currentVault.chainID, getToken]);

	return (
		<Link
			href={`/vaults-v3/${currentVault.chainID}/${toAddress(currentVault.address)}`}
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
					<div className={'flex flex-row space-x-6'}>
						<div className={'mt-2.5 h-8 w-8 rounded-full md:flex'}>
							<ImageWithFallback
								src={`${process.env.BASE_YEARN_ASSETS_URI}/${currentVault.chainID}/${currentVault.token.address}/logo-32.png`}
								alt={``}
								width={32}
								height={32}
							/>
						</div>
						<div>
							<strong className={'mb-1 block text-xl font-black text-neutral-800'}>
								{currentVault.name}
							</strong>
							<p className={'mb-2 block text-neutral-800'}>{currentVault.token.name}</p>
							<div className={'flex flex-row items-center'}>
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
										<IconLinkOut className={'inline-block h-4 w-4'} />
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
						'gap-4 md:gap-x-7',
						'mt-8 md:mt-0'
					)}>
					<div
						className={'yearn--table-data-section-item md:col-span-2'}
						datatype={'number'}>
						<label className={'inline text-start text-xs text-neutral-800/60 md:hidden'}>
							{'Estimated APR'}
						</label>
						<VaultForwardAPR currentVault={currentVault} />
					</div>

					<div
						className={'yearn--table-data-section-item md:col-span-2'}
						datatype={'number'}>
						<label className={'inline text-start text-xs text-neutral-800/60 md:hidden'}>
							{'Historical APR'}
						</label>
						<VaultHistoricalAPR currentVault={currentVault} />
					</div>

					<div
						className={'yearn--table-data-section-item md:col-span-2'}
						datatype={'number'}>
						<label className={'inline text-start text-xs text-neutral-800/60 md:hidden'}>
							{'Available'}
						</label>
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
						className={'yearn--table-data-section-item md:col-span-2'}
						datatype={'number'}>
						<label className={'inline text-start text-xs text-neutral-800/60 md:hidden'}>
							{'Deposited'}
						</label>
						<p
							className={`yearn--table-data-section-item-value ${
								isZero(staked) ? 'text-neutral-400' : 'text-neutral-900'
							}`}>
							<RenderAmount
								value={staked}
								symbol={currentVault.token.symbol}
								decimals={currentVault.token.decimals}
								options={{shouldDisplaySymbol: false, maximumFractionDigits: 4}}
							/>
						</p>
					</div>

					<div
						className={'yearn--table-data-section-item md:col-span-2'}
						datatype={'number'}>
						<label className={'inline text-start text-xs text-neutral-800/60 md:hidden'}>{'TVL'}</label>
						<p className={'yearn--table-data-section-item-value'}>
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
						</p>
					</div>
				</div>
			</div>
		</Link>
	);
}
