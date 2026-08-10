export const timelockControllerAbi = [
  {
    type: 'event',
    name: 'CallScheduled',
    inputs: [
      { name: 'id', type: 'bytes32', indexed: true },
      { name: 'index', type: 'uint256', indexed: true },
      { name: 'target', type: 'address', indexed: false },
      { name: 'value', type: 'uint256', indexed: false },
      { name: 'data', type: 'bytes', indexed: false },
      { name: 'predecessor', type: 'bytes32', indexed: false },
      { name: 'delay', type: 'uint256', indexed: false }
    ]
  },
  {
    type: 'event',
    name: 'CallExecuted',
    inputs: [
      { name: 'id', type: 'bytes32', indexed: true },
      { name: 'index', type: 'uint256', indexed: true },
      { name: 'target', type: 'address', indexed: false },
      { name: 'value', type: 'uint256', indexed: false },
      { name: 'data', type: 'bytes', indexed: false }
    ]
  },
  {
    type: 'event',
    name: 'Cancelled',
    inputs: [{ name: 'id', type: 'bytes32', indexed: true }]
  },
  {
    type: 'function',
    name: 'isOperationPending',
    inputs: [{ name: 'id', type: 'bytes32' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'isOperationReady',
    inputs: [{ name: 'id', type: 'bytes32' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'isOperationDone',
    inputs: [{ name: 'id', type: 'bytes32' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'getTimestamp',
    inputs: [{ name: 'id', type: 'bytes32' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view'
  }
] as const

export const strategyManagementAbi = [
  {
    type: 'function',
    name: 'add_strategy',
    inputs: [{ name: 'new_strategy', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'update_max_debt_for_strategy',
    inputs: [
      { name: 'strategy', type: 'address' },
      { name: 'new_max_debt', type: 'uint256' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'update_debt',
    inputs: [
      { name: 'strategy', type: 'address' },
      { name: 'target_debt', type: 'uint256' }
    ],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'set_default_queue',
    inputs: [{ name: 'new_default_queue', type: 'address[]' }],
    outputs: [],
    stateMutability: 'nonpayable'
  }
] as const

export const strategyMetadataAbi = [
  { type: 'function', name: 'name', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' },
  { type: 'function', name: 'symbol', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' },
  { type: 'function', name: 'asset', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' }
] as const
