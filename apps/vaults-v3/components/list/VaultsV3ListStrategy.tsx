import {useMemo, useState} from 'react';
import Link from 'next/link';
import {motion} from 'framer-motion';
import {cl, isZero, toNormalizedBN, truncateHex} from '@builtbymom/web3/utils';
import {getChainBgColor} from '@vaults-v3/utils';
import {IconLinkOut} from '@yearn-finance/web-lib/icons/IconLinkOut';
import {getNetwork} from '@yearn-finance/web-lib/utils/wagmi/utils';
import {ImageWithFallback} from '@common/components/ImageWithFallback';
import {RenderAmount} from '@common/components/RenderAmount';
import {useYearn} from '@common/contexts/useYearn';

import {VaultChainTag} from '../VaultChainTag';

import type {ReactElement} from 'react';
import type {TYDaemonVault} from '@yearn-finance/web-lib/utils/schemas/yDaemonVaultsSchemas';
import type {TNormalizedBN} from '@builtbymom/web3/types';

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
					shouldFormatDust
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
						minimumFractionDigits: 2
					}}
				/>
			</small>
		</div>
	);
}

export function VaultsV3ListStrategy({
	currentVault,
	allocationPercentage
}: {
	currentVault: TYDaemonVault;
	allocationPercentage: number;
}): ReactElement {
	const [isExpanded, set_isExpanded] = useState(false);

	const expandAnimation = {
		initial: {
			opacity: 0,
			height: 0,
			y: -20,
			scale: 0.95,
			transformOrigin: 'top'
		},
		enter: {
			opacity: 1,
			height: 'auto',
			y: 0,
			scale: 1,
			transition: {
				duration: 0.3,
				ease: [0.33, 1, 0.68, 1], // cubic-bezier easing for a smooth feel
				staggerChildren: 0.05,
				when: 'beforeChildren'
			}
		},
		exit: {
			opacity: 0,
			height: 0,
			y: -10,
			scale: 0.95,
			transition: {
				duration: 0.2,
				ease: [0.33, 0, 0.67, 0]
			}
		}
	};

	const chainBgColor = getChainBgColor(currentVault.chainID);

	return (
		<div
			className={cl(
				'w-full rounded-3xl group',
				'relative transition-all duration-300 ease-in-out',

				'text-white',
				isExpanded ? 'rounded-b-none' : ''
			)}>
			<div
				className={cl(
					'absolute inset-0 rounded-3xl',
					'opacity-20 transition-opacity  pointer-events-none',

					isExpanded
						? 'bg-[#474592]'
						: 'bg-[linear-gradient(80deg,_#2C3DA6,_#D21162)] group-hover:opacity-100'
				)}
			/>
			{/* Collapsible header - always visible */}
			<div
				className={cl(
					'grid grid-cols-1 md:grid-cols-12 items-center w-full py-3 px-8 cursor-pointer justify-between'
				)}
				onClick={() => set_isExpanded(!isExpanded)}>
				<div className={cl('col-span-5 flex flex-row items-center gap-4 z-10')}>
					<div className={'flex items-center justify-center'}>
						<button
							className={cl(
								'text-sm font-bold transition-all duration-300 ease-in-out text-[#787878]',
								isExpanded ? '' : 'rotate-[-90deg]'
							)}
							aria-label={isExpanded ? 'Collapse' : 'Expand'}>
							{'▼'}
						</button>
					</div>
					<div className={'rounded-full'}>
						<ImageWithFallback
							src={`${process.env.BASE_YEARN_ASSETS_URI}/${currentVault.chainID}/${currentVault.token.address}/logo-128.png`}
							alt={``}
							width={24}
							height={24}
						/>
					</div>
					<strong
						title={currentVault.name}
						className={'block truncate font-bold'}>
						{currentVault.name}
					</strong>
				</div>

				<div className={cl('md:col-span-7 z-10', 'grid grid-cols-3 md:grid-cols-12 gap-4', 'mt-4 md:mt-0')}>
					<div
						className={'flex-row md:col-span-3 md:flex-col md:text-right'}
						datatype={'number'}>
						<p className={'inline text-start text-xs text-neutral-800/60 md:hidden'}>{'Estimated APY'}</p>
						<p>
							<RenderAmount
								shouldHideTooltip
								value={allocationPercentage}
								symbol={'percent'}
								decimals={6}
							/>
						</p>
					</div>
					<div
						className={'mr-[-20px] flex-row md:col-span-4 md:flex-col md:text-right'}
						datatype={'number'}>
						<p className={'inline text-start text-xs text-neutral-800/60 md:hidden'}>{'Estimated APY'}</p>
						<p>
							<RenderAmount
								value={Number(
									toNormalizedBN(currentVault.tvl.totalAssets, currentVault.token.decimals).normalized
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
					</div>
					<div
						className={'mr-[3px] flex-row md:col-span-5 md:flex-col md:text-right'}
						datatype={'number'}>
						<p className={'inline text-start text-xs text-neutral-800/60 md:hidden'}>{'Estimated APY'}</p>
						<p>
							<RenderAmount
								shouldHideTooltip
								value={currentVault.apr.forwardAPR.netAPR || currentVault.apr?.netAPR}
								symbol={'percent'}
								decimals={6}
							/>
							&nbsp;&nbsp;&nbsp;{'APY'}
						</p>
					</div>
				</div>
			</div>
			{/* Expanded content */}
			{isExpanded && (
				<motion.div
					key={`${currentVault.address}-${currentVault.chainID}`}
					variants={expandAnimation}
					initial={'initial'}
					animate={'enter'}
					exit={'exit'}>
					<div className={'h-px w-full bg-[#606770]'} />
					<div className={cl('w-full py-4 md:pl-20 pl-8 rounded-b-3xl')}>
						<motion.div
							className={'grid grid-cols-1 gap-6 md:grid-cols-2'}
							variants={{
								initial: {},
								enter: {},
								exit: {}
							}}>
							{/* First column */}
							<div className={'flex flex-col gap-4'}>
								<div className={'flex items-center gap-4'}>
									<div className={'shrink-0'}>
										<VaultChainTag chainID={currentVault.chainID} />
									</div>
									<Link
										href={`/v3/${currentVault.chainID}/${currentVault.address}`}
										onClick={(event): void => event.stopPropagation()}
										style={{background: chainBgColor}} // needed for polygon vaults
										className={cl(
											'rounded-2xl px-3.5 py-1 flex gap-2 items-center text-xs text-neutral-800 hover:opacity-80 '
										)}
										target={'_blank'}
										rel={'noopener noreferrer'}>
										{'Vault'}
										<IconLinkOut className={'inline-block size-4'} />
									</Link>
									<Link
										href={`${getNetwork(currentVault.chainID)?.defaultBlockExplorer}/address/${
											currentVault.address
										}`}
										onClick={(event): void => event.stopPropagation()}
										style={{background: chainBgColor}} // needed for polygon vaults
										className={cl(
											'rounded-2xl px-3.5 py-1 flex gap-2 items-center text-xs text-neutral-800 hover:opacity-80'
										)}
										target={'_blank'}
										rel={'noopener noreferrer'}>
										{truncateHex(currentVault.address, 4)}
										<IconLinkOut className={'inline-block size-4'} />
									</Link>
								</div>

								<div className={'flex flex-col gap-2'}>
									<div className={'flex flex-row gap-2'}>
										<span className={''}>{'Management Fee:'}</span>
										<span>{'0%'}</span>
									</div>
									<div className={'flex flex-row gap-2'}>
										<span className={''}>{'Performance Fee:'}</span>
										<span>{'5%'}</span>
									</div>
									<div className={'flex flex-row gap-2'}>
										<span className={''}>{'Last Report:'}</span>
										<Link
											href={`#`}
											onClick={(event): void => event.stopPropagation()}
											className={'flex items-center gap-1 text-white hover:opacity-60'}
											target={'_blank'}
											rel={'noopener noreferrer'}>
											{'3 days ago'}
											<IconLinkOut className={'inline-block size-3'} />
										</Link>
									</div>
								</div>
							</div>
						</motion.div>
					</div>
				</motion.div>
			)}
		</div>
	);
}
