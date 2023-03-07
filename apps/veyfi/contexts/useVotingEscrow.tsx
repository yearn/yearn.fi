import React, {createContext, memo, useCallback, useContext, useMemo} from 'react';
import {Contract} from 'ethcall';
import {FixedNumber} from 'ethers';
import useSWR from 'swr';
import VEYFI_ABI from '@veYFI/utils/abi/veYFI.abi';
import VEYFI_POSITION_HELPER_ABI from '@veYFI/utils/abi/veYFIPositionHelper.abi';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import ERC20_ABI from '@yearn-finance/web-lib/utils/abi/erc20.abi';
import {allowanceKey} from '@yearn-finance/web-lib/utils/address';
import {VEYFI_ADDRESS, VEYFI_POSITION_HELPER_ADDRESS, YFI_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {toBigInt, toNumber} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {toMilliseconds} from '@yearn-finance/web-lib/utils/time';
import {getProvider, newEthCallProvider} from '@yearn-finance/web-lib/utils/web3/providers';

import type {ReactElement} from 'react';
import type {TAddress, TDict} from '@yearn-finance/web-lib/types';
import type {TMilliseconds} from '@yearn-finance/web-lib/utils/time';

export type TVotingEscrow = {
	address: TAddress,
	token: TAddress,
	name: string,
	symbol: string,
	decimals: number,
	supply: bigint,
	rewardPool: TAddress,
}

export type TPosition = {
	balance: bigint,
	underlyingBalance: bigint,
}

export type TVotingEscrowPosition = {
	deposit?: TPosition,
	// yield?: TPosition,
	unlockTime?: TMilliseconds,
	penalty?: bigint,
	penaltyRatio?: number,
	withdrawable?: bigint,
}

export type	TVotingEscrowContext = {
	votingEscrow: TVotingEscrow | undefined,
	positions: TVotingEscrowPosition | undefined,
	allowances: TDict<bigint>,
	isLoading: boolean,
	refresh: VoidFunction,
}
const defaultProps: TVotingEscrowContext = {
	votingEscrow: undefined,
	positions: undefined,
	allowances: {},
	isLoading: true,
	refresh: (): void => undefined
};

const	VotingEscrowContext = createContext<TVotingEscrowContext>(defaultProps);
export const VotingEscrowContextApp = memo(function VotingEscrowContextApp({children}: {children: ReactElement}): ReactElement {
	const {provider, address, isActive} = useWeb3();

	const assetFetcher = useCallback(async (): Promise<TVotingEscrow> => {
		const currentProvider = provider || getProvider(1);
		const ethcallProvider = await newEthCallProvider(currentProvider);
		const veYFIContract = new Contract(VEYFI_ADDRESS, VEYFI_ABI);
		const [token, name, symbol, decimals, supply, rewardPool] = await ethcallProvider.tryAll([
			veYFIContract.token(),
			veYFIContract.name(),
			veYFIContract.symbol(),
			veYFIContract.decimals(),
			veYFIContract.supply(),
			veYFIContract.reward_pool()
		]) as [TAddress, string, string, number, bigint, TAddress];

		return ({
			address: VEYFI_ADDRESS,
			token,
			name,
			symbol,
			decimals,
			supply: toBigInt(supply),
			rewardPool
		});
	}, [provider]);
	const {data: votingEscrow, mutate: refreshVotingEscrow, isLoading: isLoadingVotingEscrow} = useSWR('asset', assetFetcher, {shouldRetryOnError: false});

	const positionsFetcher = useCallback(async (): Promise<TVotingEscrowPosition> => {
		if (!isActive || !address) {
			return {};
		}
		const currentProvider = provider || getProvider(1);
		const ethcallProvider = await newEthCallProvider(currentProvider);
		const veYFIPositionHelperContract = new Contract(VEYFI_POSITION_HELPER_ADDRESS, VEYFI_POSITION_HELPER_ABI);

		const [positionDetails] = await ethcallProvider.tryAll([veYFIPositionHelperContract.getPositionDetails(address)]) as [{
			balance: bigint,
			depositAmount: bigint,
			unlockTime: bigint,
			penalty: bigint,
			withdrawable: bigint
		}];

		const depositPosition: TPosition = {
			balance: toBigInt(positionDetails.balance),
			underlyingBalance: toBigInt(positionDetails.depositAmount)
		};

		return {
			deposit: depositPosition,
			unlockTime: toMilliseconds(toNumber(positionDetails.unlockTime)),
			penalty: toBigInt(positionDetails.penalty),
			penaltyRatio: positionDetails.depositAmount > 0 ? FixedNumber.fromValue(positionDetails.penalty).divUnsafe(FixedNumber.fromValue(positionDetails.depositAmount)).toUnsafeFloat() : 0,
			withdrawable: toBigInt(positionDetails.withdrawable)
		};
	}, [isActive, address, provider]);
	const {data: positions, mutate: refreshPositions, isLoading: isLoadingPositions} = useSWR(isActive && provider ? 'positions' : null, positionsFetcher, {shouldRetryOnError: false});

	const allowancesFetcher = useCallback(async (): Promise<TDict<bigint>> => {
		if (!isActive || !address) {
			return {};
		}
		const	currentProvider = provider || getProvider(1);
		const	ethcallProvider = await newEthCallProvider(currentProvider);
		const	yfiContract = new Contract(YFI_ADDRESS, ERC20_ABI);

		const	[yfiAllowanceVeYFI] = await ethcallProvider.tryAll([yfiContract.allowance(address, VEYFI_ADDRESS)]) as bigint[];

		return ({[allowanceKey(YFI_ADDRESS, VEYFI_ADDRESS)]: toBigInt(yfiAllowanceVeYFI)});
	}, [isActive, address, provider]);
	const	{data: allowances, mutate: refreshAllowances, isLoading: isLoadingAllowances} = useSWR(isActive && provider ? 'allowances' : null, allowancesFetcher, {shouldRetryOnError: false});

	const refresh = useCallback((): void => {
		refreshVotingEscrow();
		refreshPositions();
		refreshAllowances();
	}, [refreshVotingEscrow, refreshPositions, refreshAllowances]);

	const contextValue = useMemo((): TVotingEscrowContext => ({
		votingEscrow,
		positions,
		allowances: allowances ?? {},
		isLoading: isLoadingVotingEscrow && isLoadingPositions && isLoadingAllowances,
		refresh
	}), [votingEscrow, positions, allowances, isLoadingVotingEscrow, isLoadingPositions, isLoadingAllowances, refresh]);

	return (
		<VotingEscrowContext.Provider value={contextValue}>
			{children}
		</VotingEscrowContext.Provider>
	);
});

export const useVotingEscrow = (): TVotingEscrowContext => useContext(VotingEscrowContext);
export default useVotingEscrow;
