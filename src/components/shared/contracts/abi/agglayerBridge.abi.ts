export const agglayerBridgeAbi = [
  {
    type: 'function',
    name: 'bridgeAsset',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'destinationNetwork',
        type: 'uint32'
      },
      {
        name: 'destinationAddress',
        type: 'address'
      },
      {
        name: 'amount',
        type: 'uint256'
      },
      {
        name: 'token',
        type: 'address'
      },
      {
        name: 'forceUpdateGlobalExitRoot',
        type: 'bool'
      },
      {
        name: 'permitData',
        type: 'bytes'
      }
    ],
    outputs: []
  }
] as const
