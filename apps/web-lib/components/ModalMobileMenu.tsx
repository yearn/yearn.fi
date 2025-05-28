import React, {cloneElement, Fragment, useEffect, useMemo, useRef, useState} from 'react';
import {useConnect} from 'wagmi';
import {useWeb3} from '@builtbymom/web3/contexts/useWeb3';
import {truncateHex} from '@builtbymom/web3/utils/tools.address';
import {getConfig, retrieveConfig} from '@builtbymom/web3/utils/wagmi';
import {Dialog, Transition, TransitionChild} from '@headlessui/react';

import {useInjectedWallet} from '../hooks/useInjectedWallet';

import type {ReactElement, ReactNode} from 'react';
import type {Chain} from 'viem';
import type {TNetwork} from './Header';
import type {TModal} from './Modal';

type TModalMobileMenu = {
	isOpen: boolean;
	shouldUseWallets: boolean;
	shouldUseNetworks: boolean;
	onClose: () => void;
	children: ReactNode;
	supportedNetworks: Chain[];
};

function Modal(props: TModal): ReactElement {
	const {isOpen, onClose, className = '', children} = props;
	const ref = useRef() as React.MutableRefObject<HTMLDivElement>;

	return (
		<Transition
			show={isOpen}
			as={Fragment}>
			<Dialog
				as={'div'}
				className={'fixed inset-0 overflow-y-auto'}
				style={{zIndex: 88}}
				initialFocus={ref}
				onClose={onClose}>
				<div
					className={`${className} relative flex min-h-screen items-end justify-end px-0 pb-0 pt-4 text-center sm:block sm:p-0`}>
					<TransitionChild
						as={Fragment}
						enter={'ease-out duration-300'}
						enterFrom={'opacity-0'}
						enterTo={'opacity-100'}
						leave={'ease-in duration-200'}
						leaveFrom={'opacity-100'}
						leaveTo={'opacity-0'}>
						<div className={`${className} yearn--modal-overlay`} />
					</TransitionChild>

					<span
						className={'hidden sm:inline-block sm:h-screen sm:align-bottom'}
						aria-hidden={'true'}>
						&#8203;
					</span>
					<TransitionChild
						as={Fragment}
						enter={'ease-out duration-200'}
						enterFrom={'opacity-0 translate-y-full'}
						enterTo={'opacity-100 translate-y-0'}
						leave={'ease-in duration-200'}
						leaveFrom={'opacity-100 translate-y-0'}
						leaveTo={'opacity-0 translate-y-full'}>
						<div
							ref={ref}
							className={`${className} yearn--modal fixed bottom-0`}>
							{children}
						</div>
					</TransitionChild>
				</div>
			</Dialog>
		</Transition>
	);
}

export function ModalMobileMenu(props: TModalMobileMenu): ReactElement {
	const {isOpen, onClose, shouldUseWallets = true, shouldUseNetworks = true, children} = props;
	const {onSwitchChain, isActive, address, ens, lensProtocolHandle, onDesactivate, onConnect, chainID} = useWeb3();
	const [walletIdentity, set_walletIdentity] = useState('Connect a wallet');
	const detectedWalletProvider = useInjectedWallet();
	const {connectors} = useConnect();

	const supportedNetworks = useMemo((): TNetwork[] => {
		connectors; //Hard trigger re-render when connectors change
		try {
			const config = retrieveConfig();
			const noFork = config.chains.filter(({id}): boolean => id !== 1337);
			return noFork.map((network): TNetwork => ({value: network.id, label: network.name}));
		} catch (error) {
			const config = getConfig({chains: props.supportedNetworks as any[]});
			const noFork = config.chains.filter(({id}): boolean => id !== 1337);
			return noFork.map((network): TNetwork => ({value: network.id, label: network.name}));
		}
	}, [connectors, props.supportedNetworks]);

	useEffect((): void => {
		if (!isActive && address) {
			if (ens) {
				set_walletIdentity(ens);
			} else if (lensProtocolHandle) {
				set_walletIdentity(lensProtocolHandle);
			} else {
				set_walletIdentity(truncateHex(address, 4));
			}
		} else if (ens) {
			set_walletIdentity(ens);
		} else if (lensProtocolHandle) {
			set_walletIdentity(lensProtocolHandle);
		} else if (address) {
			set_walletIdentity(truncateHex(address, 4));
		} else {
			set_walletIdentity('Connect a wallet');
		}
	}, [ens, lensProtocolHandle, address, isActive]);

	function renderNotActive(): ReactNode {
		if (shouldUseWallets && !isActive && !address) {
			return (
				<div className={'grid grid-cols-2 gap-2 p-2'}>
					<div
						onClick={onConnect}
						className={'yearn--modalMobileMenu-walletCard'}>
						<div>{cloneElement(detectedWalletProvider.icon, {style: {width: 40, height: 40}})}</div>
						<b className={'mt-4 text-sm text-neutral-500'}>{detectedWalletProvider.name}</b>
					</div>
				</div>
			);
		}
		return null;
	}

	return (
		<Modal
			isOpen={isOpen}
			onClose={(): void => onClose()}>
			<div className={'yearn--modalMobileMenu-content'}>
				{shouldUseWallets ? (
					<h4 className={'yearn--modalMobileMenu-title'}>
						{walletIdentity === 'Connect a wallet' ? walletIdentity : walletIdentity}
					</h4>
				) : null}
				{shouldUseNetworks ? (
					<div className={'yearn--modalMobileMenu-networkIndicator'}>
						<span>
							{'You are connected to'}
							<label
								htmlFor={'network'}
								className={'yearn--modalMobileMenu-select'}>
								<select
									name={'network'}
									id={'network'}
									onChange={(e): void => onSwitchChain(Number(e?.target?.value))}
									className={'yearn--select-no-arrow yearn--select-reset !pr-6 text-sm'}>
									{supportedNetworks.map((network): ReactElement => {
										const label = network.label || `Unknown chain (${network.value})`;
										const selectedID = chainID || 1;
										const isSelected = selectedID === network.value;
										return (
											<option
												key={network.value}
												selected={isSelected}
												value={network.value}>
												{label}
											</option>
										);
									})}
								</select>
								<div className={'yearn--modalMobileMenu-chevron'}>
									<svg
										xmlns={'http://www.w3.org/2000/svg'}
										viewBox={'0 0 448 512'}>
										<path
											d={
												'M224 416c-8.188 0-16.38-3.125-22.62-9.375l-192-192c-12.5-12.5-12.5-32.75 0-45.25s32.75-12.5 45.25 0L224 338.8l169.4-169.4c12.5-12.5 32.75-12.5 45.25 0s12.5 32.75 0 45.25l-192 192C240.4 412.9 232.2 416 224 416z'
											}
											fill={'currentcolor'}
										/>
									</svg>
								</div>
							</label>
						</span>
					</div>
				) : null}
				{!shouldUseWallets || walletIdentity === 'Connect a wallet' ? null : (
					<div className={'yearn--modalMobileMenu-logout'}>
						<svg
							onClick={onDesactivate}
							xmlns={'http://www.w3.org/2000/svg'}
							viewBox={'0 0 512 512'}>
							<path
								d={
									'M288 256C288 273.7 273.7 288 256 288C238.3 288 224 273.7 224 256V32C224 14.33 238.3 0 256 0C273.7 0 288 14.33 288 32V256zM80 256C80 353.2 158.8 432 256 432C353.2 432 432 353.2 432 256C432 201.6 407.3 152.9 368.5 120.6C354.9 109.3 353 89.13 364.3 75.54C375.6 61.95 395.8 60.1 409.4 71.4C462.2 115.4 496 181.8 496 255.1C496 388.5 388.5 496 256 496C123.5 496 16 388.5 16 255.1C16 181.8 49.75 115.4 102.6 71.4C116.2 60.1 136.4 61.95 147.7 75.54C158.1 89.13 157.1 109.3 143.5 120.6C104.7 152.9 80 201.6 80 256z'
								}
								fill={'currentcolor'}
							/>
						</svg>
					</div>
				)}
			</div>
			<div>{renderNotActive()}</div>
			{children ? (
				<>
					{shouldUseNetworks || shouldUseWallets ? (
						<div className={'yearn--modalMobileMenu-separatorWrapper'}>
							<div className={'yearn--modalMobileMenu-separator'} />
						</div>
					) : null}
					<div className={'yearn--modalMobileMenu-childrenWrapper'}>{children}</div>
				</>
			) : (
				<div className={'yearn--modalMobileMenu-childrenWrapper'} />
			)}
		</Modal>
	);
}
