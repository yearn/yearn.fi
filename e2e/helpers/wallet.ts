import { createPublicClient, http, parseUnits, formatUnits, type Address } from 'viem'
import { polygon } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.e2e' })

const ERC20_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const

export function getWalletAddress(): Address {
  const privateKey = process.env.E2E_PRIVATE_KEY
  if (!privateKey) {
    throw new Error('E2E_PRIVATE_KEY not set')
  }
  const account = privateKeyToAccount(privateKey as Address)
  return account.address
}

export async function checkBalance(requirements: {
  minMatic?: number
  minUSDC?: number
  minDAI?: number
}) {
  const client = createPublicClient({
    chain: polygon,
    transport: http()
  })

  const address = getWalletAddress()

  // Check MATIC balance
  if (requirements.minMatic) {
    const balance = await client.getBalance({ address })
    const minRequired = parseUnits(requirements.minMatic.toString(), 18)

    if (balance < minRequired) {
      throw new Error(
        `Insufficient MATIC balance.\n` +
        `Current: ${formatUnits(balance, 18)} MATIC\n` +
        `Required: ${requirements.minMatic} MATIC\n` +
        `Please fund wallet: ${address}`
      )
    }
  }

  // Check USDC balance
  if (requirements.minUSDC) {
    const usdcAddress = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' as Address
    const balance = await client.readContract({
      address: usdcAddress,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [address]
    })
    const minRequired = parseUnits(requirements.minUSDC.toString(), 6) // USDC has 6 decimals

    if (balance < minRequired) {
      throw new Error(
        `Insufficient USDC balance.\n` +
        `Current: ${formatUnits(balance, 6)} USDC\n` +
        `Required: ${requirements.minUSDC} USDC\n` +
        `Please fund wallet: ${address}`
      )
    }
  }

  // Check DAI balance
  if (requirements.minDAI) {
    const daiAddress = '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063' as Address
    const balance = await client.readContract({
      address: daiAddress,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [address]
    })
    const minRequired = parseUnits(requirements.minDAI.toString(), 18)

    if (balance < minRequired) {
      throw new Error(
        `Insufficient DAI balance.\n` +
        `Current: ${formatUnits(balance, 18)} DAI\n` +
        `Required: ${requirements.minDAI} DAI\n` +
        `Please fund wallet: ${address}`
      )
    }
  }
}

export async function logBalances() {
  const client = createPublicClient({
    chain: polygon,
    transport: http()
  })

  const address = getWalletAddress()

  const maticBalance = await client.getBalance({ address })

  const usdcAddress = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' as Address
  const usdcBalance = await client.readContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address]
  })

  const daiAddress = '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063' as Address
  const daiBalance = await client.readContract({
    address: daiAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address]
  })

  console.log('\n=== Test Wallet Balances ===')
  console.log(`Address: ${address}`)
  console.log(`MATIC: ${formatUnits(maticBalance, 18)}`)
  console.log(`USDC: ${formatUnits(usdcBalance, 6)}`)
  console.log(`DAI: ${formatUnits(daiBalance, 18)}`)
  console.log('===========================\n')
}
