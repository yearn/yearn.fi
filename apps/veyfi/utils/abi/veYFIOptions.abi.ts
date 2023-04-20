const VEYFI_OPTIONS_ABI = [
	{
		'anonymous': false,
		'inputs': [
			{
				'indexed': false,
				'name': 'yfi_recovered',
				'type': 'uint256'
			}
		],
		'name': 'Killed',
		'type': 'event'
	},
	{
		'anonymous': false,
		'inputs': [
			{
				'indexed': false,
				'name': 'token',
				'type': 'address'
			},
			{
				'indexed': false,
				'name': 'amount',
				'type': 'uint256'
			}
		],
		'name': 'Sweep',
		'type': 'event'
	},
	{
		'anonymous': false,
		'inputs': [
			{
				'indexed': true,
				'name': 'previous_owner',
				'type': 'address'
			},
			{
				'indexed': true,
				'name': 'new_owner',
				'type': 'address'
			}
		],
		'name': 'OwnershipTransferStarted',
		'type': 'event'
	},
	{
		'anonymous': false,
		'inputs': [
			{
				'indexed': true,
				'name': 'previous_owner',
				'type': 'address'
			},
			{
				'indexed': true,
				'name': 'new_owner',
				'type': 'address'
			}
		],
		'name': 'OwnershipTransferred',
		'type': 'event'
	},
	{
		'anonymous': false,
		'inputs': [
			{
				'indexed': true,
				'name': 'payee',
				'type': 'address'
			}
		],
		'name': 'SetPayee',
		'type': 'event'
	},
	{
		'inputs': [
			{
				'name': 'yfi',
				'type': 'address'
			},
			{
				'name': 'o_yfi',
				'type': 'address'
			},
			{
				'name': 've_yfi',
				'type': 'address'
			},
			{
				'name': 'owner',
				'type': 'address'
			},
			{
				'name': 'price_feed',
				'type': 'address'
			},
			{
				'name': 'curve_pool',
				'type': 'address'
			}
		],
		'stateMutability': 'nonpayable',
		'type': 'constructor'
	},
	{
		'inputs': [
			{
				'name': 'amount',
				'type': 'uint256'
			}
		],
		'name': 'exercise',
		'outputs': [
			{
				'name': '',
				'type': 'uint256'
			}
		],
		'stateMutability': 'payable',
		'type': 'function'
	},
	{
		'inputs': [
			{
				'name': 'amount',
				'type': 'uint256'
			},
			{
				'name': 'recipient',
				'type': 'address'
			}
		],
		'name': 'exercise',
		'outputs': [
			{
				'name': '',
				'type': 'uint256'
			}
		],
		'stateMutability': 'payable',
		'type': 'function'
	},
	{
		'inputs': [
			{
				'name': 'amount',
				'type': 'uint256'
			}
		],
		'name': 'eth_required',
		'outputs': [
			{
				'name': '',
				'type': 'uint256'
			}
		],
		'stateMutability': 'view',
		'type': 'function'
	},
	{
		'inputs': [],
		'name': 'get_latest_price',
		'outputs': [
			{
				'name': '',
				'type': 'uint256'
			}
		],
		'stateMutability': 'view',
		'type': 'function'
	},
	{
		'inputs': [
			{
				'name': 'new_payee',
				'type': 'address'
			}
		],
		'name': 'set_payee',
		'outputs': [],
		'stateMutability': 'nonpayable',
		'type': 'function'
	},
	{
		'inputs': [],
		'name': 'kill',
		'outputs': [],
		'stateMutability': 'nonpayable',
		'type': 'function'
	},
	{
		'inputs': [
			{
				'name': 'token',
				'type': 'address'
			}
		],
		'name': 'sweep',
		'outputs': [
			{
				'name': '',
				'type': 'uint256'
			}
		],
		'stateMutability': 'nonpayable',
		'type': 'function'
	},
	{
		'inputs': [
			{
				'name': 'new_owner',
				'type': 'address'
			}
		],
		'name': 'transfer_ownership',
		'outputs': [],
		'stateMutability': 'nonpayable',
		'type': 'function'
	},
	{
		'inputs': [],
		'name': 'accept_ownership',
		'outputs': [],
		'stateMutability': 'nonpayable',
		'type': 'function'
	},
	{
		'inputs': [],
		'name': 'owner',
		'outputs': [
			{
				'name': '',
				'type': 'address'
			}
		],
		'stateMutability': 'view',
		'type': 'function'
	},
	{
		'inputs': [],
		'name': 'pending_owner',
		'outputs': [
			{
				'name': '',
				'type': 'address'
			}
		],
		'stateMutability': 'view',
		'type': 'function'
	},
	{
		'inputs': [],
		'name': 'killed',
		'outputs': [
			{
				'name': '',
				'type': 'bool'
			}
		],
		'stateMutability': 'view',
		'type': 'function'
	},
	{
		'inputs': [],
		'name': 'payee',
		'outputs': [
			{
				'name': '',
				'type': 'address'
			}
		],
		'stateMutability': 'view',
		'type': 'function'
	}
];

export default VEYFI_OPTIONS_ABI;
