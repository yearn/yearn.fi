export const yvUsdLockedZapAbi = [
  {
    inputs: [{ internalType: 'address', name: '_lockedYvUSD', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'constructor'
  },
  {
    inputs: [{ internalType: 'address', name: 'token', type: 'address' }],
    name: 'SafeERC20FailedOperation',
    type: 'error'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'user', type: 'address' },
      { indexed: true, internalType: 'uint256', name: 'assetAmount', type: 'uint256' },
      { indexed: true, internalType: 'uint256', name: 'lockedShares', type: 'uint256' }
    ],
    name: 'ZapIn',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'user', type: 'address' },
      { indexed: true, internalType: 'uint256', name: 'lockedShares', type: 'uint256' },
      { indexed: true, internalType: 'uint256', name: 'assetAmount', type: 'uint256' }
    ],
    name: 'ZapOut',
    type: 'event'
  },
  {
    inputs: [],
    name: 'asset',
    outputs: [{ internalType: 'contract IERC20', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'lockedYvUSD',
    outputs: [{ internalType: 'contract IERC4626', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'uint256', name: '_amount', type: 'uint256' }],
    name: 'previewZapIn',
    outputs: [{ internalType: 'uint256', name: 'lockedShares', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'uint256', name: '_shares', type: 'uint256' }],
    name: 'previewZapOut',
    outputs: [{ internalType: 'uint256', name: 'assetAmount', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'yvUSD',
    outputs: [{ internalType: 'contract IERC4626', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'uint256', name: '_amount', type: 'uint256' },
      { internalType: 'address', name: '_receiver', type: 'address' }
    ],
    name: 'zapIn',
    outputs: [{ internalType: 'uint256', name: 'lockedShares', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'uint256', name: '_amount', type: 'uint256' }],
    name: 'zapIn',
    outputs: [{ internalType: 'uint256', name: 'lockedShares', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'uint256', name: '_shares', type: 'uint256' },
      { internalType: 'address', name: '_receiver', type: 'address' }
    ],
    name: 'zapOut',
    outputs: [{ internalType: 'uint256', name: 'assetAmount', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'uint256', name: '_shares', type: 'uint256' },
      { internalType: 'address', name: '_receiver', type: 'address' },
      { internalType: 'uint256', name: '_minAssetAmount', type: 'uint256' }
    ],
    name: 'zapOut',
    outputs: [{ internalType: 'uint256', name: 'assetAmount', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'uint256', name: '_shares', type: 'uint256' }],
    name: 'zapOut',
    outputs: [{ internalType: 'uint256', name: 'assetAmount', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function'
  }
] as const
