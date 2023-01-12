import {useCallback} from 'react';
import {Contract} from 'ethcall';
import useSWR from 'swr';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {getProvider, newEthCallProvider} from '@yearn-finance/web-lib/utils/web3/providers';
import VLYCRV_ABI from '@yCRV/utils/abi/vlYCrv.abi';

export function useVLyCRV(): {currentPeriod?: number} {
	const {provider, isActive} = useWeb3();
	const VL_YCRV_CONTRACT = toAddress('0xCCBD4579495cD78280e4900CB482C8Edf2EC8336');
    
	const fetcher = useCallback(async (): Promise<number> => {
		if (!isActive || !provider) {
			return 0;
		}
		
		const currentProvider = provider || getProvider(1);
		const ethcallProvider = await newEthCallProvider(currentProvider);
		const vLyCRVContract = new Contract(VL_YCRV_CONTRACT, VLYCRV_ABI);

		const [currentPeriod] = await ethcallProvider.tryAll([vLyCRVContract.currentPeriod()]) as [number];

		return currentPeriod;
	}, [VL_YCRV_CONTRACT, isActive, provider]);

	const {data} = useSWR<number>(isActive && provider ? 'vLyCRV' : null, fetcher);

	return {currentPeriod: data};
}
