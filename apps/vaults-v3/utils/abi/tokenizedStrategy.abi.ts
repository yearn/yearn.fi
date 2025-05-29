export const TOKENIZED_STRATEGY_ABI = [
	{
		inputs: [
			{internalType: 'address', name: '_vault', type: 'address'},
			{internalType: 'string', name: '_name', type: 'string'}
		],
		stateMutability: 'nonpayable',
		type: 'constructor'
	},
	{stateMutability: 'nonpayable', type: 'fallback'},
	{
		inputs: [],
		name: 'ACCOUNTANT',
		outputs: [{internalType: 'contract IAccountant', name: '', type: 'address'}],
		stateMutability: 'view',
		type: 'function'
	},
	{
		inputs: [{internalType: 'address', name: '', type: 'address'}],
		name: 'availableDepositLimit',
		outputs: [{internalType: 'uint256', name: '', type: 'uint256'}],
		stateMutability: 'view',
		type: 'function'
	},
	{
		inputs: [{internalType: 'address', name: '', type: 'address'}],
		name: 'availableWithdrawLimit',
		outputs: [{internalType: 'uint256', name: '', type: 'uint256'}],
		stateMutability: 'view',
		type: 'function'
	},
	{
		inputs: [{internalType: 'uint256', name: '_amount', type: 'uint256'}],
		name: 'deployFunds',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function'
	},
	{
		inputs: [],
		name: 'doHealthCheck',
		outputs: [{internalType: 'bool', name: '', type: 'bool'}],
		stateMutability: 'view',
		type: 'function'
	},
	{
		inputs: [{internalType: 'uint256', name: '_amount', type: 'uint256'}],
		name: 'freeFunds',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function'
	},
	{
		inputs: [],
		name: 'harvestAndReport',
		outputs: [{internalType: 'uint256', name: '_totalAssets', type: 'uint256'}],
		stateMutability: 'nonpayable',
		type: 'function'
	},
	{
		inputs: [],
		name: 'lossLimitRatio',
		outputs: [{internalType: 'uint256', name: '', type: 'uint256'}],
		stateMutability: 'view',
		type: 'function'
	},
	{
		inputs: [],
		name: 'profitLimitRatio',
		outputs: [{internalType: 'uint256', name: '', type: 'uint256'}],
		stateMutability: 'view',
		type: 'function'
	},
	{
		inputs: [{internalType: 'bool', name: '_doHealthCheck', type: 'bool'}],
		name: 'setDoHealthCheck',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function'
	},
	{
		inputs: [{internalType: 'uint256', name: '_newLossLimitRatio', type: 'uint256'}],
		name: 'setLossLimitRatio',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function'
	},
	{
		inputs: [{internalType: 'uint256', name: '_newProfitLimitRatio', type: 'uint256'}],
		name: 'setProfitLimitRatio',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function'
	},
	{
		inputs: [{internalType: 'uint256', name: '_amount', type: 'uint256'}],
		name: 'shutdownWithdraw',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function'
	},
	{
		inputs: [{internalType: 'uint256', name: '_totalIdle', type: 'uint256'}],
		name: 'tendThis',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function'
	},
	{
		inputs: [],
		name: 'tendTrigger',
		outputs: [
			{internalType: 'bool', name: '', type: 'bool'},
			{internalType: 'bytes', name: '', type: 'bytes'}
		],
		stateMutability: 'view',
		type: 'function'
	},
	{
		inputs: [],
		name: 'tokenizedStrategyAddress',
		outputs: [{internalType: 'address', name: '', type: 'address'}],
		stateMutability: 'view',
		type: 'function'
	}
] as const;
