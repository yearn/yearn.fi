import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {ethers} from 'ethers';
import {useAsync, useUpdateEffect} from '@react-hookz/web';
import {yToast} from '@yearn-finance/web-lib/components/yToast';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useAddToken} from '@yearn-finance/web-lib/hooks/useAddToken';
import {useDismissToasts} from '@yearn-finance/web-lib/hooks/useDismissToasts';
import {allowanceKey, toAddress} from '@yearn-finance/web-lib/utils/address';
import {LPYBAL_TOKEN_ADDRESS, STYBAL_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {formatBN, toNormalizedBN, Zero} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatPercent} from '@yearn-finance/web-lib/utils/format.number';
import {getProvider} from '@yearn-finance/web-lib/utils/web3/providers';
import {defaultTxStatus, Transaction} from '@yearn-finance/web-lib/utils/web3/transaction';
import {useWallet} from '@common/contexts/useWallet';
import {useYearn} from '@common/contexts/useYearn';
import {getAmountWithSlippage, getVaultAPY} from '@common/utils';
import {approveERC20} from '@common/utils/actions/approveToken';
import {deposit} from '@common/utils/actions/deposit';
import {ZAP_OPTIONS_FROM, ZAP_OPTIONS_TO} from '@yBal/constants/tokens';
import {useYBal} from '@yBal/contexts/useYBal';
import {simulateZapForMinOut, zap} from '@yBal/utils/actions';

import type {BigNumber} from 'ethers';
import type {ReactElement} from 'react';
import type {TAddress, VoidPromiseFunction} from '@yearn-finance/web-lib/types';
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
	onApproveFrom: VoidPromiseFunction,
	onZap: VoidPromiseFunction
}

const		CardTransactorContext = createContext<TCardTransactor>({
	selectedOptionFrom: ZAP_OPTIONS_FROM[0],
	selectedOptionTo: ZAP_OPTIONS_TO[0],
	amount: toNormalizedBN(0),
	txStatusApprove: defaultTxStatus,
	txStatusZap: defaultTxStatus,
	allowanceFrom: Zero,
	fromVaultAPY: '',
	toVaultAPY: '',
	expectedOutWithSlippage: 0,
	set_selectedOptionFrom: (): void => undefined,
	set_selectedOptionTo: (): void => undefined,
	set_amount: (): void => undefined,
	set_hasTypedSomething: (): void => undefined,
	onApproveFrom: async (): Promise<void> => undefined,
	onZap: async (): Promise<void> => undefined
});

function	CardTransactorContextApp({
	defaultOptionFrom = ZAP_OPTIONS_FROM[0],
	defaultOptionTo = ZAP_OPTIONS_TO[0],
	children = <div />
}): ReactElement {
	const	{provider, isActive, address} = useWeb3();
	const	{styBalAPY, allowances, slippage} = useYBal();
	const	{balancesNonce, balances, refresh} = useWallet();
	const	{vaults} = useYearn();
	const	[txStatusApprove, set_txStatusApprove] = useState(defaultTxStatus);
	const	[txStatusZap, set_txStatusZap] = useState(defaultTxStatus);
	const	[selectedOptionFrom, set_selectedOptionFrom] = useState(defaultOptionFrom);
	const	[selectedOptionTo, set_selectedOptionTo] = useState(defaultOptionTo);
	const	[amount, set_amount] = useState<TNormalizedBN>(toNormalizedBN(0));
	const	[hasTypedSomething, set_hasTypedSomething] = useState(false);
	const	addToken = useAddToken();
	const 	{dismissAllToasts} = useDismissToasts();
	const 	{toast} = yToast();

	/* 🔵 - Yearn Finance ******************************************************
	** useEffect to set the amount to the max amount of the selected token once
	** the wallet is connected, or to 0 if the wallet is disconnected.
	**************************************************************************/
	useEffect((): void => {
		balancesNonce; // remove warning, force deep refresh
		set_amount((prevAmount): TNormalizedBN => {
			if (isActive && prevAmount.raw.eq(0) && !hasTypedSomething) {
				return toNormalizedBN(balances[toAddress(selectedOptionFrom.value)]?.raw);
			} if (!isActive && prevAmount.raw.gt(0)) {
				return toNormalizedBN(0);
			}
			return prevAmount;
		});
	}, [isActive, selectedOptionFrom.value, balances, hasTypedSomething, balancesNonce]);
	useUpdateEffect((): void => {
		if (!isActive) {
			set_hasTypedSomething(false);
		}
	}, [isActive]);

	/* 🔵 - Yearn Finance ******************************************************
	** Perform a smartContract call to the ZAP contract to get the expected
	** out for a given in/out pair with a specific amount. This callback is
	** called every 10s or when amount/in or out changes.
	**************************************************************************/
	const [{result: expectedOut}, actions] = useAsync(async (
		_provider: ethers.providers.JsonRpcProvider,
		_inputToken: TAddress,
		_outputToken: TAddress,
		_amountIn: BigNumber
	): Promise<BigNumber> => {
		const currentProvider = _provider || getProvider(1);
		const {minOut} = await simulateZapForMinOut(currentProvider, _inputToken, _outputToken, _amountIn);
		return minOut;
	}, Zero);

	useUpdateEffect((): void => {
		actions.execute(provider, toAddress(selectedOptionFrom.value), toAddress(selectedOptionTo.value), amount.raw);
	}, [actions, provider, amount, selectedOptionFrom.value, selectedOptionTo.value]);

	/* 🔵 - Yearn Finance ******************************************************
	** Approve the spending of token A by the corresponding ZAP contract to
	** perform the swap.
	**************************************************************************/
	const onApproveFrom = useCallback(async (): Promise<void> => {
		new Transaction(provider, approveERC20, set_txStatusApprove).populate(
			toAddress(selectedOptionFrom.value),
			selectedOptionFrom.zapVia,
			ethers.constants.MaxUint256
		).onSuccess(async (): Promise<void> => {
			await refresh();
		}).perform();
	}, [provider, selectedOptionFrom, refresh]);

	/* 🔵 - Yearn Finance ******************************************************
	** Execute a zap using the ZAP contract to migrate from a token A to a
	** supported token B.
	**************************************************************************/
	async function	onZap(): Promise<void> {
		dismissAllToasts();

		const addToMetamaskToast = {
			type: 'info' as const,
			content: `Add ${selectedOptionTo.symbol} to Metamask?`,
			duration: Infinity,
			cta: {
				label: 'Add +',
				onClick: (): void => addToken({
					address: selectedOptionTo.value,
					symbol: selectedOptionTo.symbol,
					decimals: selectedOptionTo.decimals,
					image: selectedOptionTo.icon?.props.src
				})
			}
		};

		if (selectedOptionFrom.zapVia === LPYBAL_TOKEN_ADDRESS) {
			// Direct deposit to vault from bal/yB Curve LP Token to lp-yB Vault
			new Transaction(provider, deposit, set_txStatusZap).populate(
				toAddress(selectedOptionTo.value), //destination vault
				amount.raw //amount_in
			).onSuccess(async (): Promise<void> => {
				set_amount(toNormalizedBN(0));
				await refresh();
				toast(addToMetamaskToast);
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
				set_amount(toNormalizedBN(0));
				await refresh();
				toast(addToMetamaskToast);
			}).perform();
		}
	}

	/* 🔵 - Yearn Finance ******************************************************
	** Set of memorized values to limit the number of re-rendering of the
	** component.
	**************************************************************************/
	const	fromVaultAPY = useMemo((): string => {
		if (toAddress(selectedOptionFrom.value) === STYBAL_TOKEN_ADDRESS) {
			return `APY ${formatPercent(styBalAPY)}`;
		}
		return getVaultAPY(vaults, selectedOptionFrom.value);
	}, [vaults, selectedOptionFrom, styBalAPY]);

	const	toVaultAPY = useMemo((): string => {
		if (toAddress(selectedOptionTo.value) === STYBAL_TOKEN_ADDRESS) {
			return `APY ${formatPercent(styBalAPY)}`;
		}
		return getVaultAPY(vaults, selectedOptionTo.value);
	}, [vaults, selectedOptionTo, styBalAPY]);

	const	expectedOutWithSlippage = useMemo((): number => getAmountWithSlippage(
		selectedOptionFrom.value,
		selectedOptionTo.value,
		formatBN(expectedOut),
		slippage
	), [expectedOut, selectedOptionFrom.value, selectedOptionTo.value, slippage]);

	const	allowanceFrom = useMemo((): BigNumber => {
		balancesNonce; // remove warning, force deep refresh
		return formatBN(allowances?.[allowanceKey(1, toAddress(selectedOptionFrom.value), toAddress(selectedOptionFrom.zapVia), toAddress(address))]);
	}, [balancesNonce, allowances, selectedOptionFrom.value, selectedOptionFrom.zapVia, address]);

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
				onZap
			}}>
			{children}
		</CardTransactorContext.Provider>
	);
}

export const useCardTransactor = (): TCardTransactor => useContext(CardTransactorContext);
export default CardTransactorContextApp;
