export const ZAP_CRV_ABI = [
	{
		name: 'UpdateSweepRecipient',
		inputs: [{name: 'sweep_recipient', type: 'address', indexed: true}],
		anonymous: false,
		type: 'event'
	},
	{
		name: 'UpdateMintBuffer',
		inputs: [{name: 'mint_buffer', type: 'uint256', indexed: false}],
		anonymous: false,
		type: 'event'
	},
	{stateMutability: 'nonpayable', type: 'constructor', inputs: [], outputs: []},
	{
		stateMutability: 'nonpayable',
		type: 'function',
		name: 'zap',
		inputs: [
			{name: '_input_token', type: 'address'},
			{name: '_output_token', type: 'address'},
			{name: '_amount_in', type: 'uint256'},
			{name: '_min_out', type: 'uint256'}
		],
		outputs: [{name: '', type: 'uint256'}]
	},
	{
		stateMutability: 'nonpayable',
		type: 'function',
		name: 'set_sweep_recipient',
		inputs: [{name: '_proposed_sweep_recipient', type: 'address'}],
		outputs: []
	},
	{
		stateMutability: 'view',
		type: 'function',
		name: 'relative_price',
		inputs: [
			{name: '_input_token', type: 'address'},
			{name: '_output_token', type: 'address'},
			{name: '_amount_in', type: 'uint256'}
		],
		outputs: [{name: '', type: 'uint256'}]
	},
	{
		stateMutability: 'view',
		type: 'function',
		name: 'calc_expected_out',
		inputs: [
			{name: '_input_token', type: 'address'},
			{name: '_output_token', type: 'address'},
			{name: '_amount_in', type: 'uint256'}
		],
		outputs: [{name: '', type: 'uint256'}]
	},
	{
		stateMutability: 'nonpayable',
		type: 'function',
		name: 'sweep',
		inputs: [{name: '_token', type: 'address'}],
		outputs: []
	},
	{
		stateMutability: 'nonpayable',
		type: 'function',
		name: 'sweep',
		inputs: [
			{name: '_token', type: 'address'},
			{name: '_amount', type: 'uint256'}
		],
		outputs: []
	},
	{
		stateMutability: 'nonpayable',
		type: 'function',
		name: 'set_mint_buffer',
		inputs: [{name: '_new_buffer', type: 'uint256'}],
		outputs: []
	},
	{stateMutability: 'view', type: 'function', name: 'name', inputs: [], outputs: [{name: '', type: 'string'}]},
	{
		stateMutability: 'view',
		type: 'function',
		name: 'sweep_recipient',
		inputs: [],
		outputs: [{name: '', type: 'address'}]
	},
	{
		stateMutability: 'view',
		type: 'function',
		name: 'mint_buffer',
		inputs: [],
		outputs: [{name: '', type: 'uint256'}]
	},
	{
		stateMutability: 'view',
		type: 'function',
		name: 'legacy_tokens',
		inputs: [{name: 'arg0', type: 'uint256'}],
		outputs: [{name: '', type: 'address'}]
	},
	{
		stateMutability: 'view',
		type: 'function',
		name: 'output_tokens',
		inputs: [{name: 'arg0', type: 'uint256'}],
		outputs: [{name: '', type: 'address'}]
	}
] as const;
