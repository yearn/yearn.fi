export const vaultBridgeTokenAbi = [
  {
    type: 'function',
    name: 'depositAndBridge',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'assets',
        type: 'uint256'
      },
      {
        name: 'receiver',
        type: 'address'
      },
      {
        name: 'destinationNetworkId',
        type: 'uint32'
      },
      {
        name: 'forceUpdateGlobalExitRoot',
        type: 'bool'
      }
    ],
    outputs: [
      {
        name: 'shares',
        type: 'uint256'
      }
    ]
  }
] as const
