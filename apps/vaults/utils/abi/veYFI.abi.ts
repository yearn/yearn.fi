export const VEYFI_ABI = [
	{
		name: 'ModifyLock',
		inputs: [
			{name: 'sender', type: 'address', indexed: true},
			{name: 'user', type: 'address', indexed: true},
			{name: 'amount', type: 'uint256', indexed: false},
			{name: 'locktime', type: 'uint256', indexed: false},
			{name: 'ts', type: 'uint256', indexed: false}
		],
		anonymous: false,
		type: 'event'
	},
	{
		name: 'Withdraw',
		inputs: [
			{name: 'user', type: 'address', indexed: true},
			{name: 'amount', type: 'uint256', indexed: false},
			{name: 'ts', type: 'uint256', indexed: false}
		],
		anonymous: false,
		type: 'event'
	},
	{
		name: 'Penalty',
		inputs: [
			{name: 'user', type: 'address', indexed: true},
			{name: 'amount', type: 'uint256', indexed: false},
			{name: 'ts', type: 'uint256', indexed: false}
		],
		anonymous: false,
		type: 'event'
	},
	{
		name: 'Supply',
		inputs: [
			{name: 'old_supply', type: 'uint256', indexed: false},
			{name: 'new_supply', type: 'uint256', indexed: false},
			{name: 'ts', type: 'uint256', indexed: false}
		],
		anonymous: false,
		type: 'event'
	},
	{
		name: 'Initialized',
		inputs: [
			{name: 'token', type: 'address', indexed: false},
			{name: 'reward_pool', type: 'address', indexed: false}
		],
		anonymous: false,
		type: 'event'
	},
	{
		stateMutability: 'nonpayable',
		type: 'constructor',
		inputs: [
			{name: 'token', type: 'address'},
			{name: 'reward_pool', type: 'address'}
		],
		outputs: []
	},
	{
		stateMutability: 'view',
		type: 'function',
		name: 'get_last_user_point',
		inputs: [{name: 'addr', type: 'address'}],
		outputs: [
			{
				name: '',
				type: 'tuple',
				components: [
					{name: 'bias', type: 'int128'},
					{name: 'slope', type: 'int128'},
					{name: 'ts', type: 'uint256'},
					{name: 'blk', type: 'uint256'}
				]
			}
		]
	},
	{stateMutability: 'nonpayable', type: 'function', name: 'checkpoint', inputs: [], outputs: []},
	{
		stateMutability: 'nonpayable',
		type: 'function',
		name: 'modify_lock',
		inputs: [
			{name: 'amount', type: 'uint256'},
			{name: 'unlock_time', type: 'uint256'}
		],
		outputs: [
			{
				name: '',
				type: 'tuple',
				components: [
					{name: 'amount', type: 'uint256'},
					{name: 'end', type: 'uint256'}
				]
			}
		]
	},
	{
		stateMutability: 'nonpayable',
		type: 'function',
		name: 'modify_lock',
		inputs: [
			{name: 'amount', type: 'uint256'},
			{name: 'unlock_time', type: 'uint256'},
			{name: 'user', type: 'address'}
		],
		outputs: [
			{
				name: '',
				type: 'tuple',
				components: [
					{name: 'amount', type: 'uint256'},
					{name: 'end', type: 'uint256'}
				]
			}
		]
	},
	{
		stateMutability: 'nonpayable',
		type: 'function',
		name: 'withdraw',
		inputs: [],
		outputs: [
			{
				name: '',
				type: 'tuple',
				components: [
					{name: 'amount', type: 'uint256'},
					{name: 'penalty', type: 'uint256'}
				]
			}
		]
	},
	{
		stateMutability: 'view',
		type: 'function',
		name: 'find_epoch_by_timestamp',
		inputs: [
			{name: 'user', type: 'address'},
			{name: 'ts', type: 'uint256'}
		],
		outputs: [{name: '', type: 'uint256'}]
	},
	{
		stateMutability: 'view',
		type: 'function',
		name: 'balanceOf',
		inputs: [{name: 'user', type: 'address'}],
		outputs: [{name: '', type: 'uint256'}]
	},
	{
		stateMutability: 'view',
		type: 'function',
		name: 'balanceOf',
		inputs: [
			{name: 'user', type: 'address'},
			{name: 'ts', type: 'uint256'}
		],
		outputs: [{name: '', type: 'uint256'}]
	},
	{
		stateMutability: 'view',
		type: 'function',
		name: 'getPriorVotes',
		inputs: [
			{name: 'user', type: 'address'},
			{name: 'height', type: 'uint256'}
		],
		outputs: [{name: '', type: 'uint256'}]
	},
	{
		stateMutability: 'view',
		type: 'function',
		name: 'totalSupply',
		inputs: [],
		outputs: [{name: '', type: 'uint256'}]
	},
	{
		stateMutability: 'view',
		type: 'function',
		name: 'totalSupply',
		inputs: [{name: 'ts', type: 'uint256'}],
		outputs: [{name: '', type: 'uint256'}]
	},
	{
		stateMutability: 'view',
		type: 'function',
		name: 'totalSupplyAt',
		inputs: [{name: 'height', type: 'uint256'}],
		outputs: [{name: '', type: 'uint256'}]
	},
	{stateMutability: 'view', type: 'function', name: 'token', inputs: [], outputs: [{name: '', type: 'address'}]},
	{
		stateMutability: 'view',
		type: 'function',
		name: 'reward_pool',
		inputs: [],
		outputs: [{name: '', type: 'address'}]
	},
	{stateMutability: 'view', type: 'function', name: 'name', inputs: [], outputs: [{name: '', type: 'string'}]},
	{stateMutability: 'view', type: 'function', name: 'symbol', inputs: [], outputs: [{name: '', type: 'string'}]},
	{stateMutability: 'view', type: 'function', name: 'decimals', inputs: [], outputs: [{name: '', type: 'uint8'}]},
	{stateMutability: 'view', type: 'function', name: 'supply', inputs: [], outputs: [{name: '', type: 'uint256'}]},
	{
		stateMutability: 'view',
		type: 'function',
		name: 'locked',
		inputs: [{name: 'arg0', type: 'address'}],
		outputs: [
			{
				name: '',
				type: 'tuple',
				components: [
					{name: 'amount', type: 'uint256'},
					{name: 'end', type: 'uint256'}
				]
			}
		]
	},
	{
		stateMutability: 'view',
		type: 'function',
		name: 'epoch',
		inputs: [{name: 'arg0', type: 'address'}],
		outputs: [{name: '', type: 'uint256'}]
	},
	{
		stateMutability: 'view',
		type: 'function',
		name: 'point_history',
		inputs: [
			{name: 'arg0', type: 'address'},
			{name: 'arg1', type: 'uint256'}
		],
		outputs: [
			{
				name: '',
				type: 'tuple',
				components: [
					{name: 'bias', type: 'int128'},
					{name: 'slope', type: 'int128'},
					{name: 'ts', type: 'uint256'},
					{name: 'blk', type: 'uint256'}
				]
			}
		]
	},
	{
		stateMutability: 'view',
		type: 'function',
		name: 'slope_changes',
		inputs: [
			{name: 'arg0', type: 'address'},
			{name: 'arg1', type: 'uint256'}
		],
		outputs: [{name: '', type: 'int128'}]
	}
];
