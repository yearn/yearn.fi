// Mapping of staking vault address -> underlying vault address
// Used to estimate cost basis for transfer_in events on staking vaults
// Staking vault shares are 1:1 with underlying vault shares
export const STAKING_TO_UNDERLYING: Record<string, { underlying: string; chainId: number }> = {
  // Ethereum mainnet staking vaults
  '0xb98343536e584cf686427a54574567ba5bda8070': {
    underlying: '0x42842754aBce504E12C20E434Af8960FDf85C833',
    chainId: 1
  },
  '0x6130e6cd924a40b24703407f246966d7435d4998': {
    underlying: '0xbA61BaA1D96c2F4E25205B331306507BcAeA4677',
    chainId: 1
  },
  '0x7fd8af959b54a677a1d8f92265bd0714274c56a3': {
    underlying: '0x790a60024bC3aea28385b60480f15a0771f26D09',
    chainId: 1
  },
  '0x28da6de3e804bddf0ad237cfa6048f2930d0b4dc': {
    underlying: '0xf70B3F1eA3BFc659FFb8b27E84FAE7Ef38b5bD3b',
    chainId: 1
  },
  '0x107717c98c8125a94d3d2cc82b86a1b705f3a27c': {
    underlying: '0x6E9455D109202b426169F0d8f01A3332DAE160f3',
    chainId: 1
  },
  '0x81d93531720d86f0491dee7d03f30b3b5ac24e59': {
    underlying: '0x58900d761Ae3765B75DDFc235c1536B527F25d8F',
    chainId: 1
  },
  '0xd57aea3686d623da2dcebc87010a4f2f38ac7b15': {
    underlying: '0x182863131F9a4630fF9E27830d945B1413e347E8',
    chainId: 1
  },
  '0x622fa41799406b120f9a40da843d358b7b2cfee3': {
    underlying: '0xBe53A109B494E5c9f97b9Cd39Fe969BE68BF6204',
    chainId: 1
  },
  '0x128e72dfd8b00cbf9d12cb75e846ac87b83ddfc9': {
    underlying: '0x028eC7330ff87667b6dfb0D94b954c820195336c',
    chainId: 1
  },
  '0x5943f7090282eb66575662eadf7c60a717a7ce4d': {
    underlying: '0xc56413869c6CDf96496f2b1eF801fEDBdFA7dDB0',
    chainId: 1
  },
  '0xb61f8fff8dd8c438e0d61c07b5536ce3d728f660': {
    underlying: '0x93cF0b02D0A2B61551d107378AFf60CEAe40c342',
    chainId: 1
  },
  '0xf719b2d3925cc445d2bb67fa12963265e224fa11': {
    underlying: '0xFCa9Ab2996e7b010516adCC575eB63de4f4fa47A',
    chainId: 1
  },
  '0x97a597cbca514afcc29cd300f04f98d9dbaa3624': {
    underlying: '0x6A5694C1b37fFA30690b6b60D8Cf89c937d408aD',
    chainId: 1
  },
  '0x38e3d865e34f7367a69f096c80a4fc329db38bf4': {
    underlying: '0x92545bCE636E6eE91D88D2D017182cD0bd2fC22e',
    chainId: 1
  },
  '0x8e2485942b399ea41f3c910c1bb8567128f79859': {
    underlying: '0xAc37729B76db6438CE62042AE1270ee574CA7571',
    chainId: 1
  },
  '0x71c3223d6f836f84caa7ab5a68aab6ece21a9f3b': { underlying: '0xBF319dDC2Edc1Eb6FDf9910E39b37Be221C8805F', chainId: 1 }
}

// Helper to check if an address is a staking vault
export function isStakingVault(address: string): boolean {
  return address.toLowerCase() in STAKING_TO_UNDERLYING
}

// Helper to get underlying vault for a staking vault
export function getUnderlyingVault(stakingAddress: string): { underlying: string; chainId: number } | undefined {
  return STAKING_TO_UNDERLYING[stakingAddress.toLowerCase()]
}
