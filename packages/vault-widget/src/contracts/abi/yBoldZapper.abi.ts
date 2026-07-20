export const yBoldZapperAbi = [
  {
    inputs: [{ internalType: 'uint256', name: '_assets', type: 'uint256' }],
    name: 'previewDeposit',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'uint256', name: '_assets', type: 'uint256' },
      { internalType: 'address', name: '_receiver', type: 'address' }
    ],
    name: 'zapIn',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'uint256', name: '_shares', type: 'uint256' }],
    name: 'previewRedeem',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'uint256', name: '_shares', type: 'uint256' },
      { internalType: 'address', name: '_receiver', type: 'address' },
      { internalType: 'uint256', name: '_maxLoss', type: 'uint256' }
    ],
    name: 'zapOut',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function'
  }
] as const
