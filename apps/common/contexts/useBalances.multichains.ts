import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {erc20Abi} from 'viem';
import XXH from 'xxhashjs';
import {useWeb3} from 'builtbymom-web3-fork/contexts/useWeb3';
import {useAsyncTrigger} from 'builtbymom-web3-fork/hooks/useAsyncTrigger';
import {AGGREGATE3_ABI} from 'builtbymom-web3-fork/utils/abi/aggregate.abi';
import {ETH_TOKEN_ADDRESS, MULTICALL3_ADDRESS} from 'builtbymom-web3-fork/utils/constants';
import {decodeAsBigInt, decodeAsNumber, decodeAsString} from 'builtbymom-web3-fork/utils/decoder';
import {toNormalizedBN} from 'builtbymom-web3-fork/utils/format';
import {toAddress} from 'builtbymom-web3-fork/utils/tools.address';
import {isEthAddress, isZero, isZeroAddress} from 'builtbymom-web3-fork/utils/tools.is';
import {retrieveConfig} from 'builtbymom-web3-fork/utils/wagmi';
import {getNetwork} from 'builtbymom-web3-fork/utils/wagmi/utils';
import {useDeepCompareMemo} from '@react-hookz/web';
import {deserialize, multicall, serialize} from '@wagmi/core';
import {type MulticallParameters} from '@wagmi/core';

import type {DependencyList} from 'react';
import type {Connector} from 'wagmi';
import type {TAddress} from 'builtbymom-web3-fork/types/address';
import type {TChainTokens, TDefaultStatus, TDict, TNDict, TToken} from 'builtbymom-web3-fork/types/mixed';

export function createUniqueID(msg: string): string {
	const hash = XXH.h32(0x536d6f6c).update(msg).digest().toString(16);
	return hash;
}

/*******************************************************************************
 ** Request, Response and helpers for the useBalances hook.
 ******************************************************************************/
export type TUseBalancesTokens = {
	address: TAddress;
	chainID: number;
	decimals?: number;
	name?: string;
	symbol?: string;
	for?: string;
};
export type TUseBalancesReq = {
	key?: string | number;
	tokens: TUseBalancesTokens[];
	priorityChainID?: number;
	effectDependencies?: DependencyList;
	provider?: Connector;
};

export type TChainStatus = {
	chainLoadingStatus: TNDict<boolean>;
	chainSuccessStatus: TNDict<boolean>;
	chainErrorStatus: TNDict<boolean>;
};

export type TUseBalancesRes = {
	data: TChainTokens;
	onUpdate: (shouldForceFetch?: boolean) => Promise<TChainTokens>;
	onUpdateSome: (token: TUseBalancesTokens[], shouldForceFetch?: boolean) => Promise<TChainTokens>;
	error?: Error;
	status: 'error' | 'loading' | 'success' | 'unknown';
} & Omit<TDefaultStatus, 'isFetched' | 'isRefetching' | 'isFetching'> &
	TChainStatus;

type TDataRef = {
	nonce: number;
	address: TAddress;
	balances: TChainTokens;
};

type TUpdates = TDict<TToken & {lastUpdate: number; owner: TAddress}>; // key=chainID/address
const TOKEN_UPDATE: TUpdates = {};

/*******************************************************************************
 ** Default status for the loading state.
 ******************************************************************************/
const defaultStatus = {
	isLoading: false,
	isFetching: false,
	isSuccess: false,
	isError: false,
	isFetched: false,
	isRefetching: false
};

const defaultChainStatus = {
	chainLoadingStatus: {},
	chainSuccessStatus: {},
	chainErrorStatus: {}
};

export async function performCall(
	chainID: number,
	chunckCalls: MulticallParameters['contracts'],
	tokens: TUseBalancesTokens[],
	ownerAddress: TAddress
): Promise<[TDict<TToken>, Error | undefined]> {
	let results: (
		| {
				error?: undefined;
				result: never;
				status: 'success';
		  }
		| {
				error: Error;
				result?: undefined;
				status: 'failure';
		  }
	)[] = [];
	try {
		results = await multicall(retrieveConfig(), {
			contracts: chunckCalls as never[],
			chainId: chainID
		});
	} catch (error) {
		console.error(`Failed to trigger multicall on chain ${chainID}`, error);
		return [{}, error as Error];
	}

	const _data: TDict<TToken> = {};
	const hasOwnerAddress = Boolean(ownerAddress) && !isZeroAddress(ownerAddress);
	const tokensAsObject: TDict<TUseBalancesTokens> = {};
	for (const token of tokens) {
		tokensAsObject[toAddress(token.address)] = token;
	}

	const callAndResult: {
		call: (typeof chunckCalls)[0];
		result: (typeof results)[0];
	}[] = [];
	for (let i = 0; i < chunckCalls.length; i++) {
		const call = chunckCalls[i];
		const result = results[i];
		callAndResult.push({call, result});
	}

	for (const {call, result} of callAndResult) {
		let element = tokensAsObject[toAddress(call.address)];
		if (!element) {
			if (call.functionName === 'getEthBalance') {
				element = tokensAsObject[toAddress(ETH_TOKEN_ADDRESS)];
			} else {
				continue;
			}
		}

		/******************************************************************************************
		 ** Retrieve the existing data and populate our return object with the existing data if they
		 ** exist, or just populate the object with the default ones
		 ******************************************************************************************/
		const {address, decimals: injectedDecimals, name: injectedName, symbol: injectedSymbol} = element;
		if (!_data[toAddress(address)]) {
			_data[toAddress(address)] = {
				address: address,
				name: injectedName || '',
				symbol: injectedSymbol || '',
				decimals: injectedDecimals || 0,
				chainID: chainID,
				balance: toNormalizedBN(0n, injectedDecimals || 0),
				value: 0
			};
		}
		const decimals = _data[toAddress(address)].decimals || injectedDecimals || 0;
		const symbol = _data[toAddress(address)].symbol || injectedSymbol || '';
		const name = _data[toAddress(address)].name || injectedName || '';

		/******************************************************************************************
		 ** Based on the type of call, we will populate the data object with the results of the call
		 ** and update the TOKEN_UPDATE object with the new data.
		 ******************************************************************************************/
		if (call.functionName === 'name') {
			if (name === undefined || name === '') {
				if (isEthAddress(address)) {
					_data[toAddress(address)].name = getNetwork(chainID).nativeCurrency.name;
				} else {
					_data[toAddress(address)].name = decodeAsString(result) || name;
				}
			}
		} else if (call.functionName === 'symbol') {
			if (symbol === undefined || symbol === '') {
				if (isEthAddress(address)) {
					_data[toAddress(address)].name = getNetwork(chainID).nativeCurrency.symbol;
				} else {
					_data[toAddress(address)].symbol = decodeAsString(result) || symbol;
				}
			}
		} else if (call.functionName === 'decimals') {
			if (decimals === undefined || decimals === 0) {
				if (isEthAddress(address)) {
					_data[toAddress(address)].decimals = getNetwork(chainID).nativeCurrency.decimals;
				} else {
					_data[toAddress(address)].decimals = decodeAsNumber(result) || decimals;
				}
			}
		} else if (call.functionName === 'balanceOf' && hasOwnerAddress) {
			const balanceOf = decodeAsBigInt(result);
			_data[toAddress(address)].balance = toNormalizedBN(balanceOf, decimals);
		} else if (call.functionName === 'getEthBalance' && hasOwnerAddress) {
			const balanceOf = decodeAsBigInt(result);
			_data[toAddress(address)].balance = toNormalizedBN(balanceOf, decimals);
		}

		if (_data[toAddress(address)].decimals === 0) {
			_data[toAddress(address)].decimals = 18;
		}
		/******************************************************************************************
		 ** Store the last update and the owner address for the token in the TOKEN_UPDATE object.
		 ** This will be used to skip fetching the same token for the same owner in the next 60s.
		 ******************************************************************************************/
		TOKEN_UPDATE[`${chainID}/${toAddress(address)}`] = {
			..._data[toAddress(address)],
			owner: toAddress(ownerAddress),
			lastUpdate: Date.now()
		};
	}

	return [_data, undefined];
}

export async function getBalances(
	chainID: number,
	address: TAddress | undefined,
	tokens: TUseBalancesTokens[],
	shouldForceFetch = false
): Promise<[TDict<TToken>, Error | undefined]> {
	let result: TDict<TToken> = {};
	const ownerAddress = address;
	const calls: any[] = [];

	for (const element of tokens) {
		const {address: token} = element;

		const tokenUpdateInfo = TOKEN_UPDATE[`${chainID}/${toAddress(element.address)}`];
		if (tokenUpdateInfo?.lastUpdate && Date.now() - tokenUpdateInfo?.lastUpdate < 60_000 && !shouldForceFetch) {
			if (toAddress(tokenUpdateInfo.owner) === toAddress(ownerAddress)) {
				result[toAddress(token)] = tokenUpdateInfo;
				continue;
			}
		}

		if (isEthAddress(token)) {
			const network = getNetwork(chainID);
			const multicall3Contract = {
				address: network.contracts.multicall3?.address || MULTICALL3_ADDRESS,
				abi: AGGREGATE3_ABI
			};
			const baseContract = {address: ETH_TOKEN_ADDRESS, abi: erc20Abi};
			if (element.decimals === undefined || element.decimals === 0) {
				calls.push({...baseContract, functionName: 'decimals'} as never);
			}
			if (element.symbol === undefined || element.symbol === '') {
				calls.push({...baseContract, functionName: 'symbol'} as never);
			}
			if (element.name === undefined || element.name === '') {
				calls.push({...baseContract, functionName: 'name'} as never);
			}
			if (ownerAddress) {
				calls.push({...multicall3Contract, functionName: 'getEthBalance', args: [ownerAddress]} as never);
			}
		} else {
			const baseContract = {address: token, abi: erc20Abi};
			if (element.decimals === undefined || element.decimals === 0) {
				calls.push({...baseContract, functionName: 'decimals'} as never);
			}
			if (element.symbol === undefined || element.symbol === '') {
				calls.push({...baseContract, functionName: 'symbol'} as never);
			}
			if (element.name === undefined || element.name === '') {
				calls.push({...baseContract, functionName: 'name'} as never);
			}
			if (ownerAddress) {
				calls.push({...baseContract, functionName: 'balanceOf', args: [ownerAddress]} as never);
			}
		}
	}

	try {
		const [callResult] = await performCall(chainID, calls, tokens, toAddress(ownerAddress));
		result = {...result, ...callResult};
		return [result, undefined];
	} catch (_error) {
		console.error(_error);
		return [result, _error as Error];
	}
}

/***************************************************************************
 ** This hook can be used to fetch balance information for any ERC20 tokens.
 **************************************************************************/
export function useBalances(props?: TUseBalancesReq): TUseBalancesRes {
	const {address: userAddress} = useWeb3();
	const [status, set_status] = useState<TDefaultStatus>(defaultStatus);
	const [someStatus, set_someStatus] = useState<TDefaultStatus>(defaultStatus);
	const [updateStatus, set_updateStatus] = useState<TDefaultStatus>(defaultStatus);
	const [error, set_error] = useState<Error | undefined>(undefined);
	const [balances, set_balances] = useState<TChainTokens>({});
	const [chainStatus, set_chainStatus] = useState<TChainStatus>(defaultChainStatus);

	const data = useRef<TDataRef>({nonce: 0, address: toAddress(), balances: {}});
	const stringifiedTokens = useMemo((): string => serialize(props?.tokens || []), [props?.tokens]);
	const currentlyConnectedAddress = useRef<TAddress | undefined>(undefined);
	const currentIdentifier = useRef<string | undefined>();

	useEffect(() => {
		if (toAddress(userAddress) !== toAddress(currentlyConnectedAddress.current)) {
			currentlyConnectedAddress.current = toAddress(userAddress);
			set_balances({});
			data.current = {
				address: toAddress(userAddress),
				balances: {},
				nonce: 0
			};
			const resetChainStatus: TChainStatus = defaultChainStatus;
			const config = retrieveConfig();
			for (const network of config.chains) {
				resetChainStatus.chainLoadingStatus[network.id] = true;
				resetChainStatus.chainSuccessStatus[network.id] = false;
				resetChainStatus.chainErrorStatus[network.id] = false;
			}
			set_status({...defaultStatus, isLoading: true});
			set_chainStatus(resetChainStatus);
		}
	}, [userAddress]);

	const updateBalancesCall = useCallback(
		(currentUserAddress: TAddress, chainID: number, newRawData: TDict<TToken>): TChainTokens => {
			if (currentlyConnectedAddress.current !== currentUserAddress) {
				return {};
			}

			if (toAddress(currentUserAddress) !== toAddress(data?.current?.address)) {
				data.current = {
					address: toAddress(currentUserAddress),
					balances: {},
					nonce: 0
				};
			}
			data.current.address = toAddress(currentUserAddress);

			for (const [address, element] of Object.entries(newRawData)) {
				if (!data.current.balances[chainID]) {
					data.current.balances[chainID] = {};
				}
				data.current.balances[chainID][address] = {
					...data.current.balances[chainID][address],
					...element
				};
			}
			data.current.nonce += 1;

			set_balances((b): TChainTokens => {
				return {
					...b,
					[chainID]: {
						...(b[chainID] || {}),
						...data.current.balances[chainID]
					}
				};
			});
			return data.current.balances;
		},
		[]
	);

	/***************************************************************************
	 ** onUpdate will take the stringified tokens and fetch the balances for each
	 ** token. It will then update the balances state with the new balances.
	 ** This takes the whole list and is not optimized for performance, aka not
	 ** send in a worker.
	 **************************************************************************/
	const onUpdate = useCallback(
		async (shouldForceFetch?: boolean): Promise<TChainTokens> => {
			const tokenList = (deserialize(stringifiedTokens) || []) as TUseBalancesTokens[];
			const tokens = tokenList.filter(({address}: TUseBalancesTokens): boolean => !isZeroAddress(address));
			if (isZero(tokens.length)) {
				return {};
			}
			set_updateStatus({...defaultStatus, isLoading: true});

			const tokensPerChainID: TNDict<TUseBalancesTokens[]> = {};
			const alreadyAdded: TNDict<TDict<boolean>> = {};
			for (const token of tokens) {
				if (!tokensPerChainID[token.chainID]) {
					tokensPerChainID[token.chainID] = [];
				}
				if (!alreadyAdded[token.chainID]) {
					alreadyAdded[token.chainID] = {};
				}
				if (alreadyAdded[token.chainID][toAddress(token.address)]) {
					continue;
				}
				tokensPerChainID[token.chainID].push(token);
				alreadyAdded[token.chainID][toAddress(token.address)] = true;
			}

			const updated: TChainTokens = {};
			const chainIDs = retrieveConfig().chains.map(({id}) => id);
			for (const [chainIDStr, tokens] of Object.entries(tokensPerChainID)) {
				const chainID = Number(chainIDStr);
				if (!chainIDs.includes(chainID)) {
					continue;
				}

				const chunks = [];
				for (let i = 0; i < tokens.length; i += 200) {
					chunks.push(tokens.slice(i, i + 200));
				}

				for (const chunkTokens of chunks) {
					const [newRawData, err] = await getBalances(
						chainID || 1,
						userAddress,
						chunkTokens,
						shouldForceFetch
					);
					if (err) {
						set_error(err as Error);
					}

					if (toAddress(userAddress) !== data?.current?.address) {
						data.current = {
							address: toAddress(userAddress),
							balances: {},
							nonce: 0
						};
					}
					data.current.address = toAddress(userAddress);
					for (const [address, element] of Object.entries(newRawData)) {
						if (!updated[chainID]) {
							updated[chainID] = {};
						}
						updated[chainID][address] = element;

						if (!data.current.balances[chainID]) {
							data.current.balances[chainID] = {};
						}
						data.current.balances[chainID][address] = {
							...data.current.balances[chainID][address],
							...element
						};
					}
					data.current.nonce += 1;
				}

				set_balances(
					(b): TChainTokens => ({
						...b,
						[chainID]: {
							...(b[chainID] || {}),
							...data.current.balances[chainID]
						}
					})
				);
				set_updateStatus({...defaultStatus, isSuccess: true});
			}

			return updated;
		},
		[stringifiedTokens, userAddress]
	);

	/***************************************************************************
	 ** onUpdateSome takes a list of tokens and fetches the balances for each
	 ** token. Even if it's not optimized for performance, it should not be an
	 ** issue as it should only be used for a little list of tokens.
	 **************************************************************************/
	const onUpdateSome = useCallback(
		async (tokenList: TUseBalancesTokens[], shouldForceFetch?: boolean): Promise<TChainTokens> => {
			set_someStatus({...defaultStatus, isLoading: true});
			const chains: number[] = [];
			const tokens = tokenList.filter(({address}: TUseBalancesTokens): boolean => !isZeroAddress(address));
			const tokensPerChainID: TNDict<TUseBalancesTokens[]> = {};
			const alreadyAdded: TNDict<TDict<boolean>> = {};

			for (const token of tokens) {
				if (!tokensPerChainID[token.chainID]) {
					tokensPerChainID[token.chainID] = [];
				}
				if (!alreadyAdded[token.chainID]) {
					alreadyAdded[token.chainID] = {};
				}
				if (alreadyAdded[token.chainID][toAddress(token.address)]) {
					continue;
				}

				tokensPerChainID[token.chainID].push(token);
				alreadyAdded[token.chainID][toAddress(token.address)] = true;
				if (!chains.includes(token.chainID)) {
					chains.push(token.chainID);
				}
			}

			const updated: TChainTokens = {};
			const chainIDs = retrieveConfig().chains.map(({id}) => id);
			for (const [chainIDStr, tokens] of Object.entries(tokensPerChainID)) {
				const chainID = Number(chainIDStr);
				if (!chainIDs.includes(chainID)) {
					continue;
				}

				const chunks = [];
				for (let i = 0; i < tokens.length; i += 200) {
					chunks.push(tokens.slice(i, i + 200));
				}
				for (const chunkTokens of chunks) {
					const [newRawData, err] = await getBalances(
						chainID || 1,
						toAddress(userAddress),
						chunkTokens,
						shouldForceFetch
					);
					if (err) {
						set_error(err as Error);
					}
					if (toAddress(userAddress) !== data?.current?.address) {
						data.current = {
							address: toAddress(userAddress),
							balances: {},
							nonce: 0
						};
					}
					data.current.address = toAddress(userAddress);

					for (const [address, element] of Object.entries(newRawData)) {
						if (!updated[chainID]) {
							updated[chainID] = {};
						}
						updated[chainID][address] = element;

						if (!data.current.balances[chainID]) {
							data.current.balances[chainID] = {};
						}
						data.current.balances[chainID][address] = {
							...data.current.balances[chainID][address],
							...element
						};
					}
					data.current.nonce += 1;
				}
			}

			set_balances(previous => {
				const updated = {...previous};
				for (const [chainID, chainData] of Object.entries(data.current.balances)) {
					updated[Number(chainID)] = {...updated[Number(chainID)], ...chainData};
				}
				return updated;
			});
			set_someStatus({...defaultStatus, isSuccess: true});
			return updated;
		},
		[userAddress]
	);

	/***************************************************************************
	 ** Everytime the stringifiedTokens change, we need to update the balances.
	 ** This is the main hook and is optimized for performance, using a worker
	 ** to fetch the balances, preventing the UI to freeze.
	 **************************************************************************/
	useAsyncTrigger(async (): Promise<void> => {
		set_status({...defaultStatus, isLoading: true});

		/******************************************************************************************
		 ** Everytime this function is re-triggered, we will create a unique identifier based on
		 ** the stringified tokens and the user address. This will allow us to prevent multiple
		 ** final setState that might jump the UI.
		 *****************************************************************************************/
		const identifier = createUniqueID(serialize({stringifiedTokens, userAddress}));
		currentIdentifier.current = identifier;

		const tokens = (JSON.parse(stringifiedTokens) || []) as TUseBalancesTokens[];
		const tokensPerChainID: TNDict<TUseBalancesTokens[]> = {};
		const alreadyAdded: TNDict<TDict<boolean>> = {};
		for (const token of tokens) {
			if (!tokensPerChainID[token.chainID]) {
				tokensPerChainID[token.chainID] = [];
			}
			if (!alreadyAdded[token.chainID]) {
				alreadyAdded[token.chainID] = {};
			}
			if (alreadyAdded[token.chainID][toAddress(token.address)]) {
				continue;
			}
			tokensPerChainID[token.chainID].push(token);
			alreadyAdded[token.chainID][toAddress(token.address)] = true;
		}

		if (props?.priorityChainID) {
			const chainID = props.priorityChainID;
			set_chainStatus(prev => ({
				chainLoadingStatus: {...(prev?.chainLoadingStatus || {}), [chainID]: true},
				chainSuccessStatus: {...(prev?.chainSuccessStatus || {}), [chainID]: false},
				chainErrorStatus: {...(prev?.chainErrorStatus || {}), [chainID]: false}
			}));

			const tokens = tokensPerChainID[chainID] || [];
			if (tokens.length > 0) {
				const chunks = [];
				for (let i = 0; i < tokens.length; i += 200) {
					chunks.push(tokens.slice(i, i + 200));
				}
				const allPromises = [];
				for (const chunkTokens of chunks) {
					allPromises.push(
						getBalances(chainID, userAddress, chunkTokens).then(
							async ([newRawData, err]): Promise<void> => {
								updateBalancesCall(toAddress(userAddress), chainID, newRawData);
								set_error(err);
							}
						)
					);
				}
				await Promise.all(allPromises);
				if (currentIdentifier.current === identifier) {
					set_chainStatus(prev => ({
						chainLoadingStatus: {...(prev?.chainLoadingStatus || {}), [chainID]: false},
						chainSuccessStatus: {...(prev?.chainSuccessStatus || {}), [chainID]: true},
						chainErrorStatus: {...(prev?.chainErrorStatus || {}), [chainID]: false}
					}));
				}
			}
		}

		const chainIDs = retrieveConfig().chains.map(({id}) => id);
		for (const [chainIDStr, tokens] of Object.entries(tokensPerChainID)) {
			const chainID = Number(chainIDStr);
			if (!chainIDs.includes(chainID)) {
				continue;
			}
			if (props?.priorityChainID && chainID === props.priorityChainID) {
				continue;
			}
			set_chainStatus(prev => ({
				chainLoadingStatus: {...(prev?.chainLoadingStatus || {}), [chainID]: true},
				chainSuccessStatus: {...(prev?.chainSuccessStatus || {}), [chainID]: false},
				chainErrorStatus: {...(prev?.chainErrorStatus || {}), [chainID]: false}
			}));

			const chunks = [];
			for (let i = 0; i < tokens.length; i += 200) {
				chunks.push(tokens.slice(i, i + 200));
			}
			const allPromises = [];
			for (const chunkTokens of chunks) {
				allPromises.push(
					getBalances(chainID, userAddress, chunkTokens).then(async ([newRawData, err]): Promise<void> => {
						updateBalancesCall(toAddress(userAddress), chainID, newRawData);
						set_error(err);
					})
				);
			}
			await Promise.all(allPromises);
			if (currentIdentifier.current === identifier) {
				set_chainStatus(prev => ({
					chainLoadingStatus: {...(prev?.chainLoadingStatus || {}), [chainID]: false},
					chainSuccessStatus: {...(prev?.chainSuccessStatus || {}), [chainID]: true},
					chainErrorStatus: {...(prev?.chainErrorStatus || {}), [chainID]: false}
				}));
			}
		}

		/******************************************************************************************
		 ** If the current identifier is the same as the one we created, we can set the status to
		 ** success and fetched. This will prevent the UI to jump if the user changes the tokens
		 ** or the address.
		 *****************************************************************************************/
		if (currentIdentifier.current === identifier) {
			set_status({...defaultStatus, isSuccess: true});
		}
	}, [stringifiedTokens, userAddress, updateBalancesCall, props?.priorityChainID]);

	const contextValue = useDeepCompareMemo(
		(): TUseBalancesRes => ({
			data: balances || {},
			onUpdate: onUpdate,
			onUpdateSome: onUpdateSome,
			error,
			isLoading: status.isLoading || someStatus.isLoading || updateStatus.isLoading,
			isSuccess: status.isSuccess && someStatus.isSuccess && updateStatus.isSuccess,
			isError: status.isError || someStatus.isError || updateStatus.isError,
			chainErrorStatus: chainStatus.chainErrorStatus,
			chainLoadingStatus: chainStatus.chainLoadingStatus,
			chainSuccessStatus: chainStatus.chainSuccessStatus,
			status:
				status.isError || someStatus.isError || updateStatus.isError
					? 'error'
					: status.isLoading || someStatus.isLoading || updateStatus.isLoading
						? 'loading'
						: status.isSuccess && someStatus.isSuccess && updateStatus.isSuccess
							? 'success'
							: 'unknown'
		}),
		[
			balances,
			error,
			onUpdate,
			onUpdateSome,
			someStatus.isError,
			someStatus.isLoading,
			someStatus.isSuccess,
			status.isError,
			status.isLoading,
			status.isSuccess,
			updateStatus.isError,
			updateStatus.isLoading,
			updateStatus.isSuccess,
			chainStatus.chainErrorStatus,
			chainStatus.chainLoadingStatus,
			chainStatus.chainSuccessStatus
		]
	);

	return contextValue;
}
