import type {BigNumber, ethers} from 'ethers';
import type {TAddress} from '@yearn-finance/web-lib/utils/address';

export type TTransactionProps = {
	provider: ethers.providers.Web3Provider;
	amount: BigNumber;
}

export type TVoteTxProps = {
	provider: ethers.providers.Web3Provider;
	votes?: BigNumber;
	gaugeAddress: TAddress;
}
