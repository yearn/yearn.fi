import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {ethers} from 'ethers';
import useSWR from 'swr';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {allowanceKey, toAddress} from '@yearn-finance/web-lib/utils/address';
import {LPYCRV_TOKEN_ADDRESS, STYCRV_TOKEN_ADDRESS, YCRV_CURVE_POOL_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import performBatchedUpdates from '@yearn-finance/web-lib/utils/performBatchedUpdates';
import {getProvider} from '@yearn-finance/web-lib/utils/web3/providers';
import {defaultTxStatus, Transaction} from '@yearn-finance/web-lib/utils/web3/transaction';
import {useWallet} from '@common/contexts/useWallet';
import {useYearn} from '@common/contexts/useYearn';
import {getAmountWithSlippage, getVaultAPY} from '@common/utils';
import {approveERC20} from '@common/utils/actions/approveToken';
import {deposit} from '@common/utils/actions/deposit';
import {useYCRV} from '@yCRV/contexts/useYCRV';
import {zap} from '@yCRV/utils/actions/zap';
import {LEGACY_OPTIONS_FROM, LEGACY_OPTIONS_TO} from '@yCRV/utils/zapOptions';

import type {BigNumber} from 'ethers';
import type {ReactElement} from 'react';
import type {TDropdownOption, TNormalizedBN} from '@common/types/types';

type TCardTransactor = {
	selectedOptionFrom: TDropdownOption,
	selectedOptionTo: TDropdownOption,
	amount: TNormalizedBN,
	txStatusApprove: typeof defaultTxStatus,
	txStatusZap: typeof defaultTxStatus,
	allowanceFrom: BigNumber,
	fromVaultAPY: string,
	toVaultAPY: string,
	expectedOutWithSlippage: number,
	set_selectedOptionFrom: (option: TDropdownOption) => void,
	set_selectedOptionTo: (option: TDropdownOption) => void,
	set_amount: (amount: TNormalizedBN) => void,
	set_hasTypedSomething: (hasTypedSomething: boolean) => void,
	onApproveFrom: () => Promise<void>,
	onIncreaseCRVAllowance: () => Promise<void>,
	onZap: () => Promise<void>
}

const		CardTransactorContext = createContext<TCardTransactor>({
	selectedOptionFrom: LEGACY_OPTIONS_FROM[0],
	selectedOptionTo: LEGACY_OPTIONS_TO[0],
	amount: {raw: ethers.constants.Zero, normalized: 0},
	txStatusApprove: defaultTxStatus,
	txStatusZap: defaultTxStatus,
	allowanceFrom: ethers.constants.Zero,
	fromVaultAPY: '',
	toVaultAPY: '',
	expectedOutWithSlippage: 0,
	set_selectedOptionFrom: (): void => undefined,
	set_selectedOptionTo: (): void => undefined,
	set_amount: (): void => undefined,
	set_hasTypedSomething: (): void => undefined,
	onApproveFrom: (): any => undefined,
	onZap: (): any => undefined,
	onIncreaseCRVAllowance: (): any => undefined
});

function	CardTransactorContextApp({
	defaultOptionFrom = LEGACY_OPTIONS_FROM[0],
	defaultOptionTo = LEGACY_OPTIONS_TO[0],
	children = <div />
}): ReactElement {
	const	{provider, isActive} = useWeb3();
	const	{styCRVAPY, allowances} = useYCRV();
	const	{useWalletNonce, balances, refresh, slippage} = useWallet();
	const	{vaults} = useYearn();
	const	[txStatusApprove, set_txStatusApprove] = useState(defaultTxStatus);
	const	[txStatusZap, set_txStatusZap] = useState(defaultTxStatus);
	const	[selectedOptionFrom, set_selectedOptionFrom] = useState(defaultOptionFrom);
	const	[selectedOptionTo, set_selectedOptionTo] = useState(defaultOptionTo);
	const	[amount, set_amount] = useState<TNormalizedBN>({raw: ethers.constants.Zero, normalized: 0});
	const	[hasTypedSomething, set_hasTypedSomething] = useState(false);

	/* 🔵 - Yearn Finance ******************************************************
	** useEffect to set the amount to the max amount of the selected token once
	** the wallet is connected, or to 0 if the wallet is disconnected.
	**************************************************************************/
	useEffect((): void => {
		if (isActive && amount.raw.eq(0) && !hasTypedSomething) {
			set_amount({
				raw: balances[toAddress(selectedOptionFrom.value)]?.raw || ethers.constants.Zero,
				normalized: balances[toAddress(selectedOptionFrom.value)]?.normalized || 0
			});
		} else if (!isActive && amount.raw.gt(0)) {
			performBatchedUpdates((): void => {
				set_amount({raw: ethers.constants.Zero, normalized: 0});
				set_hasTypedSomething(false);
			});
		}
	}, [isActive, selectedOptionFrom, amount.raw, hasTypedSomething, balances]);

	/* 🔵 - Yearn Finance ******************************************************
	** Perform a smartContract call to the ZAP contract to get the expected
	** out for a given in/out pair with a specific amount. This callback is
	** called every 10s or when amount/in or out changes.
	**************************************************************************/
	const expectedOutFetcher = useCallback(async (
		_inputToken: string,
		_outputToken: string,
		_amountIn: BigNumber
	): Promise<BigNumber> => {
		const	currentProvider = provider || getProvider(1);

		if (_inputToken === YCRV_CURVE_POOL_ADDRESS) {
			// Direct deposit to vault from crv/yCRV Curve LP Token to lp-yCRV Vault
			const	contract = new ethers.Contract(
				LPYCRV_TOKEN_ADDRESS,
				['function pricePerShare() public view returns (uint256)'],
				currentProvider
			);
			try {
				const	pps = await contract.pricePerShare() || ethers.constants.Zero;
				const	_expectedOut = _amountIn.mul(pps).div(ethers.constants.WeiPerEther);
				return _expectedOut;
			} catch (error) {
				return (ethers.constants.Zero);
			}
		} else {
			// Zap in
			const	contract = new ethers.Contract(
				ZAP_YEARN_VE_CRV_ADDRESS,
				['function calc_expected_out(address, address, uint256) public view returns (uint256)'],
				currentProvider
			);
			try {
				const	_expectedOut = await contract.calc_expected_out(_inputToken, _outputToken, _amountIn) || ethers.constants.Zero;
				return _expectedOut;
			} catch (error) {
				return (ethers.constants.Zero);
			}
		}
	}, [provider]);

	/* 🔵 - Yearn Finance ******************************************************
	** SWR hook to get the expected out for a given in/out pair with a specific
	** amount. This hook is called every 10s or when amount/in or out changes.
	** Calls the expectedOutFetcher callback.
	**************************************************************************/
	const	{data: expectedOut} = useSWR(
		isActive && amount.raw.gt(0) ? [
			selectedOptionFrom.value,
			selectedOptionTo.value,
			amount.raw
		] : null,
		expectedOutFetcher,
		{refreshInterval: 30000, shouldRetryOnError: false, revalidateOnFocus: false}
	);

	/* 🔵 - Yearn Finance ******************************************************
	** Approve the spending of token A by the corresponding ZAP contract to
	** perform the swap.
	**************************************************************************/
	async function	onApproveFrom(): Promise<void> {
		new Transaction(provider, approveERC20, set_txStatusApprove).populate(
			toAddress(selectedOptionFrom.value),
			selectedOptionFrom.zapVia,
			ethers.constants.MaxUint256
		).onSuccess(async (): Promise<void> => {
			await refresh();
		}).perform();
	}

	/* 🔵 - Yearn Finance ******************************************************
	** CRV token require the allowance to be reset to 0 before being able to
	** increase it. This function is called when the user wants to increase the
	** allowance of the CRV token.
	**************************************************************************/
	async function	onIncreaseCRVAllowance(): Promise<void> {
		await new Transaction(provider, approveERC20, set_txStatusApprove).populate(
			toAddress(selectedOptionFrom.value),
			selectedOptionFrom.zapVia,
			0
		).perform();

		new Transaction(provider, approveERC20, set_txStatusApprove).populate(
			toAddress(selectedOptionFrom.value),
			selectedOptionFrom.zapVia,
			ethers.constants.MaxUint256
		).onSuccess(async (): Promise<void> => {
			await refresh();
		}).perform();
	}

	/* 🔵 - Yearn Finance ******************************************************
	** Execute a zap using the ZAP contract to migrate from a token A to a
	** supported token B.
	**************************************************************************/
	async function	onZap(): Promise<void> {
		if (selectedOptionFrom.zapVia === LPYCRV_TOKEN_ADDRESS) {
			// Direct deposit to vault from crv/yCRV Curve LP Token to lp-yCRV Vault
			new Transaction(provider, deposit, set_txStatusZap).populate(
				toAddress(selectedOptionTo.value), //destination vault
				amount.raw //amount_in
			).onSuccess(async (): Promise<void> => {
				set_amount({raw: ethers.constants.Zero, normalized: 0});
				await refresh();
			}).perform();
		} else {
			// Zap in
			new Transaction(provider, zap, set_txStatusZap).populate(
				toAddress(selectedOptionFrom.value), //_input_token
				toAddress(selectedOptionTo.value), //_output_token
				amount.raw, //amount_in
				expectedOut, //_min_out
				slippage
			).onSuccess(async (): Promise<void> => {
				set_amount({raw: ethers.constants.Zero, normalized: 0});
				await refresh();
			}).perform();
		}
	}

	/* 🔵 - Yearn Finance ******************************************************
	** Set of memorized values to limit the number of re-rendering of the
	** component.
	**************************************************************************/
	const	fromVaultAPY = useMemo((): string => {
		if (toAddress(selectedOptionFrom.value) === STYCRV_TOKEN_ADDRESS) {
			return `APY ${formatAmount(styCRVAPY, 2, 2)} %`;
		}
		return getVaultAPY(vaults, selectedOptionFrom.value);
	}, [vaults, selectedOptionFrom, styCRVAPY]);

	const	toVaultAPY = useMemo((): string => {
		if (toAddress(selectedOptionTo.value) === STYCRV_TOKEN_ADDRESS) {
			return `APY ${formatAmount(styCRVAPY, 2, 2)} %`;
		}
		return getVaultAPY(vaults, selectedOptionTo.value);
	}, [vaults, selectedOptionTo, styCRVAPY]);

	const	expectedOutWithSlippage = useMemo((): number => getAmountWithSlippage(
		selectedOptionFrom.value,
		selectedOptionTo.value,
		expectedOut || ethers.constants.Zero,
		slippage
	), [expectedOut, selectedOptionFrom.value, selectedOptionTo.value, slippage]);

	const	allowanceFrom = useMemo((): BigNumber => {
		useWalletNonce; // remove warning
		return allowances?.[allowanceKey(selectedOptionFrom.value, selectedOptionFrom.zapVia)] || ethers.constants.Zero;
	}, [useWalletNonce, allowances, selectedOptionFrom.value, selectedOptionFrom.zapVia]);

	return (
		<CardTransactorContext.Provider
			value={{
				selectedOptionFrom,
				selectedOptionTo,
				amount,
				txStatusApprove,
				txStatusZap,
				allowanceFrom,
				fromVaultAPY,
				toVaultAPY,
				expectedOutWithSlippage,
				set_selectedOptionFrom,
				set_selectedOptionTo,
				set_amount,
				set_hasTypedSomething,
				onApproveFrom,
				onIncreaseCRVAllowance,
				onZap
			}}>
			{children}
		</CardTransactorContext.Provider>
	);
}

export const useCardTransactor = (): TCardTransactor => useContext(CardTransactorContext);
export default CardTransactorContextApp;
