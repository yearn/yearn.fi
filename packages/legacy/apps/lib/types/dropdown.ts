import type {TAddress} from '@lib/types';
import type {ReactElement} from 'react';
import type {TSolver} from '../utils/schemas/yDaemonTokenListBalances';

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
