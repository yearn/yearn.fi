import type {BigNumber} from 'ethers';
import type {TDict} from '@yearn-finance/web-lib/types';

export type TCurveGaugesFromYearn = {
	gauge_name: string,
	gauge_address: string,
	pool_address: string,
	lp_token: string,
	weight: string,
	inflation_rate: string,
	working_supply: string,
	apy: {
		type: string,
		gross_apr: number,
		net_apy: number,
	},
	updated: number,
	block: number,
}

export type TCurveGaugeVersionRewards = {
	v3: TDict<TDict<BigNumber>>,
}
