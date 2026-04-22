interface VaultAssetToken {
  chainId: number
  tokenAddress: string
}

const VAULT_ASSET_TOKENS: Record<string, VaultAssetToken> = {
  '0xbe53a109b494e5c9f97b9cd39fe969be68bf6204': {
    chainId: 1,
    tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
  },
  '0x028ec7330ff87667b6dfb0d94b954c820195336c': {
    chainId: 1,
    tokenAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F'
  },
  '0x310b7ea7475a0b449cfd73be81522f1b88efafaa': {
    chainId: 1,
    tokenAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7'
  },
  '0x182863131f9a4630ff9e27830d945b1413e347e8': {
    chainId: 1,
    tokenAddress: '0xdC035D45d973E3EC169d2276DDab16f1e407384F'
  },
  '0xbf319ddc2edc1eb6fdf9910e39b37be221c8805f': {
    chainId: 1,
    tokenAddress: '0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E'
  },
  '0xc56413869c6cdf96496f2b1ef801fedbdfa7ddb0': {
    chainId: 1,
    tokenAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
  },
  '0xac37729b76db6438ce62042ae1270ee574ca7571': {
    chainId: 1,
    tokenAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
  },
  '0x751f0cc6115410a3ee9ec92d08f46ff6da98b708': {
    chainId: 1,
    tokenAddress: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'
  },
  '0xae7d8db82480e6d8e3873ecbf22cf17b3d8a7308': {
    chainId: 1,
    tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
  },
  '0x92545bce636e6ee91d88d2d017182cd0bd2fc22e': {
    chainId: 1,
    tokenAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F'
  },
  '0x9f4330700a36b29952869fac9b33f45eedd8a3d8': {
    chainId: 1,
    tokenAddress: '0x6440f144b7e50d6a8439336510312d2f54beb01d'
  },
  '0x89e93172aef8261db8437b90c3dcb61545a05317': {
    chainId: 1,
    tokenAddress: '0x9cf12ccd6020b6888e4d4c4e4c7aca33c1eb91f8'
  },
  '0x1f6f16945e395593d8050d6cc33e4328a515b648': {
    chainId: 1,
    tokenAddress: '0x22222222aea0076fca927a3f44dc0b4fdf9479d6'
  },
  '0xaf71a4f5d93fb88b24c67760bcf9688a6c3a54d4': {
    chainId: 1,
    tokenAddress: '0x56072c95faa701256059aa122697b133aded9279'
  },
  '0xb13cf163d916917d9cd6e836905ca5f12a1def4b': {
    chainId: 8453,
    tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54BDA02913'
  },
  '0xc3bd0a2193c8f027b82dde3611d18589ef3f62a9': {
    chainId: 8453,
    tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54BDA02913'
  },
  '0x4d81c7d534d703e0a0aecadf668c0e0253e1f1c3': {
    chainId: 8453,
    tokenAddress: '0x4200000000000000000000000000000000000006'
  },
  '0x25f32ec89ce7732a4e9f8f3340a09259f823b7d3': {
    chainId: 8453,
    tokenAddress: '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf'
  },
  '0x989381f7efb45f97e46be9f390a69c5d94bf9e17': {
    chainId: 8453,
    tokenAddress: '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22'
  },
  '0x252b965400862d94bda35fecf7ee0f204a53cc36': {
    chainId: 42161,
    tokenAddress: '0x4ecf61a6c2fab8a047ceb3b3b263b401763e9d49'
  },
  '0x9fa306b1f4a6a83fec98d8ebbabedff78c407f6b': {
    chainId: 42161,
    tokenAddress: '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8'
  },
  '0x6faf8b7ffee3306efcfc2ba9fec912b4d49834c1': {
    chainId: 42161,
    tokenAddress: '0xaf88d065e77c8cc2239327c5edb3a432268e5831'
  },
  '0xc0ba9bfed28ab46da48d2b69316a3838698ef3f5': {
    chainId: 42161,
    tokenAddress: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9'
  },
  '0x7deb119b92b76f78c212bc54fbbb34cea75f4d4a': {
    chainId: 42161,
    tokenAddress: '0x912ce59144191c1204e64559fe8253a0e49e6548'
  },
  '0x34b9421fe3d52191b64bc32ec1ab764dcbcdbf5e': {
    chainId: 137,
    tokenAddress: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359'
  },
  '0xa013fbd4b711f9ded6fb09c1c0d358e2fbc2eaa0': {
    chainId: 137,
    tokenAddress: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174'
  },
  '0xbb287e6017d3deb0e2e65061e8684eab21060123': {
    chainId: 137,
    tokenAddress: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f'
  },
  '0x90b2f54c6addad41b8f6c4fccd555197bc0f773b': {
    chainId: 137,
    tokenAddress: '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063'
  },
  '0x305f25377d0a39091e99b975558b1bdfc3975654': {
    chainId: 137,
    tokenAddress: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619'
  },
  '0x28f53ba70e5c8ce8d03b1fad41e9df11bb646c36': {
    chainId: 137,
    tokenAddress: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270'
  }
}

function _inferVaultTokenSymbol(vaultLabel: string | null): string | null {
  if (!vaultLabel) {
    return null
  }

  const firstToken = vaultLabel.trim().split(/\s+/)[0]
  if (!firstToken) {
    return null
  }

  const symbol = firstToken.replace(/-\d+$/, '')
  return symbol || null
}

export function getVaultAssetToken(vaultAddress: string): VaultAssetToken | null {
  return VAULT_ASSET_TOKENS[vaultAddress.toLowerCase()] ?? null
}

export function getChainLogoUrl(chainId: number): string {
  return `https://token-assets-one.vercel.app/api/chains/${chainId}/logo-32.png?fallback=true`
}

export function getTokenLogoUrl(chainId: number, tokenAddress: string): string {
  return `https://token-assets-one.vercel.app/api/tokens/${chainId}/${tokenAddress.toLowerCase()}/logo-32.png?fallback=true`
}

const VAULT_DECIMALS: Record<string, number> = {
  '0xbe53a109b494e5c9f97b9cd39fe969be68bf6204': 6,
  '0xae7d8db82480e6d8e3873ecbf22cf17b3d8a7308': 6,
  '0xb13cf163d916917d9cd6e836905ca5f12a1def4b': 6,
  '0xc3bd0a2193c8f027b82dde3611d18589ef3f62a9': 6,
  '0x9fa306b1f4a6a83fec98d8ebbabedff78c407f6b': 6,
  '0x6faf8b7ffee3306efcfc2ba9fec912b4d49834c1': 6,
  '0x34b9421fe3d52191b64bc32ec1ab764dcbcdbf5e': 6,
  '0xa013fbd4b711f9ded6fb09c1c0d358e2fbc2eaa0': 6,
  '0x7b5a0182e400b241b317e781a4e9dedfc1429822': 6,
  '0xf470eb50b4a60c9b069f7fd6032532b8f5cc014d': 6,
  '0x074134a2784f4f66b6ced6f68849382990ff3215': 6,
  '0x0e297de4005883c757c9f09fdf7cf1363c20e626': 6,
  '0x694e47afd14a64661a04eee674fb331bcdef3737': 6,
  '0x00c8a649c9837523ebb406ceb17a6378ab5c74cf': 6,
  '0xb739ae19620f7ecb4fb84727f205453aa5bc1ad2': 6,
  '0xd811a47cfd17355f47ac49be02c4744a926dd16b': 6,
  '0x5bfd56f9bcbdb2be985c64c620eca7f02fa7b439': 6,
  '0x80c34bd3a3569e126e7055831036aa7b212cb159': 6,
  '0x310b7ea7475a0b449cfd73be81522f1b88efafaa': 6,
  '0xc0ba9bfed28ab46da48d2b69316a3838698ef3f5': 6,
  '0xbb287e6017d3deb0e2e65061e8684eab21060123': 6,
  '0x48c03b6ffd0008460f8657db1037c7e09deedfcb': 6,
  '0xa5dab32dbe68e6fa784e1e50e4f620a0477d3896': 6,
  '0x4bd05e6ff75b633f504f0fc501c1e257578c8a72': 6,
  '0xe30461f1270ba52d45df1e773aefe594c7e430dc': 6,
  '0x9a6bd7b6fd5c4f87eb66356441502fc7dcdd185b': 6,
  '0x751f0cc6115410a3ee9ec92d08f46ff6da98b708': 8,
  '0x25f32ec89ce7732a4e9f8f3340a09259f823b7d3': 8,
  '0x92c82f5f771f6a44cfa09357dd0575b81bf5f728': 8,
  '0xe1ac97e2616ad80f69f705ff007a4bbb3655544a': 8,
  '0xaa0362ecc584b985056e47812931270b99c91f9d': 8
}

export function getVaultDecimals(vaultAddress: string): number {
  return VAULT_DECIMALS[vaultAddress.toLowerCase()] ?? 18
}

const SYMBOL_TOKEN_BY_CHAIN: Record<number, Record<string, string>> = {
  1: {
    usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    dai: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    usdt: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    usds: '0xdC035D45d973E3EC169d2276DDab16f1e407384F',
    crvusd: '0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E',
    weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    wbtc: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    sky: '0x56072c95faa701256059aa122697b133aded9279',
    ybold: '0x6440f144b7e50d6a8439336510312d2f54beb01d',
    susdaf: '0x9cf12ccd6020b6888e4d4c4e4c7aca33c1eb91f8',
    yyb: '0x22222222aea0076fca927a3f44dc0b4fdf9479d6'
  },
  8453: {
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54BDA02913',
    weth: '0x4200000000000000000000000000000000000006',
    cbbtc: '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf',
    cbeth: '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22'
  },
  42161: {
    usnd: '0x4ecf61a6c2fab8a047ceb3b3b263b401763e9d49',
    usdc: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
    'usdc.e': '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8',
    usdt: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9',
    arb: '0x912ce59144191c1204e64559fe8253a0e49e6548'
  },
  137: {
    usdc: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
    'usdc.e': '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
    usdt: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
    dai: '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063',
    weth: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619',
    wmatic: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
    matic: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270'
  }
}

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toLowerCase()
}

export function getTokenAddressForSymbol(chainId: number, tokenSymbol: string): string | null {
  return SYMBOL_TOKEN_BY_CHAIN[chainId]?.[normalizeSymbol(tokenSymbol)] ?? null
}
