export const erc4626RouterAbi = [
	{
		inputs: [
			{internalType: 'string', name: '_name_', type: 'string'},
			{internalType: 'contract IWETH9', name: 'weth', type: 'address'}
		],
		stateMutability: 'nonpayable',
		type: 'constructor'
	},
	{
		inputs: [],
		name: 'WETH9',
		outputs: [{internalType: 'contract IWETH9', name: '', type: 'address'}],
		stateMutability: 'view',
		type: 'function'
	},
	{
		inputs: [
			{internalType: 'contract ERC20', name: 'token', type: 'address'},
			{internalType: 'address', name: 'to', type: 'address'},
			{internalType: 'uint256', name: 'amount', type: 'uint256'}
		],
		name: 'approve',
		outputs: [],
		stateMutability: 'payable',
		type: 'function'
	},
	{
		inputs: [
			{internalType: 'contract IYearn4626', name: 'vault', type: 'address'},
			{internalType: 'uint256', name: 'amount', type: 'uint256'},
			{internalType: 'address', name: 'to', type: 'address'},
			{internalType: 'uint256', name: 'minSharesOut', type: 'uint256'}
		],
		name: 'deposit',
		outputs: [{internalType: 'uint256', name: 'sharesOut', type: 'uint256'}],
		stateMutability: 'payable',
		type: 'function'
	},
	{
		inputs: [
			{internalType: 'contract IYearn4626', name: 'vault', type: 'address'},
			{internalType: 'uint256', name: 'amount', type: 'uint256'},
			{internalType: 'address', name: 'to', type: 'address'},
			{internalType: 'uint256', name: 'minSharesOut', type: 'uint256'}
		],
		name: 'depositToVault',
		outputs: [{internalType: 'uint256', name: '', type: 'uint256'}],
		stateMutability: 'payable',
		type: 'function'
	},
	{
		inputs: [
			{internalType: 'contract IYearn4626', name: 'vault', type: 'address'},
			{internalType: 'uint256', name: 'minSharesOut', type: 'uint256'}
		],
		name: 'depositToVault',
		outputs: [{internalType: 'uint256', name: '', type: 'uint256'}],
		stateMutability: 'payable',
		type: 'function'
	},
	{
		inputs: [
			{internalType: 'contract IYearn4626', name: 'vault', type: 'address'},
			{internalType: 'uint256', name: 'amount', type: 'uint256'},
			{internalType: 'uint256', name: 'minSharesOut', type: 'uint256'}
		],
		name: 'depositToVault',
		outputs: [{internalType: 'uint256', name: '', type: 'uint256'}],
		stateMutability: 'payable',
		type: 'function'
	},
	{
		inputs: [{internalType: 'contract IYearn4626', name: 'vault', type: 'address'}],
		name: 'depositToVault',
		outputs: [{internalType: 'uint256', name: '', type: 'uint256'}],
		stateMutability: 'payable',
		type: 'function'
	},
	{
		inputs: [
			{internalType: 'contract IYearn4626', name: 'fromVault', type: 'address'},
			{internalType: 'contract IYearn4626', name: 'toVault', type: 'address'}
		],
		name: 'migrate',
		outputs: [{internalType: 'uint256', name: '', type: 'uint256'}],
		stateMutability: 'payable',
		type: 'function'
	},
	{
		inputs: [
			{internalType: 'contract IYearn4626', name: 'fromVault', type: 'address'},
			{internalType: 'contract IYearn4626', name: 'toVault', type: 'address'},
			{internalType: 'uint256', name: 'shares', type: 'uint256'},
			{internalType: 'address', name: 'to', type: 'address'},
			{internalType: 'uint256', name: 'minSharesOut', type: 'uint256'}
		],
		name: 'migrate',
		outputs: [{internalType: 'uint256', name: '', type: 'uint256'}],
		stateMutability: 'payable',
		type: 'function'
	},
	{
		inputs: [
			{internalType: 'contract IYearn4626', name: 'fromVault', type: 'address'},
			{internalType: 'contract IYearn4626', name: 'toVault', type: 'address'},
			{internalType: 'uint256', name: 'shares', type: 'uint256'},
			{internalType: 'uint256', name: 'minSharesOut', type: 'uint256'}
		],
		name: 'migrate',
		outputs: [{internalType: 'uint256', name: '', type: 'uint256'}],
		stateMutability: 'payable',
		type: 'function'
	},
	{
		inputs: [
			{internalType: 'contract IYearn4626', name: 'fromVault', type: 'address'},
			{internalType: 'contract IYearn4626', name: 'toVault', type: 'address'},
			{internalType: 'uint256', name: 'minSharesOut', type: 'uint256'}
		],
		name: 'migrate',
		outputs: [{internalType: 'uint256', name: '', type: 'uint256'}],
		stateMutability: 'payable',
		type: 'function'
	},
	{
		inputs: [
			{internalType: 'contract IYearnV2', name: 'fromVault', type: 'address'},
			{internalType: 'contract IYearn4626', name: 'toVault', type: 'address'},
			{internalType: 'uint256', name: 'shares', type: 'uint256'},
			{internalType: 'address', name: 'to', type: 'address'},
			{internalType: 'uint256', name: 'minSharesOut', type: 'uint256'}
		],
		name: 'migrateFromV2',
		outputs: [{internalType: 'uint256', name: '', type: 'uint256'}],
		stateMutability: 'payable',
		type: 'function'
	},
	{
		inputs: [
			{internalType: 'contract IYearnV2', name: 'fromVault', type: 'address'},
			{internalType: 'contract IYearn4626', name: 'toVault', type: 'address'},
			{internalType: 'uint256', name: 'shares', type: 'uint256'},
			{internalType: 'uint256', name: 'minSharesOut', type: 'uint256'}
		],
		name: 'migrateFromV2',
		outputs: [{internalType: 'uint256', name: '', type: 'uint256'}],
		stateMutability: 'payable',
		type: 'function'
	},
	{
		inputs: [
			{internalType: 'contract IYearnV2', name: 'fromVault', type: 'address'},
			{internalType: 'contract IYearn4626', name: 'toVault', type: 'address'},
			{internalType: 'uint256', name: 'minSharesOut', type: 'uint256'}
		],
		name: 'migrateFromV2',
		outputs: [{internalType: 'uint256', name: '', type: 'uint256'}],
		stateMutability: 'payable',
		type: 'function'
	},
	{
		inputs: [
			{internalType: 'contract IYearnV2', name: 'fromVault', type: 'address'},
			{internalType: 'contract IYearn4626', name: 'toVault', type: 'address'}
		],
		name: 'migrateFromV2',
		outputs: [{internalType: 'uint256', name: 'sharesOut', type: 'uint256'}],
		stateMutability: 'payable',
		type: 'function'
	},
	{
		inputs: [
			{internalType: 'contract IYearn4626', name: 'vault', type: 'address'},
			{internalType: 'uint256', name: 'shares', type: 'uint256'},
			{internalType: 'address', name: 'to', type: 'address'},
			{internalType: 'uint256', name: 'maxAmountIn', type: 'uint256'}
		],
		name: 'mint',
		outputs: [{internalType: 'uint256', name: 'amountIn', type: 'uint256'}],
		stateMutability: 'payable',
		type: 'function'
	},
	{
		inputs: [{internalType: 'bytes[]', name: 'data', type: 'bytes[]'}],
		name: 'multicall',
		outputs: [{internalType: 'bytes[]', name: 'results', type: 'bytes[]'}],
		stateMutability: 'payable',
		type: 'function'
	},
	{
		inputs: [],
		name: 'name',
		outputs: [{internalType: 'string', name: '', type: 'string'}],
		stateMutability: 'view',
		type: 'function'
	},
	{
		inputs: [
			{internalType: 'contract ERC20', name: 'token', type: 'address'},
			{internalType: 'uint256', name: 'amount', type: 'uint256'},
			{internalType: 'address', name: 'recipient', type: 'address'}
		],
		name: 'pullToken',
		outputs: [],
		stateMutability: 'payable',
		type: 'function'
	},
	{
		inputs: [
			{internalType: 'contract IYearn4626', name: 'vault', type: 'address'},
			{internalType: 'uint256', name: 'maxLoss', type: 'uint256'}
		],
		name: 'redeem',
		outputs: [{internalType: 'uint256', name: '', type: 'uint256'}],
		stateMutability: 'payable',
		type: 'function'
	},
	{
		inputs: [
			{internalType: 'contract IYearn4626', name: 'vault', type: 'address'},
			{internalType: 'uint256', name: 'shares', type: 'uint256'},
			{internalType: 'uint256', name: 'maxLoss', type: 'uint256'}
		],
		name: 'redeem',
		outputs: [{internalType: 'uint256', name: '', type: 'uint256'}],
		stateMutability: 'payable',
		type: 'function'
	},
	{
		inputs: [{internalType: 'contract IYearn4626', name: 'vault', type: 'address'}],
		name: 'redeem',
		outputs: [{internalType: 'uint256', name: '', type: 'uint256'}],
		stateMutability: 'payable',
		type: 'function'
	},
	{
		inputs: [
			{internalType: 'contract IYearn4626', name: 'vault', type: 'address'},
			{internalType: 'uint256', name: 'shares', type: 'uint256'},
			{internalType: 'address', name: 'to', type: 'address'},
			{internalType: 'uint256', name: 'maxLoss', type: 'uint256'}
		],
		name: 'redeem',
		outputs: [{internalType: 'uint256', name: '', type: 'uint256'}],
		stateMutability: 'payable',
		type: 'function'
	},
	{
		inputs: [
			{internalType: 'contract IYearn4626', name: 'vault', type: 'address'},
			{internalType: 'uint256', name: 'shares', type: 'uint256'},
			{internalType: 'address', name: 'to', type: 'address'},
			{internalType: 'uint256', name: 'minAmountOut', type: 'uint256'}
		],
		name: 'redeemDefault',
		outputs: [{internalType: 'uint256', name: 'amountOut', type: 'uint256'}],
		stateMutability: 'payable',
		type: 'function'
	},
	{inputs: [], name: 'refundETH', outputs: [], stateMutability: 'payable', type: 'function'},
	{
		inputs: [
			{internalType: 'address', name: 'token', type: 'address'},
			{internalType: 'uint256', name: 'value', type: 'uint256'},
			{internalType: 'uint256', name: 'deadline', type: 'uint256'},
			{internalType: 'uint8', name: 'v', type: 'uint8'},
			{internalType: 'bytes32', name: 'r', type: 'bytes32'},
			{internalType: 'bytes32', name: 's', type: 'bytes32'}
		],
		name: 'selfPermit',
		outputs: [],
		stateMutability: 'payable',
		type: 'function'
	},
	{
		inputs: [
			{internalType: 'address', name: 'token', type: 'address'},
			{internalType: 'uint256', name: 'nonce', type: 'uint256'},
			{internalType: 'uint256', name: 'expiry', type: 'uint256'},
			{internalType: 'uint8', name: 'v', type: 'uint8'},
			{internalType: 'bytes32', name: 'r', type: 'bytes32'},
			{internalType: 'bytes32', name: 's', type: 'bytes32'}
		],
		name: 'selfPermitAllowed',
		outputs: [],
		stateMutability: 'payable',
		type: 'function'
	},
	{
		inputs: [
			{internalType: 'address', name: 'token', type: 'address'},
			{internalType: 'uint256', name: 'nonce', type: 'uint256'},
			{internalType: 'uint256', name: 'expiry', type: 'uint256'},
			{internalType: 'uint8', name: 'v', type: 'uint8'},
			{internalType: 'bytes32', name: 'r', type: 'bytes32'},
			{internalType: 'bytes32', name: 's', type: 'bytes32'}
		],
		name: 'selfPermitAllowedIfNecessary',
		outputs: [],
		stateMutability: 'payable',
		type: 'function'
	},
	{
		inputs: [
			{internalType: 'address', name: 'token', type: 'address'},
			{internalType: 'uint256', name: 'value', type: 'uint256'},
			{internalType: 'uint256', name: 'deadline', type: 'uint256'},
			{internalType: 'uint8', name: 'v', type: 'uint8'},
			{internalType: 'bytes32', name: 'r', type: 'bytes32'},
			{internalType: 'bytes32', name: 's', type: 'bytes32'}
		],
		name: 'selfPermitIfNecessary',
		outputs: [],
		stateMutability: 'payable',
		type: 'function'
	},
	{
		inputs: [
			{internalType: 'contract ERC20', name: 'token', type: 'address'},
			{internalType: 'uint256', name: 'amountMinimum', type: 'uint256'},
			{internalType: 'address', name: 'recipient', type: 'address'}
		],
		name: 'sweepToken',
		outputs: [],
		stateMutability: 'payable',
		type: 'function'
	},
	{
		inputs: [
			{internalType: 'uint256', name: 'amountMinimum', type: 'uint256'},
			{internalType: 'address', name: 'recipient', type: 'address'}
		],
		name: 'unwrapWETH9',
		outputs: [],
		stateMutability: 'payable',
		type: 'function'
	},
	{
		inputs: [
			{internalType: 'contract IYearn4626', name: 'vault', type: 'address'},
			{internalType: 'uint256', name: 'amount', type: 'uint256'},
			{internalType: 'address', name: 'to', type: 'address'},
			{internalType: 'uint256', name: 'maxLoss', type: 'uint256'}
		],
		name: 'withdraw',
		outputs: [{internalType: 'uint256', name: '', type: 'uint256'}],
		stateMutability: 'payable',
		type: 'function'
	},
	{
		inputs: [
			{internalType: 'contract IYearn4626', name: 'vault', type: 'address'},
			{internalType: 'uint256', name: 'amount', type: 'uint256'},
			{internalType: 'address', name: 'to', type: 'address'},
			{internalType: 'uint256', name: 'maxSharesOut', type: 'uint256'}
		],
		name: 'withdrawDefault',
		outputs: [{internalType: 'uint256', name: 'sharesOut', type: 'uint256'}],
		stateMutability: 'payable',
		type: 'function'
	},
	{inputs: [], name: 'wrapWETH9', outputs: [], stateMutability: 'payable', type: 'function'},
	{stateMutability: 'payable', type: 'receive'}
] as const;
