import React, {Fragment, ReactElement} from 'react';
import Image from 'next/image';
import {Popover, Transition} from '@headlessui/react';
import {useWeb3} from '@yearn-finance/web-lib/contexts';
import {AddToMetamask, Wallet} from '@yearn-finance/web-lib/icons';
import {format, TMetamaskInjectedProvider, toAddress} from '@yearn-finance/web-lib/utils';
import {useWallet} from 'contexts/useWallet';

export default function BalanceReminderPopover(): ReactElement {
	const	{balances} = useWallet();
	const	{provider} = useWeb3();

	async function addTokenToMetamask(address: string, symbol: string, decimals: number, image: string): Promise<void> {
		try {
			await (provider as TMetamaskInjectedProvider).send('wallet_watchAsset', {
				type: 'ERC20',
				options: {
					address,
					symbol,
					decimals,
					image
				}
			});
		} catch (error) {
			// Token has not been added to MetaMask.
		}
	}

	return (
		<Popover className={'relative flex'}>
			{(): ReactElement => (
				<>
					<Popover.Button>
						<Wallet className={'yveCRV--nav-link mt-0.5 h-4 w-4'} />
					</Popover.Button>
					<Transition
						as={Fragment}
						enter={'transition ease-out duration-200'}
						enterFrom={'opacity-0 translate-y-1'}
						enterTo={'opacity-100 translate-y-0'}
						leave={'transition ease-in duration-150'}
						leaveFrom={'opacity-100 translate-y-0'}
						leaveTo={'opacity-0 translate-y-1'}
					>
						<Popover.Panel className={'absolute right-0 top-6 z-50 mt-3 w-screen max-w-[200px] md:top-4 md:-right-4 md:max-w-[280px]'}>
							<div className={'overflow-hidden'}>
								<div className={'bg-neutral-100 p-0'}>
									<a
										href={`https://etherscan.io/address/${process.env.YCRV_TOKEN_ADDRESS}`}
										target={'_blank'}
										rel={'noreferrer'}
										className={'flow-root cursor-alias p-2 transition-colors hover:bg-neutral-200'}>
										<span className={'flex flex-row items-center justify-between'}>
											<span className={'flex items-center text-neutral-900'}>
												<div className={'flex w-12'}>
													<Image
														alt={'yCRV'}
														width={32}
														height={32}
														quality={90}
														src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${toAddress(process.env.YCRV_TOKEN_ADDRESS)}/logo-128.png`} />
												</div>
												<span className={'ml-2'}>{'yCRV'}</span>
											</span>
											<span className={'flex flex-row items-center justify-center tabular-nums text-neutral-900'}>
												{format.amount(balances[toAddress(process.env.YCRV_TOKEN_ADDRESS)]?.normalized || 0, 2, 4)}
												<AddToMetamask
													onClick={(e): void => {
														e.preventDefault();
														e.stopPropagation();
														addTokenToMetamask(
															process.env.YCRV_TOKEN_ADDRESS as string,
															'yCRV',
															18,
															`${process.env.BASE_YEARN_ASSETS_URI}/1/${toAddress(process.env.YCRV_TOKEN_ADDRESS)}/logo-128.png`
														);
													}}
													className={'ml-4 h-4 w-4 cursor-pointer text-neutral-400 transition-colors hover:text-neutral-900'} />
											</span>
										</span>
									</a>

									<a
										href={`https://etherscan.io/address/${process.env.STYCRV_TOKEN_ADDRESS}`}
										target={'_blank'}
										rel={'noreferrer'}
										className={'flow-root cursor-alias p-2 transition-colors hover:bg-neutral-200'}>
										<span className={'flex flex-row items-center justify-between'}>
											<span className={'flex items-center text-neutral-900'}>
												<div className={'flex w-12'}>
													<Image
														alt={'st-yCRV'}
														width={32}
														height={32}
														quality={90}
														src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${toAddress(process.env.STYCRV_TOKEN_ADDRESS)}/logo-128.png`} />
												</div>
												<span className={'ml-2'}>{'st-yCRV'}</span>
											</span>
											<span className={'flex flex-row items-center justify-center tabular-nums text-neutral-900'}>
												{format.amount(balances[toAddress(process.env.STYCRV_TOKEN_ADDRESS)]?.normalized || 0, 2, 4)}
												<AddToMetamask
													onClick={(e): void => {
														e.preventDefault();
														e.stopPropagation();
														addTokenToMetamask(
															process.env.STYCRV_TOKEN_ADDRESS as string,
															'st-yCRV',
															18,
															`${process.env.BASE_YEARN_ASSETS_URI}/1/${toAddress(process.env.STYCRV_TOKEN_ADDRESS)}/logo-128.png`
														);
													}}
													className={'ml-4 h-4 w-4 cursor-pointer text-neutral-400 transition-colors hover:text-neutral-900'} />
											</span>
										</span>
									</a>

									<a
										href={`https://etherscan.io/address/${process.env.LPYCRV_TOKEN_ADDRESS}`}
										target={'_blank'}
										rel={'noreferrer'}
										className={'flow-root cursor-alias p-2 transition-colors hover:bg-neutral-200'}>
										<span className={'flex flex-row items-center justify-between'}>
											<span className={'flex items-center text-neutral-900'}>
												<div className={'flex w-12'}>
													<Image
														alt={'lp-yCRV'}
														width={32}
														height={32}
														quality={90}
														src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${toAddress(process.env.LPYCRV_TOKEN_ADDRESS)}/logo-128.png`} />
												</div>
												<span className={'ml-2'}>{'lp-yCRV'}</span>
											</span>
											<span className={'flex flex-row items-center justify-center tabular-nums text-neutral-900'}>
												{format.amount(balances[toAddress(process.env.LPYCRV_TOKEN_ADDRESS)]?.normalized || 0, 2, 4)}
												<AddToMetamask
													onClick={(e): void => {
														e.preventDefault();
														e.stopPropagation();
														addTokenToMetamask(
															process.env.LPYCRV_TOKEN_ADDRESS as string,
															'lp-yCRV',
															18,
															`${process.env.BASE_YEARN_ASSETS_URI}/1/${toAddress(process.env.LPYCRV_TOKEN_ADDRESS)}/logo-128.png`
														);
													}}
													className={'ml-4 h-4 w-4 cursor-pointer text-neutral-400 transition-colors hover:text-neutral-900'} />
											</span>
										</span>
									</a>

									<a
										href={`https://etherscan.io/address/${process.env.YCRV_CURVE_POOL_ADDRESS}`}
										target={'_blank'}
										rel={'noreferrer'}
										className={'flow-root cursor-alias p-2 transition-colors hover:bg-neutral-200'}>
										<span className={'flex flex-row items-center justify-between'}>
											<span className={'flex items-center text-neutral-900'}>
												<div className={'flex w-12'}>
													<Image
														alt={'lp-crv/yCRV'}
														width={32}
														height={32}
														quality={90}
														src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${toAddress(process.env.YCRV_CURVE_POOL_ADDRESS)}/logo-128.png`} />
												</div>
												<span className={'ml-2'}>{'Curve CRV/yCRV'}</span>
											</span>
											<span className={'flex flex-row items-center justify-center tabular-nums text-neutral-900'}>
												{format.amount(balances[toAddress(process.env.YCRV_CURVE_POOL_ADDRESS)]?.normalized || 0, 2, 4)}
												<AddToMetamask
													onClick={(e): void => {
														e.preventDefault();
														e.stopPropagation();
														addTokenToMetamask(
															process.env.YCRV_CURVE_POOL_ADDRESS as string,
															'Curve CRV/yCRV LP Token',
															18,
															`${process.env.BASE_YEARN_ASSETS_URI}/1/${toAddress(process.env.YCRV_CURVE_POOL_ADDRESS)}/logo-128.png`
														);
													}}
													className={'ml-4 h-4 w-4 cursor-pointer text-neutral-400 transition-colors hover:text-neutral-900'} />
											</span>
										</span>
									</a>


								</div>
							</div>
						</Popover.Panel>
					</Transition>
				</>
			)}
		</Popover>
	);
}
