import {Fragment, useMemo} from 'react';
import {Popover, Transition} from '@headlessui/react';
import {captureException} from '@sentry/nextjs';
import {Renderable} from '@yearn-finance/web-lib/components/Renderable';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {IconAddToMetamask} from '@yearn-finance/web-lib/icons/IconAddToMetamask';
import {IconCross} from '@yearn-finance/web-lib/icons/IconCross';
import {IconWallet} from '@yearn-finance/web-lib/icons/IconWallet';
import {toAddress, truncateHex} from '@yearn-finance/web-lib/utils/address';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {ImageWithFallback} from '@common/components/ImageWithFallback';
import {useWallet} from '@common/contexts/useWallet';
import {useYearn} from '@common/contexts/useYearn';
import {useBalance} from '@common/hooks/useBalance';

import type {ReactElement} from 'react';
import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TChainTokens} from '@common/types/types';

type TBalanceReminderElement = {
	address: TAddress;
	chainID: number;
	normalizedBalance: number;
	decimals: number;
	symbol: string;
};

function TokenItem({element}: {element: TBalanceReminderElement}): ReactElement {
	const {provider} = useWeb3();
	const balance = useBalance({address: element.address, chainID: element.chainID});

	async function addTokenToMetamask(address: TAddress, symbol: string, decimals: number, image: string): Promise<void> {
		if (!provider) {
			return;
		}

		try {
			const walletClient = await provider.getWalletClient();
			await walletClient.watchAsset({
				type: 'ERC20',
				options: {address, decimals, symbol, image}
			});
		} catch (error) {
			captureException(error);
			console.warn(error);
		}
	}

	return (
		<a
			key={element.address}
			href={`https://etherscan.io/address/${element.address}`}
			target={'_blank'}
			rel={'noreferrer'}
			className={'flow-root cursor-alias p-2 transition-colors hover:bg-neutral-200 md:p-4'}>
			<span className={'flex flex-row items-center justify-between'}>
				<span className={'flex items-center text-neutral-900'}>
					<div className={'flex w-12'}>
						<ImageWithFallback
							alt={element.symbol}
							width={32}
							height={32}
							quality={90}
							src={`${process.env.BASE_YEARN_ASSETS_URI}/${element.chainID}/${toAddress(element.address)}/logo-128.png`}
						/>
					</div>
					<span className={'ml-2'}>{element.symbol}</span>
				</span>
				<span className={'font-number flex flex-row items-center justify-center text-neutral-900'}>
					{formatAmount(balance.normalized, 2, 4)}
					<IconAddToMetamask
						onClick={(e): void => {
							e.preventDefault();
							e.stopPropagation();
							addTokenToMetamask(
								element.address,
								element.symbol,
								element.decimals,
								`${process.env.BASE_YEARN_ASSETS_URI}/${element.chainID}/${toAddress(element.address)}/logo-128.png`
							);
						}}
						className={'ml-4 h-4 w-4 cursor-pointer text-neutral-400 transition-colors hover:text-neutral-900'}
					/>
				</span>
			</span>
		</a>
	);
}

export function BalanceReminderPopover(): ReactElement {
	const {balances: tokens, isLoading} = useWallet();
	const {address, ens, isActive, onDesactivate} = useWeb3();
	const {vaults} = useYearn();

	const nonNullBalances = useMemo((): TChainTokens => {
		const nonNullBalances: TChainTokens = {};

		for (const [chainIDStr, chainTokens] of Object.entries(tokens)) {
			const chainID = Number(chainIDStr);
			nonNullBalances[chainID] = {};
			for (const [, token] of Object.entries(chainTokens)) {
				if (token.balance.raw > 0n) {
					nonNullBalances[chainID][token.address] = token;
				}
			}
		}
		return nonNullBalances;
	}, [tokens]);

	const nonNullBalancesForVault = useMemo((): TBalanceReminderElement[] => {
		const nonNullBalancesForVault: TBalanceReminderElement[] = [];

		for (const [, chainBalanceData] of Object.entries(nonNullBalances)) {
			for (const [address, token] of Object.entries(chainBalanceData)) {
				if (token.balance.raw > 0n) {
					const currentVault = vaults?.[toAddress(address)];
					if (currentVault) {
						nonNullBalancesForVault.push({
							address: toAddress(address),
							chainID: currentVault.chainID,
							normalizedBalance: Number(token.balance.normalized),
							decimals: token.decimals,
							symbol: currentVault.symbol
						});
					}
				}
			}
		}
		return nonNullBalancesForVault;
	}, [nonNullBalances]);

	function renderNoTokenFallback(isLoading: boolean): ReactElement {
		if (isLoading) {
			return <div className={'py-4 text-center text-sm text-neutral-400'}>{'Retrieving your yvTokens ...'}</div>;
		}
		return <div className={'py-4 text-center text-sm text-neutral-400'}>{'No position in Yearn found.'}</div>;
	}

	return (
		<Popover className={'relative flex'}>
			{(): ReactElement => (
				<>
					<Popover.Button>
						<IconWallet className={'yearn--header-nav-item mt-0.5 h-4 w-4'} />
					</Popover.Button>
					<Transition
						as={Fragment}
						enter={'transition ease-out duration-200'}
						enterFrom={'opacity-0 translate-y-1'}
						enterTo={'opacity-100 translate-y-0'}
						leave={'transition ease-in duration-150'}
						leaveFrom={'opacity-100 translate-y-0'}
						leaveTo={'opacity-0 translate-y-1'}>
						<Popover.Panel className={'yearn--shadow absolute right-0 top-6 z-[1000] mt-3 w-screen max-w-xs md:-right-4 md:top-4'}>
							<div className={'overflow-hidden'}>
								<div className={'relative bg-neutral-0 p-0'}>
									<div className={'flex items-center justify-center border-b border-neutral-300 py-4 text-center'}>
										<b>{isActive && address && ens ? ens : isActive && address ? truncateHex(address, 5) : 'Connect wallet'}</b>
									</div>
									<div className={'absolute right-4 top-4'}>
										<button
											onClick={onDesactivate}
											className={'flex h-6 w-6 items-center justify-center rounded-full bg-neutral-200/50'}>
											<IconCross className={'h-4 w-4 text-neutral-600'} />
										</button>
									</div>
									<Renderable
										shouldRender={nonNullBalancesForVault.length > 0}
										fallback={renderNoTokenFallback(isLoading)}>
										{nonNullBalancesForVault.map(
											(element): ReactElement => (
												<TokenItem
													key={`${element.chainID}-${element.address}`}
													element={element}
												/>
											)
										)}
									</Renderable>
								</div>
							</div>
						</Popover.Panel>
					</Transition>
				</>
			)}
		</Popover>
	);
}
