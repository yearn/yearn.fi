const ZAP_FTM_TO_YVFTM_ABI = [
	{
		'inputs': [
			{
				'internalType': 'contract Vault',
				'name': '_vault',
				'type': 'address'
			}
		],
		'stateMutability': 'nonpayable',
		'type': 'constructor'
	}, {
		'inputs': [],
		'name': 'deposit',
		'outputs': [],
		'stateMutability': 'payable',
		'type': 'function'
	}, {
		'inputs': [
			{
				'internalType': 'uint256',
				'name': 'amount',
				'type': 'uint256'
			}
		],
		'name': 'withdraw',
		'outputs': [],
		'stateMutability': 'nonpayable',
		'type': 'function'
	}, {
		'stateMutability': 'payable',
		'type': 'receive'
	}
];

export default ZAP_FTM_TO_YVFTM_ABI;