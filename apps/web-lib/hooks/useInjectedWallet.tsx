import {useMemo} from 'react';

import {IconWalletCoinbase} from '../icons/IconWalletCoinbase';
import {IconWalletFrame} from '../icons/IconWalletFrame';
import {IconWalletLedger} from '../icons/IconWalletLedger';
import {IconWalletMetamask} from '../icons/IconWalletMetamask';
import {IconWalletOKX} from '../icons/IconWalletOKX';
import {IconWalletPhantom} from '../icons/IconWalletPhantom';
import {IconWalletTrustWallet} from '../icons/IconWalletTrustWallet';

import type {ReactElement} from 'react';

export type TWalletProvider = {
	isFrame?: boolean;
	isCoinbaseWallet?: boolean;
	isCoinbaseBrowser?: boolean; //coinbase wallet for mobile
	isMetaMask?: boolean;
	isTrustWallet?: boolean;
	isTrust?: boolean; //trustWallet for mobile
	isPhantom?: boolean;
	isOKExWallet?: boolean;
	isOkxWallet?: boolean;
	isLedgerConnect?: boolean;
};
export type TWindowWalletProvider = {
	ethereum?: TWalletProvider;
	okxwallet?: TWalletProvider;
};

export type TInjectedWallet = {
	name: string;
	icon: ReactElement;
	type:
		| 'NONE'
		| 'INJECTED'
		| 'INJECTED_COINBASE'
		| 'INJECTED_LEDGER'
		| 'WALLET_CONNECT'
		| 'EMBED_LEDGER'
		| 'EMBED_GNOSIS_SAFE'
		| 'EMBED_COINBASE'
		| 'EMBED_TRUSTWALLET';
};

/* 🔵 - Yearn Finance ******************************************************
 ** This hook can be used to grab the current injected wallet provider.
 ** It will return the name and icon of the wallet provider.
 **************************************************************************/
export function useInjectedWallet(): TInjectedWallet {
	const detectedWalletProvider = useMemo((): TInjectedWallet => {
		if (typeof window !== 'undefined') {
			const {ethereum, okxwallet} = window as TWindowWalletProvider;
			if (ethereum?.isLedgerConnect) {
				return {
					name: 'Ledger Connect',
					icon: <IconWalletLedger className={'text-neutral-900'} />,
					type: 'INJECTED_LEDGER'
				};
			}
			if (ethereum?.isCoinbaseBrowser) {
				return {
					name: 'Coinbase',
					icon: <IconWalletCoinbase />,
					type: 'EMBED_COINBASE'
				};
			}
			if (okxwallet?.isOkxWallet || okxwallet?.isOKExWallet) {
				return {
					name: 'OKX Wallet',
					icon: <IconWalletOKX className={'text-neutral-900'} />,
					type: 'INJECTED'
				};
			}
			if (ethereum?.isCoinbaseWallet) {
				return {
					name: 'Coinbase',
					icon: <IconWalletCoinbase />,
					type: 'EMBED_COINBASE'
				};
			}
			if (ethereum?.isFrame) {
				return {
					name: 'Frame',
					icon: <IconWalletFrame />,
					type: 'INJECTED'
				};
			}
			if (ethereum?.isPhantom) {
				return {
					name: 'Phantom',
					icon: <IconWalletPhantom />,
					type: 'INJECTED'
				};
			}
			if (ethereum?.isTrustWallet) {
				return {
					name: 'TrustWallet',
					icon: <IconWalletTrustWallet />,
					type: 'INJECTED'
				};
			}
			if (ethereum?.isTrust) {
				return {
					name: 'TrustWallet',
					icon: <IconWalletTrustWallet />,
					type: 'EMBED_TRUSTWALLET'
				};
			}
			if (ethereum?.isMetaMask) {
				return {
					name: 'Metamask',
					icon: <IconWalletMetamask />,
					type: 'INJECTED'
				};
			}
		}

		//Non supported yet:
		// if (ethereum?.isAvalanche) 'Core Wallet'
		// if (ethereum?.isBitKeep) 'BitKeep'
		// if (ethereum?.isBraveWallet) 'Brave Wallet'
		// if (ethereum?.isExodus) 'Exodus'
		// if (ethereum?.isKuCoinWallet) 'KuCoin Wallet'
		// if (ethereum?.isMathWallet) 'MathWallet'
		// if (ethereum?.isOneInchIOSWallet || ethereum?.isOneInchAndroidWallet) '1inch Wallet'
		// if (ethereum?.isOpera) 'Opera'
		// if (ethereum?.isPortal) 'Ripio Portal'
		// if (ethereum?.isTally) 'Tally'
		// if (ethereum?.isTokenPocket) 'TokenPocket'
		// if (ethereum?.isTokenary) 'Tokenary'

		return {
			name: 'Frame',
			icon: <IconWalletFrame className={'text-neutral-900'} />,
			type: 'INJECTED'
		};
	}, [typeof window]);

	return detectedWalletProvider;
}
