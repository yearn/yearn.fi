import type {BigNumber} from 'ethers';

import type {TDict} from '@yearn-finance/web-lib/utils';

export type TCurveGaugesWrapper = {
	[key: string]: TCurveGauges | undefined
}

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

export type TKeyStringBN = {
	[key: string]: BigNumber
}
export type TCurveGaugeRewards = {
	[key: string]: TKeyStringBN
}
export type TCurveGaugeVersionRewards = {
	v2: TCurveGaugeRewards,
	v3: TCurveGaugeRewards,
}