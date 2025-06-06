export const TOKENIZED_STRATEGY_ABI = [
	{
		inputs: [{internalType: 'address', name: '_factory', type: 'address'}],
		stateMutability: 'nonpayable',
		type: 'constructor'
	},
	{
		anonymous: false,
		inputs: [
			{indexed: true, internalType: 'address', name: 'owner', type: 'address'},
			{indexed: true, internalType: 'address', name: 'spender', type: 'address'},
			{indexed: false, internalType: 'uint256', name: 'value', type: 'uint256'}
		],
		name: 'Approval',
		type: 'event'
	},
	{
		anonymous: false,
		inputs: [
			{indexed: true, internalType: 'address', name: 'caller', type: 'address'},
			{indexed: true, internalType: 'address', name: 'owner', type: 'address'},
			{indexed: false, internalType: 'uint256', name: 'assets', type: 'uint256'},
			{indexed: false, internalType: 'uint256', name: 'shares', type: 'uint256'}
		],
		name: 'Deposit',
		type: 'event'
	},
	{
		anonymous: false,
		inputs: [
			{indexed: true, internalType: 'address', name: 'strategy', type: 'address'},
			{indexed: true, internalType: 'address', name: 'asset', type: 'address'},
			{indexed: false, internalType: 'string', name: 'apiVersion', type: 'string'}
		],
		name: 'NewTokenizedStrategy',
		type: 'event'
	},
	{
		anonymous: false,
		inputs: [
			{indexed: false, internalType: 'uint256', name: 'profit', type: 'uint256'},
			{indexed: false, internalType: 'uint256', name: 'loss', type: 'uint256'},
			{indexed: false, internalType: 'uint256', name: 'protocolFees', type: 'uint256'},
			{indexed: false, internalType: 'uint256', name: 'performanceFees', type: 'uint256'}
		],
		name: 'Reported',
		type: 'event'
	},
	{anonymous: false, inputs: [], name: 'StrategyShutdown', type: 'event'},
	{
		anonymous: false,
		inputs: [
			{indexed: true, internalType: 'address', name: 'from', type: 'address'},
			{indexed: true, internalType: 'address', name: 'to', type: 'address'},
			{indexed: false, internalType: 'uint256', name: 'value', type: 'uint256'}
		],
		name: 'Transfer',
		type: 'event'
	},
	{
		anonymous: false,
		inputs: [{indexed: true, internalType: 'address', name: 'newEmergencyAdmin', type: 'address'}],
		name: 'UpdateEmergencyAdmin',
		type: 'event'
	},
	{
		anonymous: false,
		inputs: [{indexed: true, internalType: 'address', name: 'newKeeper', type: 'address'}],
		name: 'UpdateKeeper',
		type: 'event'
	},
	{
		anonymous: false,
		inputs: [{indexed: true, internalType: 'address', name: 'newManagement', type: 'address'}],
		name: 'UpdateManagement',
		type: 'event'
	},
	{
		anonymous: false,
		inputs: [{indexed: true, internalType: 'address', name: 'newPendingManagement', type: 'address'}],
		name: 'UpdatePendingManagement',
		type: 'event'
	},
	{
		anonymous: false,
		inputs: [{indexed: false, internalType: 'uint16', name: 'newPerformanceFee', type: 'uint16'}],
		name: 'UpdatePerformanceFee',
		type: 'event'
	},
	{
		anonymous: false,
		inputs: [{indexed: true, internalType: 'address', name: 'newPerformanceFeeRecipient', type: 'address'}],
		name: 'UpdatePerformanceFeeRecipient',
		type: 'event'
	},
	{
		anonymous: false,
		inputs: [{indexed: false, internalType: 'uint256', name: 'newProfitMaxUnlockTime', type: 'uint256'}],
		name: 'UpdateProfitMaxUnlockTime',
		type: 'event'
	},
	{
		anonymous: false,
		inputs: [
			{indexed: true, internalType: 'address', name: 'caller', type: 'address'},
			{indexed: true, internalType: 'address', name: 'receiver', type: 'address'},
			{indexed: true, internalType: 'address', name: 'owner', type: 'address'},
			{indexed: false, internalType: 'uint256', name: 'assets', type: 'uint256'},
			{indexed: false, internalType: 'uint256', name: 'shares', type: 'uint256'}
		],
		name: 'Withdraw',
		type: 'event'
	},
	{
		inputs: [],
		name: 'DOMAIN_SEPARATOR',
		outputs: [{internalType: 'bytes32', name: '', type: 'bytes32'}],
		stateMutability: 'view',
		type: 'function'
	},
	{
		inputs: [],
		name: 'FACTORY',
		outputs: [{internalType: 'address', name: '', type: 'address'}],
		stateMutability: 'view',
		type: 'function'
	},
	{
		inputs: [],
		name: 'MAX_FEE',
		outputs: [{internalType: 'uint16', name: '', type: 'uint16'}],
		stateMutability: 'view',
		type: 'function'
	},
	{inputs: [], name: 'acceptManagement', outputs: [], stateMutability: 'nonpayable', type: 'function'},
	{
		inputs: [
			{internalType: 'address', name: 'owner', type: 'address'},
			{internalType: 'address', name: 'spender', type: 'address'}
		],
		name: 'allowance',
		outputs: [{internalType: 'uint256', name: '', type: 'uint256'}],
		stateMutability: 'view',
		type: 'function'
	},
	{
		inputs: [],
		name: 'apiVersion',
		outputs: [{internalType: 'string', name: '', type: 'string'}],
		stateMutability: 'pure',
		type: 'function'
	},
	{
		inputs: [
			{internalType: 'address', name: 'spender', type: 'address'},
			{internalType: 'uint256', name: 'amount', type: 'uint256'}
		],
		name: 'approve',
		outputs: [{internalType: 'bool', name: '', type: 'bool'}],
		stateMutability: 'nonpayable',
		type: 'function'
	},
	{
		inputs: [],
		name: 'asset',
		outputs: [{internalType: 'address', name: '', type: 'address'}],
		stateMutability: 'view',
		type: 'function'
	},
	{
		inputs: [{internalType: 'address', name: 'account', type: 'address'}],
		name: 'balanceOf',
		outputs: [{internalType: 'uint256', name: '', type: 'uint256'}],
		stateMutability: 'view',
		type: 'function'
	},
	{
		inputs: [{internalType: 'uint256', name: 'shares', type: 'uint256'}],
		name: 'convertToAssets',
		outputs: [{internalType: 'uint256', name: '', type: 'uint256'}],
		stateMutability: 'view',
		type: 'function'
	},
	{
		inputs: [{internalType: 'uint256', name: 'assets', type: 'uint256'}],
		name: 'convertToShares',
		outputs: [{internalType: 'uint256', name: '', type: 'uint256'}],
		stateMutability: 'view',
		type: 'function'
	},
	{
		inputs: [],
		name: 'decimals',
		outputs: [{internalType: 'uint8', name: '', type: 'uint8'}],
		stateMutability: 'view',
		type: 'function'
	},
	{
		inputs: [
			{internalType: 'uint256', name: 'assets', type: 'uint256'},
			{internalType: 'address', name: 'receiver', type: 'address'}
		],
		name: 'deposit',
		outputs: [{internalType: 'uint256', name: 'shares', type: 'uint256'}],
		stateMutability: 'nonpayable',
		type: 'function'
	},
	{
		inputs: [],
		name: 'emergencyAdmin',
		outputs: [{internalType: 'address', name: '', type: 'address'}],
		stateMutability: 'view',
		type: 'function'
	},
	{
		inputs: [{internalType: 'uint256', name: 'amount', type: 'uint256'}],
		name: 'emergencyWithdraw',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function'
	},
	{
		inputs: [],
		name: 'fullProfitUnlockDate',
		outputs: [{internalType: 'uint256', name: '', type: 'uint256'}],
		stateMutability: 'view',
		type: 'function'
	},
	{
		inputs: [
			{internalType: 'address', name: '_asset', type: 'address'},
			{internalType: 'string', name: '_name', type: 'string'},
			{internalType: 'address', name: '_management', type: 'address'},
			{internalType: 'address', name: '_performanceFeeRecipient', type: 'address'},
			{internalType: 'address', name: '_keeper', type: 'address'}
		],
		name: 'initialize',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function'
	},
	{
		inputs: [],
		name: 'isShutdown',
		outputs: [{internalType: 'bool', name: '', type: 'bool'}],
		stateMutability: 'view',
		type: 'function'
	},
	{
		inputs: [],
		name: 'keeper',
		outputs: [{internalType: 'address', name: '', type: 'address'}],
		stateMutability: 'view',
		type: 'function'
	},
	{
		inputs: [],
		name: 'lastReport',
		outputs: [{internalType: 'uint256', name: '', type: 'uint256'}],
		stateMutability: 'view',
		type: 'function'
	},
	{
		inputs: [],
		name: 'management',
		outputs: [{internalType: 'address', name: '', type: 'address'}],
		stateMutability: 'view',
		type: 'function'
	},
	{
		inputs: [{internalType: 'address', name: 'receiver', type: 'address'}],
		name: 'maxDeposit',
		outputs: [{internalType: 'uint256', name: '', type: 'uint256'}],
		stateMutability: 'view',
		type: 'function'
	},
	{
		inputs: [{internalType: 'address', name: 'receiver', type: 'address'}],
		name: 'maxMint',
		outputs: [{internalType: 'uint256', name: '', type: 'uint256'}],
		stateMutability: 'view',
		type: 'function'
	},
	{
		inputs: [
			{internalType: 'address', name: 'owner', type: 'address'},
			{internalType: 'uint256', name: '', type: 'uint256'}
		],
		name: 'maxRedeem',
		outputs: [{internalType: 'uint256', name: '', type: 'uint256'}],
		stateMutability: 'view',
		type: 'function'
	},
	{
		inputs: [{internalType: 'address', name: 'owner', type: 'address'}],
		name: 'maxRedeem',
		outputs: [{internalType: 'uint256', name: '', type: 'uint256'}],
		stateMutability: 'view',
		type: 'function'
	},
	{
		inputs: [
			{internalType: 'address', name: 'owner', type: 'address'},
			{internalType: 'uint256', name: '', type: 'uint256'}
		],
		name: 'maxWithdraw',
		outputs: [{internalType: 'uint256', name: '', type: 'uint256'}],
		stateMutability: 'view',
		type: 'function'
	},
	{
		inputs: [{internalType: 'address', name: 'owner', type: 'address'}],
		name: 'maxWithdraw',
		outputs: [{internalType: 'uint256', name: '', type: 'uint256'}],
		stateMutability: 'view',
		type: 'function'
	},
	{
		inputs: [
			{internalType: 'uint256', name: 'shares', type: 'uint256'},
			{internalType: 'address', name: 'receiver', type: 'address'}
		],
		name: 'mint',
		outputs: [{internalType: 'uint256', name: 'assets', type: 'uint256'}],
		stateMutability: 'nonpayable',
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
		inputs: [{internalType: 'address', name: '_owner', type: 'address'}],
		name: 'nonces',
		outputs: [{internalType: 'uint256', name: '', type: 'uint256'}],
		stateMutability: 'view',
		type: 'function'
	},
	{
		inputs: [],
		name: 'pendingManagement',
		outputs: [{internalType: 'address', name: '', type: 'address'}],
		stateMutability: 'view',
		type: 'function'
	},
	{
		inputs: [],
		name: 'performanceFee',
		outputs: [{internalType: 'uint16', name: '', type: 'uint16'}],
		stateMutability: 'view',
		type: 'function'
	},
	{
		inputs: [],
		name: 'performanceFeeRecipient',
		outputs: [{internalType: 'address', name: '', type: 'address'}],
		stateMutability: 'view',
		type: 'function'
	},
	{
		inputs: [
			{internalType: 'address', name: 'owner', type: 'address'},
			{internalType: 'address', name: 'spender', type: 'address'},
			{internalType: 'uint256', name: 'value', type: 'uint256'},
			{internalType: 'uint256', name: 'deadline', type: 'uint256'},
			{internalType: 'uint8', name: 'v', type: 'uint8'},
			{internalType: 'bytes32', name: 'r', type: 'bytes32'},
			{internalType: 'bytes32', name: 's', type: 'bytes32'}
		],
		name: 'permit',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function'
	},
	{
		inputs: [{internalType: 'uint256', name: 'assets', type: 'uint256'}],
		name: 'previewDeposit',
		outputs: [{internalType: 'uint256', name: '', type: 'uint256'}],
		stateMutability: 'view',
		type: 'function'
	},
	{
		inputs: [{internalType: 'uint256', name: 'shares', type: 'uint256'}],
		name: 'previewMint',
		outputs: [{internalType: 'uint256', name: '', type: 'uint256'}],
		stateMutability: 'view',
		type: 'function'
	},
	{
		inputs: [{internalType: 'uint256', name: 'shares', type: 'uint256'}],
		name: 'previewRedeem',
		outputs: [{internalType: 'uint256', name: '', type: 'uint256'}],
		stateMutability: 'view',
		type: 'function'
	},
	{
		inputs: [{internalType: 'uint256', name: 'assets', type: 'uint256'}],
		name: 'previewWithdraw',
		outputs: [{internalType: 'uint256', name: '', type: 'uint256'}],
		stateMutability: 'view',
		type: 'function'
	},
	{
		inputs: [],
		name: 'pricePerShare',
		outputs: [{internalType: 'uint256', name: '', type: 'uint256'}],
		stateMutability: 'view',
		type: 'function'
	},
	{
		inputs: [],
		name: 'profitMaxUnlockTime',
		outputs: [{internalType: 'uint256', name: '', type: 'uint256'}],
		stateMutability: 'view',
		type: 'function'
	},
	{
		inputs: [],
		name: 'profitUnlockingRate',
		outputs: [{internalType: 'uint256', name: '', type: 'uint256'}],
		stateMutability: 'view',
		type: 'function'
	},
	{
		inputs: [
			{internalType: 'uint256', name: 'shares', type: 'uint256'},
			{internalType: 'address', name: 'receiver', type: 'address'},
			{internalType: 'address', name: 'owner', type: 'address'},
			{internalType: 'uint256', name: 'maxLoss', type: 'uint256'}
		],
		name: 'redeem',
		outputs: [{internalType: 'uint256', name: '', type: 'uint256'}],
		stateMutability: 'nonpayable',
		type: 'function'
	},
	{
		inputs: [
			{internalType: 'uint256', name: 'shares', type: 'uint256'},
			{internalType: 'address', name: 'receiver', type: 'address'},
			{internalType: 'address', name: 'owner', type: 'address'}
		],
		name: 'redeem',
		outputs: [{internalType: 'uint256', name: '', type: 'uint256'}],
		stateMutability: 'nonpayable',
		type: 'function'
	},
	{
		inputs: [],
		name: 'report',
		outputs: [
			{internalType: 'uint256', name: 'profit', type: 'uint256'},
			{internalType: 'uint256', name: 'loss', type: 'uint256'}
		],
		stateMutability: 'nonpayable',
		type: 'function'
	},
	{
		inputs: [{internalType: 'address', name: '_sender', type: 'address'}],
		name: 'requireEmergencyAuthorized',
		outputs: [],
		stateMutability: 'view',
		type: 'function'
	},
	{
		inputs: [{internalType: 'address', name: '_sender', type: 'address'}],
		name: 'requireKeeperOrManagement',
		outputs: [],
		stateMutability: 'view',
		type: 'function'
	},
	{
		inputs: [{internalType: 'address', name: '_sender', type: 'address'}],
		name: 'requireManagement',
		outputs: [],
		stateMutability: 'view',
		type: 'function'
	},
	{
		inputs: [{internalType: 'address', name: '_emergencyAdmin', type: 'address'}],
		name: 'setEmergencyAdmin',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function'
	},
	{
		inputs: [{internalType: 'address', name: '_keeper', type: 'address'}],
		name: 'setKeeper',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function'
	},
	{
		inputs: [{internalType: 'string', name: '_name', type: 'string'}],
		name: 'setName',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function'
	},
	{
		inputs: [{internalType: 'address', name: '_management', type: 'address'}],
		name: 'setPendingManagement',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function'
	},
	{
		inputs: [{internalType: 'uint16', name: '_performanceFee', type: 'uint16'}],
		name: 'setPerformanceFee',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function'
	},
	{
		inputs: [{internalType: 'address', name: '_performanceFeeRecipient', type: 'address'}],
		name: 'setPerformanceFeeRecipient',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function'
	},
	{
		inputs: [{internalType: 'uint256', name: '_profitMaxUnlockTime', type: 'uint256'}],
		name: 'setProfitMaxUnlockTime',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function'
	},
	{inputs: [], name: 'shutdownStrategy', outputs: [], stateMutability: 'nonpayable', type: 'function'},
	{
		inputs: [],
		name: 'symbol',
		outputs: [{internalType: 'string', name: '', type: 'string'}],
		stateMutability: 'view',
		type: 'function'
	},
	{inputs: [], name: 'tend', outputs: [], stateMutability: 'nonpayable', type: 'function'},
	{
		inputs: [],
		name: 'totalAssets',
		outputs: [{internalType: 'uint256', name: '', type: 'uint256'}],
		stateMutability: 'view',
		type: 'function'
	},
	{
		inputs: [],
		name: 'totalSupply',
		outputs: [{internalType: 'uint256', name: '', type: 'uint256'}],
		stateMutability: 'view',
		type: 'function'
	},
	{
		inputs: [
			{internalType: 'address', name: 'to', type: 'address'},
			{internalType: 'uint256', name: 'amount', type: 'uint256'}
		],
		name: 'transfer',
		outputs: [{internalType: 'bool', name: '', type: 'bool'}],
		stateMutability: 'nonpayable',
		type: 'function'
	},
	{
		inputs: [
			{internalType: 'address', name: 'from', type: 'address'},
			{internalType: 'address', name: 'to', type: 'address'},
			{internalType: 'uint256', name: 'amount', type: 'uint256'}
		],
		name: 'transferFrom',
		outputs: [{internalType: 'bool', name: '', type: 'bool'}],
		stateMutability: 'nonpayable',
		type: 'function'
	},
	{
		inputs: [],
		name: 'unlockedShares',
		outputs: [{internalType: 'uint256', name: '', type: 'uint256'}],
		stateMutability: 'view',
		type: 'function'
	},
	{
		inputs: [
			{internalType: 'uint256', name: 'assets', type: 'uint256'},
			{internalType: 'address', name: 'receiver', type: 'address'},
			{internalType: 'address', name: 'owner', type: 'address'},
			{internalType: 'uint256', name: 'maxLoss', type: 'uint256'}
		],
		name: 'withdraw',
		outputs: [{internalType: 'uint256', name: 'shares', type: 'uint256'}],
		stateMutability: 'nonpayable',
		type: 'function'
	},
	{
		inputs: [
			{internalType: 'uint256', name: 'assets', type: 'uint256'},
			{internalType: 'address', name: 'receiver', type: 'address'},
			{internalType: 'address', name: 'owner', type: 'address'}
		],
		name: 'withdraw',
		outputs: [{internalType: 'uint256', name: 'shares', type: 'uint256'}],
		stateMutability: 'nonpayable',
		type: 'function'
	}
] as const;
