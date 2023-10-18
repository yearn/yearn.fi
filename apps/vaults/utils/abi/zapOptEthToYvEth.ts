export const ZAP_OPT_ETH_TO_YVETH_ABI = [
	{stateMutability: 'nonpayable', type: 'constructor', inputs: [{name: 'vault', type: 'address'}], outputs: []},
	{stateMutability: 'payable', type: 'function', name: 'deposit', inputs: [], outputs: []},
	{
		stateMutability: 'nonpayable',
		type: 'function',
		name: 'withdraw',
		inputs: [{name: 'amount', type: 'uint256'}],
		outputs: []
	},
	{
		stateMutability: 'nonpayable',
		type: 'function',
		name: 'withdraw',
		inputs: [
			{name: 'amount', type: 'uint256'},
			{name: 'max_loss', type: 'uint256'}
		],
		outputs: []
	},
	{stateMutability: 'payable', type: 'fallback'},
	{stateMutability: 'view', type: 'function', name: 'VAULT', inputs: [], outputs: [{name: '', type: 'address'}]},
	{stateMutability: 'view', type: 'function', name: 'WETH', inputs: [], outputs: [{name: '', type: 'address'}]}
] as const;
