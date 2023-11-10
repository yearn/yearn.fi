import type {ReactElement} from 'react';
import type {TAddress, TDict, TNDict} from '@yearn-finance/web-lib/types';
import type {TSolver} from '@common/schemas/yDaemonTokenListBalances';
import type {multicall} from '@wagmi/core';

export type TDropdownOption = {
	label: string;
	symbol: string;
	decimals: number;
	chainID: number;
	value: TAddress;
	icon?: ReactElement;
	zapVia?: TAddress;
	solveVia?: TSolver[];
	settings?: {
		shouldNotBeWithdrawTarget?: boolean;
		shouldHideIfZero?: boolean;
	};
};

export type TDropdownProps = {
	options: TDropdownOption[];
	defaultOption: TDropdownOption;
	selected?: TDropdownOption;
	placeholder?: string;
	className?: string;
	comboboxOptionsClassName?: string;
	onSelect: React.Dispatch<React.SetStateAction<TDropdownOption>> | ((option: TDropdownOption) => void);
};

export type TDropdownItemProps = {
	option: TDropdownOption;
};

export type TDropdownGaugeOption = {
	label: string;
	icon?: ReactElement;
	value: {
		name: string;
		tokenAddress: TAddress;
		poolAddress: TAddress;
		gaugeAddress: TAddress;
		APY: number;
	};
};
export type TDropdownGaugeProps = {
	options: TDropdownGaugeOption[];
	selected?: TDropdownGaugeOption;
	placeholder?: string;
	onSelect: React.Dispatch<React.SetStateAction<TDropdownGaugeOption>> | ((option: TDropdownGaugeOption) => void);
};

export type TDropdownGaugeItemProps = {
	option: TDropdownGaugeOption;
};

export type TNormalizedBN = {
	raw: bigint;
	normalized: number | string;
};

export type TToken = {
	address: TAddress;
	name: string;
	symbol: string;
	decimals: number;
	chainID: number;
	logoURI?: string;
	value: number;
	stakingValue: number;
	price: TNormalizedBN;
	balance: TNormalizedBN;
};
export type TChainTokens = TNDict<TDict<TToken>>;

export type TGraphData = {
	name: string;
	value: number;
};

export type TMessariGraphData = {
	name: string;
	tvl: number;
	pps: number;
};

export type TSortDirection = 'asc' | 'desc' | '';

export type TMulticallContract = Parameters<typeof multicall>[0]['contracts'][0];
