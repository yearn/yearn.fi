import type {BigNumber} from 'ethers';
import type {TDict} from '@yearn-finance/web-lib/utils/types';

export type TCurveGauges = {
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
	v2: TDict<TDict<BigNumber>>,
	v3: TDict<TDict<BigNumber>>,
}