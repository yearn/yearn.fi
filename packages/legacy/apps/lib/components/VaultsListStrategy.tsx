import {ImageWithFallback} from '@lib/components/ImageWithFallback';
import {RenderAmount} from '@lib/components/RenderAmount';
import {useFetch} from '@lib/hooks/useFetch';
import {useYDaemonBaseURI} from '@lib/hooks/useYDaemonBaseURI';
import {IconLinkOut} from '@lib/icons/IconLinkOut';
import type {TAddress} from '@lib/types';
import {cl, formatPercent, toAddress, truncateHex} from '@lib/utils';
import {formatDuration} from '@lib/utils/format.time';
import type {TYDaemonVault, TYDaemonVaultStrategy} from '@lib/utils/schemas/yDaemonVaultsSchemas';
import {getNetwork} from '@lib/utils/wagmi/utils';
import {findLatestAPY} from '@vaults-v2/components/details/tabs/findLatestAPY';
import type {TYDaemonReports} from '@vaults-v2/schemas/reportsSchema';
import {yDaemonReportsSchema} from '@vaults-v2/schemas/reportsSchema';
import {getChainBgColor} from '@vaults-v3/utils';
import {motion} from 'framer-motion';
import Link from 'next/link';
import type {ReactElement} from 'react';
import {useMemo, useState} from 'react';

export function VaultsListStrategy({
	details,
	chainId,
	allocation,
	name,
	tokenAddress,
	address,
	isVault = false,
	variant = 'v3',
	apr,
	fees,
	isUnallocated = false
}: {
	details: TYDaemonVaultStrategy['details'];
	chainId: number;
	allocation: string;
	name: string;
	tokenAddress: TAddress;
	address: TAddress;
	isVault?: boolean;
	variant: 'v2' | 'v3';
	apr: number | undefined;
	fees: TYDaemonVault['apr']['fees'];
	isUnallocated?: boolean;
}): ReactElement {
	const [isExpanded, setIsExpanded] = useState(false);

	const isStrategy = !apr;

	const {yDaemonBaseUri} = useYDaemonBaseURI({chainID: chainId});

	// Fetch if component is used for strategies that are not vaults
	const {data: reports} = useFetch<TYDaemonReports>({
		endpoint: isStrategy ? `${yDaemonBaseUri}/reports/${address}` : '',
		schema: yDaemonReportsSchema
	});
	const latestApr = useMemo((): number => findLatestAPY(reports), [reports]);

	const finalApr = apr || latestApr;

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
	const chainBgColor = getChainBgColor(chainId);
	const lastReportTime = details?.lastReport ? formatDuration(details.lastReport * 1000 - Date.now(), true) : 'N/A';

	return (
		<div
			className={cl(
				'w-full group',
				'relative transition-all duration-300 ease-in-out',

				'text-neutral-900',
				isExpanded ? 'rounded-b-none' : '',
				variant === 'v2' ? '' : 'rounded-3xl',
				isExpanded && variant === 'v2' ? 'bg-[#97979724] bg-opacity-[14]' : '',
				isUnallocated ? 'opacity-50' : ''
			)}
		>
			{variant === 'v3' && (
				<div
					className={cl(
						'absolute inset-0 rounded-2xl',
						'opacity-20 transition-opacity  pointer-events-none',

						isExpanded
							? 'bg-[#474592]'
							: 'bg-[linear-gradient(80deg,_#2C3DA6,_#D21162)] group-hover:opacity-100'
					)}
				/>
			)}
			{/* Collapsible header - always visible */}
			<div
				className={cl(
					'grid grid-cols-1 md:grid-cols-12 text-neutral-900 items-center w-full py-3 px-4 md:px-8 cursor-pointer justify-between',
					variant === 'v3' ? '' : 'md:border-t border-[#606770]'
				)}
				onClick={() => setIsExpanded(!isExpanded)}
			>
				<div className={cl('col-span-5 flex flex-row items-center gap-4 z-10')}>
					<div className={'flex items-center justify-center'}>
						<button
							className={cl(
								'text-sm font-bold transition-all duration-300 ease-in-out',
								isExpanded ? '' : 'rotate-[-90deg]'
							)}
							aria-label={isExpanded ? 'Collapse' : 'Expand'}
						>
							{'▼'}
						</button>
					</div>
					<div className={'rounded-full'}>
						<ImageWithFallback
							src={`${process.env.BASE_YEARN_ASSETS_URI}/${chainId}/${tokenAddress}/logo-128.png`}
							alt={''}
							width={24}
							height={24}
						/>
					</div>
					<strong title={name} className={'block truncate font-bold '}>
						{name}
					</strong>
				</div>

				<div
					className={cl(
						'md:col-span-7 z-10',
						'grid grid-cols-1 sm:grid-cols-3 md:grid-cols-12 md:gap-4',
						'mt-4 md:mt-0'
					)}
				>
					<div
						className={'items-right flex flex-row justify-between sm:flex-col md:col-span-3 md:text-right'}
						datatype={'number'}
					>
						<p className={'inline text-start text-xs text-neutral-800/60 md:hidden'}>{'Allocation %'}</p>
						<p>{formatPercent((details?.debtRatio || 0) / 100, 0)}</p>
					</div>
					<div
						className={
							'items-right flex flex-row justify-between sm:flex-col md:col-span-4 md:mr-[-20px] md:text-right'
						}
						datatype={'number'}
					>
						<p className={'inline text-start text-xs text-neutral-800/60 md:hidden'}>{'Allocation $'}</p>
						<p>{allocation}</p>
					</div>
					<div
						className={
							'items-right flex flex-row justify-between sm:flex-col md:col-span-5 md:mr-[3px] md:text-right'
						}
						datatype={'number'}
					>
						<p className={'inline text-start text-xs text-neutral-800/60 md:hidden'}>{'Estimated APY'}</p>
						<p>
							<RenderAmount shouldHideTooltip value={finalApr} symbol={'percent'} decimals={6} />
						</p>
					</div>
				</div>
			</div>
			{/* Expanded content */}
			{isExpanded && (
				<motion.div
					key={`${address}-${chainId}`}
					variants={expandAnimation}
					initial={'initial'}
					animate={'enter'}
					exit={'exit'}
				>
					<div className={'h-px w-full bg-[#606770]'} />
					<div className={cl('w-full py-4 md:pl-16 pl-4 rounded-b-3xl text-neutral-900')}>
						<motion.div
							className={'grid grid-cols-1 gap-6 md:grid-cols-2'}
							variants={{
								initial: {},
								enter: {},
								exit: {}
							}}
						>
							{/* First column */}
							<div className={'flex flex-col gap-4'}>
								<div className={'flex flex-wrap items-center gap-4'}>
									{variant === 'v3' && isVault ? (
										<Link
											href={`/v3/${chainId}/${toAddress(address)}`}
											target={'_blank'}
											// onClick={(event): void => event.stopPropagation()}
											style={{background: chainBgColor}} // needed for polygon vaults
											className={cl(
												'rounded-2xl px-3.5 py-1 flex gap-2 items-center text-xs text-neutral-800 hover:opacity-80 '
											)}
										>
											{'Vault'}
											<IconLinkOut className={'inline-block size-4'} />
										</Link>
									) : null}
									<Link
										href={`${getNetwork(chainId)?.defaultBlockExplorer}/address/${address}`}
										onClick={(event): void => event.stopPropagation()}
										style={{background: chainBgColor}} // needed for polygon vaults
										className={cl(
											'rounded-2xl px-3.5 py-1 flex gap-2 items-center text-xs text-neutral-800 hover:opacity-80'
										)}
										target={'_blank'}
										rel={'noopener noreferrer'}
									>
										{truncateHex(address, 4)}
										<IconLinkOut className={'inline-block size-4'} />
									</Link>
								</div>

								<div className={'flex flex-col gap-2'}>
									<div className={'flex flex-row gap-2'}>
										<span className={''}>{'Management Fee:'}</span>
										<span>{formatPercent((fees?.management || 0) * 100, 0)}</span>
									</div>
									<div className={'flex flex-row gap-2'}>
										<span className={''}>{'Performance Fee:'}</span>
										<span>{formatPercent((details?.performanceFee || 0) / 100, 0)}</span>
									</div>
									<div className={'flex flex-row gap-2'}>
										<span className={''}>{'Last Report:'}</span>
										{lastReportTime}
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
