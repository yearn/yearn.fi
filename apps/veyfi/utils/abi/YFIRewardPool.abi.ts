export const YFI_REWARD_POOL_ABI = [
	{
		name: 'Initialized',
		inputs: [
			{name: 'veyfi', type: 'address', indexed: false},
			{name: 'start_time', type: 'uint256', indexed: false}
		],
		anonymous: false,
		type: 'event'
	},
	{
		name: 'CheckpointToken',
		inputs: [
			{name: 'time', type: 'uint256', indexed: false},
			{name: 'tokens', type: 'uint256', indexed: false}
		],
		anonymous: false,
		type: 'event'
	},
	{
		name: 'Claimed',
		inputs: [
			{name: 'recipient', type: 'address', indexed: true},
			{name: 'amount', type: 'uint256', indexed: false},
			{name: 'week_cursor', type: 'uint256', indexed: false},
			{name: 'max_epoch', type: 'uint256', indexed: false}
		],
		anonymous: false,
		type: 'event'
	},
	{
		name: 'AllowedToRelock',
		inputs: [
			{name: 'user', type: 'address', indexed: true},
			{name: 'relocker', type: 'address', indexed: true},
			{name: 'allowed', type: 'bool', indexed: false}
		],
		anonymous: false,
		type: 'event'
	},
	{
		name: 'RewardReceived',
		inputs: [
			{name: 'sender', type: 'address', indexed: true},
			{name: 'amount', type: 'uint256', indexed: false}
		],
		anonymous: false,
		type: 'event'
	},
	{
		stateMutability: 'nonpayable',
		type: 'constructor',
		inputs: [
			{name: 'veyfi', type: 'address'},
			{name: 'start_time', type: 'uint256'}
		],
		outputs: []
	},
	{stateMutability: 'nonpayable', type: 'function', name: 'checkpoint_token', inputs: [], outputs: []},
	{stateMutability: 'nonpayable', type: 'function', name: 'checkpoint_total_supply', inputs: [], outputs: []},
	{
		stateMutability: 'nonpayable',
		type: 'function',
		name: 'claim',
		inputs: [],
		outputs: [{name: '', type: 'uint256'}]
	},
	{
		stateMutability: 'nonpayable',
		type: 'function',
		name: 'claim',
		inputs: [{name: 'user', type: 'address'}],
		outputs: [{name: '', type: 'uint256'}]
	},
	{
		stateMutability: 'nonpayable',
		type: 'function',
		name: 'claim',
		inputs: [
			{name: 'user', type: 'address'},
			{name: 'relock', type: 'bool'}
		],
		outputs: [{name: '', type: 'uint256'}]
	},
	{stateMutability: 'nonpayable', type: 'function', name: 'burn', inputs: [], outputs: [{name: '', type: 'bool'}]},
	{
		stateMutability: 'nonpayable',
		type: 'function',
		name: 'burn',
		inputs: [{name: 'amount', type: 'uint256'}],
		outputs: [{name: '', type: 'bool'}]
	},
	{
		stateMutability: 'nonpayable',
		type: 'function',
		name: 'toggle_allowed_to_relock',
		inputs: [{name: 'user', type: 'address'}],
		outputs: [{name: '', type: 'bool'}]
	},
	{stateMutability: 'view', type: 'function', name: 'token', inputs: [], outputs: [{name: '', type: 'address'}]},
	{stateMutability: 'view', type: 'function', name: 'veyfi', inputs: [], outputs: [{name: '', type: 'address'}]},
	{stateMutability: 'view', type: 'function', name: 'start_time', inputs: [], outputs: [{name: '', type: 'uint256'}]},
	{
		stateMutability: 'view',
		type: 'function',
		name: 'time_cursor',
		inputs: [],
		outputs: [{name: '', type: 'uint256'}]
	},
	{
		stateMutability: 'view',
		type: 'function',
		name: 'time_cursor_of',
		inputs: [{name: 'arg0', type: 'address'}],
		outputs: [{name: '', type: 'uint256'}]
	},
	{
		stateMutability: 'view',
		type: 'function',
		name: 'allowed_to_relock',
		inputs: [
			{name: 'arg0', type: 'address'},
			{name: 'arg1', type: 'address'}
		],
		outputs: [{name: '', type: 'bool'}]
	},
	{
		stateMutability: 'view',
		type: 'function',
		name: 'last_token_time',
		inputs: [],
		outputs: [{name: '', type: 'uint256'}]
	},
	{
		stateMutability: 'view',
		type: 'function',
		name: 'tokens_per_week',
		inputs: [{name: 'arg0', type: 'uint256'}],
		outputs: [{name: '', type: 'uint256'}]
	},
	{
		stateMutability: 'view',
		type: 'function',
		name: 'token_last_balance',
		inputs: [],
		outputs: [{name: '', type: 'uint256'}]
	},
	{
		stateMutability: 'view',
		type: 'function',
		name: 've_supply',
		inputs: [{name: 'arg0', type: 'uint256'}],
		outputs: [{name: '', type: 'uint256'}]
	}
] as const;
