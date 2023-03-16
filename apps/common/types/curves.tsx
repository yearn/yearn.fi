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

export type TCurveGauges = {
	gauge_name: string
	swap: string
	swap_token: string
	name: string
	gauge: string
	type: string
	side_chain: boolean
	is_killed: boolean
	factory: boolean
	gauge_controller: {
		get_gauge_weight: string
		gauge_relative_weight: string
		inflation_rate: string
	}
	gauge_data: {
		working_supply: string
		inflation_rate: string
	}
	swap_data: {
		virtual_price: string
	},
	rewardPerGauge?: string[]
	rewardPerTokenPerGauge?: TDict<BigNumber>
}

export type TCurveGaugeVersionRewards = {
	v3: TDict<TDict<BigNumber>>,
}
