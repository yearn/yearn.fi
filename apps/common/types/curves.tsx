import type {BigNumber} from 'ethers';
import type {TDict} from '@yearn-finance/web-lib/types';

export type TCurveGaugeVersionRewards = {
	v3: TDict<TDict<BigNumber>>,
}
