import type {BigNumber} from 'ethers';
import type {ReactElement} from 'react';
import type {TBalanceData} from '@yearn-finance/web-lib/hooks/types';
import type {TAddress} from '@yearn-finance/web-lib/utils/address';
import type {TDict} from '@yearn-finance/web-lib/utils/types';
import type {EXTERNAL_SERVICE_PROVIDER} from '@vaults/utils/migrationTable';

export type	TClaimable = {
	raw: BigNumber,
	normalized: number,
}

export type	TSimplifiedBalanceData = {
	decimals: number,
	symbol: string,
	raw: BigNumber,
	normalized: number,
	normalizedPrice: number,
}

export type TDropdownOption = {
	label: string;
	symbol: string;
	decimals: number;
	value: string;
	icon?: ReactElement;
	zapVia?: TAddress;
	balanceSource?: string;
	settings?: {
		serviceID?: EXTERNAL_SERVICE_PROVIDER
		shouldNotBeWithdrawTarget?: boolean;
		shouldHideIfZero?: boolean
	}
};

export type TDropdownProps = {
	options: TDropdownOption[];
	defaultOption: TDropdownOption;
	selected?: TDropdownOption;
	placeholder?: string;
	onSelect:
	| React.Dispatch<React.SetStateAction<TDropdownOption>>
	| ((option: TDropdownOption) => void);
	balanceSource?: TDict<TBalanceData>;
};

export type TDropdownItemProps = {
	option: TDropdownOption;
	balanceSource?: TDict<TBalanceData>;
};

export type TDropdownGaugeOption = {
	label: string;
	icon?: ReactElement;
	value: {
		name: string,
		tokenAddress: TAddress,
		poolAddress: TAddress,
		gaugeAddress: TAddress,
		APY: number
	};
};
export type TDropdownGaugeProps = {
	options: TDropdownGaugeOption[];
	selected?: TDropdownGaugeOption;
	placeholder?: string;
	onSelect:
	| React.Dispatch<React.SetStateAction<TDropdownGaugeOption>>
	| ((option: TDropdownGaugeOption) => void);
};

export type TDropdownGaugeItemProps = {
	option: TDropdownGaugeOption;
};

export type	TNormalizedBN = {
	raw: BigNumber,
	normalized: number | string,
}

export type TGraphData = {
	name: string;
	value: number;
}

export type TMessariGraphData = {
	name: string;
	tvl: number;
	pps: number;
}
