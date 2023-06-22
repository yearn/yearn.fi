import {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {useAsync, useUpdateEffect} from '@react-hookz/web';
import {yToast} from '@yearn-finance/web-lib/components/yToast';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useAddToken} from '@yearn-finance/web-lib/hooks/useAddToken';
import {useDismissToasts} from '@yearn-finance/web-lib/hooks/useDismissToasts';
import {allowanceKey, toAddress} from '@yearn-finance/web-lib/utils/address';
import {LPYBAL_TOKEN_ADDRESS, MAX_UINT_256, STYBAL_TOKEN_ADDRESS, ZAP_YEARN_YBAL_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {formatToNormalizedValue, toBigInt, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatPercent} from '@yearn-finance/web-lib/utils/format.number';
import {isZero} from '@yearn-finance/web-lib/utils/isZero';
import {defaultTxStatus} from '@yearn-finance/web-lib/utils/web3/transaction';
import {useWallet} from '@common/contexts/useWallet';
import {useYearn} from '@common/contexts/useYearn';
import {getVaultAPY} from '@common/utils';
import {approveERC20, deposit} from '@common/utils/actions';
import {ZAP_OPTIONS_FROM, ZAP_OPTIONS_TO} from '@yBal/constants/tokens';
import {useYBal} from '@yBal/contexts/useYBal';
import {simulateZapForMinOut, zapBal} from '@yBal/utils/actions';

import type {ReactElement} from 'react';
import type {Connector} from 'wagmi';
import type {TAddress, VoidPromiseFunction} from '@yearn-finance/web-lib/types';
import type {TDropdownOption, TNormalizedBN} from '@common/types/types';

type TCardTransactor = {
	selectedOptionFrom: TDropdownOption,
	selectedOptionTo: TDropdownOption,
	amount: TNormalizedBN,
	txStatusApprove: typeof defaultTxStatus,
	txStatusZap: typeof defaultTxStatus,
	allowanceFrom: bigint,
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

const CardTransactorContext = createContext<TCardTransactor>({
	selectedOptionFrom: ZAP_OPTIONS_FROM[0],
	selectedOptionTo: ZAP_OPTIONS_TO[0],
	amount: toNormalizedBN(0),
	txStatusApprove: defaultTxStatus,
	txStatusZap: defaultTxStatus,
	allowanceFrom: 0n,
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

function CardTransactorContextApp({
	defaultOptionFrom = ZAP_OPTIONS_FROM[0],
	defaultOptionTo = ZAP_OPTIONS_TO[0],
	children = <div />
}): ReactElement {
	const {provider, isActive, address} = useWeb3();
	const {styBalAPY, allowances, refetchAllowances, slippage} = useYBal();
	const {balancesNonce, balances, refresh} = useWallet();
	const {vaults} = useYearn();
	const [txStatusApprove, set_txStatusApprove] = useState(defaultTxStatus);
	const [txStatusZap, set_txStatusZap] = useState(defaultTxStatus);
	const [selectedOptionFrom, set_selectedOptionFrom] = useState(defaultOptionFrom);
	const [selectedOptionTo, set_selectedOptionTo] = useState(defaultOptionTo);
	const [amount, set_amount] = useState<TNormalizedBN>(toNormalizedBN(0));
	const [hasTypedSomething, set_hasTypedSomething] = useState(false);
	const addToken = useAddToken();
	const {dismissAllToasts} = useDismissToasts();
	const {toast} = yToast();

	/* 🔵 - Yearn Finance ******************************************************
	** useEffect to set the amount to the max amount of the selected token once
	** the wallet is connected, or to 0 if the wallet is disconnected.
	**************************************************************************/
	useEffect((): void => {
		balancesNonce; // remove warning, force deep refresh
		set_amount((prevAmount): TNormalizedBN => {
			if (isActive && isZero(prevAmount.raw) && !hasTypedSomething) {
				return toNormalizedBN(balances[toAddress(selectedOptionFrom.value)]?.raw);
			} if (!isActive && prevAmount.raw > 0n) {
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
		_provider: Connector | undefined,
		_inputToken: TAddress,
		_outputToken: TAddress,
		_amountIn: bigint
	): Promise<{shouldMint: boolean; minOut: bigint;}> => {
		return await simulateZapForMinOut({
			connector: provider,
			contractAddress: ZAP_YEARN_YBAL_ADDRESS,
			inputToken: _inputToken,
			outputToken: _outputToken,
			amountIn: _amountIn
		});
	}, ({shouldMint: false, minOut: 0n}));

	useUpdateEffect((): void => {
		actions.execute(
			provider,
			selectedOptionFrom.value,
			selectedOptionTo.value,
			amount.raw
		);
	}, [actions, provider, amount, selectedOptionFrom.value, selectedOptionTo.value]);

	/* 🔵 - Yearn Finance ******************************************************
	** Approve the spending of token A by the corresponding ZAP contract to
	** perform the swap.
	**************************************************************************/
	const onApprove = useCallback(async (): Promise<void> => {
		const result = await approveERC20({
			connector: provider,
			contractAddress: selectedOptionFrom.value,
			spenderAddress: selectedOptionFrom.zapVia,
			amount: MAX_UINT_256,
			statusHandler: set_txStatusApprove
		});
		if (result.isSuccessful) {
			await Promise.all([
				refetchAllowances(),
				refresh()
			]);
		}
	}, [provider, refresh, selectedOptionFrom.value, selectedOptionFrom.zapVia]);

	/* 🔵 - Yearn Finance ******************************************************
	** Execute a zap using the ZAP contract to migrate from a token A to a
	** supported token B.
	**************************************************************************/
	const onZap = useCallback(async (): Promise<void> => {
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
			// Direct deposit to vault from Bal/yBal balancer LP Token to lp-yBal Vault
			const result = await deposit({
				connector: provider,
				contractAddress: selectedOptionTo.value,
				amount: amount.raw, //amount_in
				statusHandler: set_txStatusZap
			});
			if (result.isSuccessful) {
				set_amount(toNormalizedBN(0));
				await refresh();
				toast(addToMetamaskToast);
			}
		} else {
			// Zap in
			const result = await zapBal({
				connector: provider,
				contractAddress: ZAP_YEARN_YBAL_ADDRESS,
				inputToken: selectedOptionFrom.value, //_input_token
				outputToken: selectedOptionTo.value, //_output_token
				amount: amount.raw, //amount_in
				minAmount: expectedOut.minOut, //_min_out
				slippage: toBigInt(slippage * 100),
				shouldMint: expectedOut.shouldMint,
				statusHandler: set_txStatusZap
			});
			if (result.isSuccessful) {
				set_amount(toNormalizedBN(0));
				await refresh();
				toast(addToMetamaskToast);
			}
		}
	}, [addToken, amount.raw, dismissAllToasts, expectedOut, provider, refresh, selectedOptionFrom.value, selectedOptionFrom.zapVia, selectedOptionTo.decimals, selectedOptionTo.icon?.props.src, selectedOptionTo.symbol, selectedOptionTo.value, slippage, toast]);

	/* 🔵 - Yearn Finance ******************************************************
	** Set of memorized values to limit the number of re-rendering of the
	** component.
	**************************************************************************/
	const fromVaultAPY = useMemo((): string => {
		if (toAddress(selectedOptionFrom.value) === STYBAL_TOKEN_ADDRESS) {
			return `APY ${formatPercent(styBalAPY)}`;
		}
		return getVaultAPY(vaults, selectedOptionFrom.value);
	}, [vaults, selectedOptionFrom, styBalAPY]);

	const toVaultAPY = useMemo((): string => {
		if (toAddress(selectedOptionTo.value) === STYBAL_TOKEN_ADDRESS) {
			return `APY ${formatPercent(styBalAPY)}`;
		}
		return getVaultAPY(vaults, selectedOptionTo.value);
	}, [vaults, selectedOptionTo, styBalAPY]);

	const allowanceFrom = useMemo((): bigint => {
		balancesNonce; // remove warning, force deep refresh
		return toBigInt(allowances?.[allowanceKey(1, toAddress(selectedOptionFrom.value), toAddress(selectedOptionFrom.zapVia), toAddress(address))]);
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
				expectedOutWithSlippage: (
					formatToNormalizedValue(expectedOut.minOut * (1n - toBigInt(slippage * 100) / 10000n))
				),
				set_selectedOptionFrom,
				set_selectedOptionTo,
				set_amount,
				set_hasTypedSomething,
				onApproveFrom: onApprove,
				onZap
			}}>
			{children}
		</CardTransactorContext.Provider>
	);
}

export const useCardTransactor = (): TCardTransactor => useContext(CardTransactorContext);
export default CardTransactorContextApp;
