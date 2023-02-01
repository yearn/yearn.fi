import {useCallback} from 'react';
import {Contract} from 'ethcall';
import useSWR from 'swr';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {VLYCRV_TOKEN_ADDRESS, YCRV_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {Zero} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {getProvider, newEthCallProvider} from '@yearn-finance/web-lib/utils/web3/providers';
import {approveERC20} from '@common/utils/actions/approveToken';
import VLYCRV_ABI from '@yCRV/utils/abi/vlYCrv.abi';
import {vLyCRVDeposit, vLyCRVVote, vLyCRVWithdraw} from '@yCRV/utils/actions';

import type {BigNumber, providers} from 'ethers';
import type {KeyedMutator} from 'swr';
import type {TAddress} from '@yearn-finance/web-lib/utils/address';

export type TUserInfo = {
	balance: BigNumber;
	votesSpent: BigNumber;
	lastVoteTime: number;
}

type TGetVotesUnpacked = {
	gaugesList: string[];
	voteAmounts: BigNumber[];
}

type TUseVLyCRV = {
	initialData: {
		nextPeriod: number;
		userInfo: TUserInfo;
		getVotesUnpacked: TGetVotesUnpacked;
	};
	mutateData: KeyedMutator<{
		nextPeriod: number;
		userInfo: TUserInfo;
		getVotesUnpacked: TGetVotesUnpacked;
	}>;
	vote: (provider: providers.JsonRpcProvider, gaugeAddress: TAddress, votes: BigNumber) => Promise<boolean>;
	deposit: (provider: providers.JsonRpcProvider, amount: BigNumber) => Promise<boolean>;
	withdraw: (provider: providers.JsonRpcProvider, amount: BigNumber) => Promise<boolean>;
	approve: (provider: providers.JsonRpcProvider, amount: BigNumber) => Promise<boolean>;
};

const DEFAULT_VLYCRV = {
	nextPeriod: 0,
	userInfo: {
		balance: Zero,
		votesSpent: Zero,
		lastVoteTime: 0
	},
	getVotesUnpacked: {
		gaugesList: [],
		voteAmounts: []
	}
};

export function useVLyCRV(): TUseVLyCRV {
	const {provider, isActive, address} = useWeb3();

	const fetcher = useCallback(async (): Promise<TUseVLyCRV['initialData']> => {
		if (!isActive || !provider) {
			return DEFAULT_VLYCRV;
		}

		const currentProvider = provider || getProvider(1);
		const ethcallProvider = await newEthCallProvider(currentProvider);
		const vLyCRVContract = new Contract(VLYCRV_TOKEN_ADDRESS, VLYCRV_ABI);

		const [
			nextPeriod,
			userInfo,
			getVotesUnpacked
		] = await ethcallProvider.tryAll([
			vLyCRVContract.nextPeriod(),
			vLyCRVContract.userInfo(address),
			vLyCRVContract.getVotesUnpacked()
		]) as [number, TUserInfo, TGetVotesUnpacked];

		return {nextPeriod, userInfo, getVotesUnpacked};
	}, [address, isActive, provider]);

	const {data, mutate} = useSWR<TUseVLyCRV['initialData']>(isActive && provider ? 'vLyCRV' : null, fetcher);

	return {
		initialData: data ?? DEFAULT_VLYCRV,
		mutateData: mutate,
		deposit: vLyCRVDeposit,
		withdraw: vLyCRVWithdraw,
		vote: vLyCRVVote,
		approve: async (provider: providers.JsonRpcProvider, amount: BigNumber): Promise<boolean> => (
			approveERC20(
				provider,
				YCRV_TOKEN_ADDRESS,
				VLYCRV_TOKEN_ADDRESS,
				amount
			)
		)
	};
}
