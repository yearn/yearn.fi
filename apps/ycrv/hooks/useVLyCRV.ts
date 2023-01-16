import {useCallback} from 'react';
import {Contract} from 'ethcall';
import {BigNumber} from 'ethers';
import useSWR from 'swr';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {getProvider, newEthCallProvider} from '@yearn-finance/web-lib/utils/web3/providers';
import VLYCRV_ABI from '@yCRV/utils/abi/vlYCrv.abi';

type TUserInfo = {
	balance: BigNumber;
	votesSpent: BigNumber;
	lastVoteTime: number;
}

type TUseVLyCRV = {
	nextPeriod: number
	userInfo: TUserInfo;
};

const DEFAULT_VLYCRV = {
	nextPeriod: 0,
	userInfo: {
		balance: BigNumber.from(0),
		votesSpent: BigNumber.from(0),
		lastVoteTime: 0
	}
};

export function useVLyCRV(): TUseVLyCRV {
	const {provider, isActive, address} = useWeb3();
	const VL_YCRV_CONTRACT = toAddress('0xCCBD4579495cD78280e4900CB482C8Edf2EC8336');
    
	const fetcher = useCallback(async (): Promise<TUseVLyCRV> => {
		if (!isActive || !provider) {
			return DEFAULT_VLYCRV;
		}

		const currentProvider = provider || getProvider(1);
		const ethcallProvider = await newEthCallProvider(currentProvider);
		const vLyCRVContract = new Contract(VL_YCRV_CONTRACT, VLYCRV_ABI);

		const [
			nextPeriod,
			userInfo
		] = await ethcallProvider.tryAll([
			vLyCRVContract.nextPeriod(),
			vLyCRVContract.userInfo(address)
		]) as [number, TUserInfo];

		return {nextPeriod, userInfo};
	}, [VL_YCRV_CONTRACT, address, isActive, provider]);

	const {data} = useSWR<TUseVLyCRV>(isActive && provider ? 'vLyCRV' : null, fetcher);

	return data ?? DEFAULT_VLYCRV;
}
