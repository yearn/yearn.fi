import type {ReactElement} from 'react';
import type {TAddress, TDict, TNDict, TToken as TToken} from '@builtbymom/web3/types';
import type {TSolver, TSupportedZaps} from '@common/schemas/yDaemonTokenListBalances';

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

export type TYToken = TToken & {
	supportedZaps: TSupportedZaps[];
	stakingValue: number;
};
export type TYChainTokens = TNDict<TDict<TYToken>>;

export type TGraphData = {
	name: string;
	value: number;
};

export type TMessariGraphData = {
	name: string;
	tvl: number;
	pps: number;
};
