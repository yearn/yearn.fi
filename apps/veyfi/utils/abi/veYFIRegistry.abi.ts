// TODO: update once final version deployed
const VEYFI_REGISTRY_ABI = [
	{
		'inputs': [
			{
				'internalType': 'address',
				'name': '_ve',
				'type': 'address'
			},
			{
				'internalType': 'address',
				'name': '_yfi',
				'type': 'address'
			},
			{
				'internalType': 'address',
				'name': '_gaugefactory',
				'type': 'address'
			},
			{
				'internalType': 'address',
				'name': '_veYfiRewardPool',
				'type': 'address'
			}
		],
		'stateMutability': 'nonpayable',
		'type': 'constructor'
	},
	{
		'anonymous': false,
		'inputs': [
			{
				'indexed': true,
				'internalType': 'address',
				'name': 'previousOwner',
				'type': 'address'
			},
			{
				'indexed': true,
				'internalType': 'address',
				'name': 'newOwner',
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
				'internalType': 'address',
				'name': 've',
				'type': 'address'
			}
		],
		'name': 'UpdatedVeToken',
		'type': 'event'
	},
	{
		'anonymous': false,
		'inputs': [
			{
				'indexed': true,
				'internalType': 'address',
				'name': 'vault',
				'type': 'address'
			}
		],
		'name': 'VaultAdded',
		'type': 'event'
	},
	{
		'anonymous': false,
		'inputs': [
			{
				'indexed': true,
				'internalType': 'address',
				'name': 'vault',
				'type': 'address'
			}
		],
		'name': 'VaultRemoved',
		'type': 'event'
	},
	{
		'inputs': [
			{
				'internalType': 'address',
				'name': '_vault',
				'type': 'address'
			},
			{
				'internalType': 'address',
				'name': '_owner',
				'type': 'address'
			}
		],
		'name': 'addVaultToRewards',
		'outputs': [
			{
				'internalType': 'address',
				'name': '',
				'type': 'address'
			}
		],
		'stateMutability': 'nonpayable',
		'type': 'function'
	},
	{
		'inputs': [],
		'name': 'gaugefactory',
		'outputs': [
			{
				'internalType': 'address',
				'name': '',
				'type': 'address'
			}
		],
		'stateMutability': 'view',
		'type': 'function'
	},
	{
		'inputs': [
			{
				'internalType': 'address',
				'name': '',
				'type': 'address'
			}
		],
		'name': 'gauges',
		'outputs': [
			{
				'internalType': 'address',
				'name': '',
				'type': 'address'
			}
		],
		'stateMutability': 'view',
		'type': 'function'
	},
	{
		'inputs': [],
		'name': 'getVaults',
		'outputs': [
			{
				'internalType': 'address[]',
				'name': '',
				'type': 'address[]'
			}
		],
		'stateMutability': 'view',
		'type': 'function'
	},
	{
		'inputs': [
			{
				'internalType': 'address',
				'name': '',
				'type': 'address'
			}
		],
		'name': 'isGauge',
		'outputs': [
			{
				'internalType': 'bool',
				'name': '',
				'type': 'bool'
			}
		],
		'stateMutability': 'view',
		'type': 'function'
	},
	{
		'inputs': [],
		'name': 'owner',
		'outputs': [
			{
				'internalType': 'address',
				'name': '',
				'type': 'address'
			}
		],
		'stateMutability': 'view',
		'type': 'function'
	},
	{
		'inputs': [
			{
				'internalType': 'address',
				'name': '_vault',
				'type': 'address'
			}
		],
		'name': 'removeVaultFromRewards',
		'outputs': [],
		'stateMutability': 'nonpayable',
		'type': 'function'
	},
	{
		'inputs': [],
		'name': 'renounceOwnership',
		'outputs': [],
		'stateMutability': 'nonpayable',
		'type': 'function'
	},
	{
		'inputs': [
			{
				'internalType': 'address',
				'name': '_veToken',
				'type': 'address'
			}
		],
		'name': 'setVe',
		'outputs': [],
		'stateMutability': 'nonpayable',
		'type': 'function'
	},
	{
		'inputs': [
			{
				'internalType': 'address',
				'name': 'newOwner',
				'type': 'address'
			}
		],
		'name': 'transferOwnership',
		'outputs': [],
		'stateMutability': 'nonpayable',
		'type': 'function'
	},
	{
		'inputs': [
			{
				'internalType': 'address',
				'name': '',
				'type': 'address'
			}
		],
		'name': 'vaultForGauge',
		'outputs': [
			{
				'internalType': 'address',
				'name': '',
				'type': 'address'
			}
		],
		'stateMutability': 'view',
		'type': 'function'
	},
	{
		'inputs': [],
		'name': 'veToken',
		'outputs': [
			{
				'internalType': 'address',
				'name': '',
				'type': 'address'
			}
		],
		'stateMutability': 'view',
		'type': 'function'
	},
	{
		'inputs': [],
		'name': 'veYfiRewardPool',
		'outputs': [
			{
				'internalType': 'address',
				'name': '',
				'type': 'address'
			}
		],
		'stateMutability': 'view',
		'type': 'function'
	},
	{
		'inputs': [],
		'name': 'yfi',
		'outputs': [
			{
				'internalType': 'address',
				'name': '',
				'type': 'address'
			}
		],
		'stateMutability': 'view',
		'type': 'function'
	}
] as const;

export VEYFI_REGISTRY_ABI;
