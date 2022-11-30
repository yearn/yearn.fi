const ZAP_ETH_TO_YVETH_ABI = [
	{
		'stateMutability': 'nonpayable',
		'type': 'constructor',
		'inputs': [
			{
				'name': 'vault',
				'type': 'address'
			}
		],
		'outputs': []
	}, {
		'stateMutability': 'payable',
		'type': 'function',
		'name': 'deposit',
		'inputs': [],
		'outputs': []
	}, {
		'stateMutability': 'nonpayable',
		'type': 'function',
		'name': 'withdraw',
		'inputs': [
			{
				'name': 'amount',
				'type': 'uint256'
			}
		],
		'outputs': []
	}, {
		'stateMutability': 'payable',
		'type': 'fallback'
	}
];

export default ZAP_ETH_TO_YVETH_ABI;