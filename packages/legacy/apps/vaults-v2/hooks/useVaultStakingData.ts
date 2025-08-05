import { useWeb3 } from '@lib/contexts/useWeb3'
import { useAsyncTrigger } from '@lib/hooks/useAsyncTrigger'
import type { TAddress, TNormalizedBN } from '@lib/types'
import {
	decodeAsAddress,
	decodeAsBigInt,
	decodeAsNumber,
	decodeAsString,
	isZeroAddress,
	toAddress,
	toBigInt,
	toNormalizedBN,
	zeroNormalizedBN
} from '@lib/utils'
import { DISABLED_VEYFI_GAUGES_VAULTS_LIST } from '@lib/utils/constants'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { retrieveConfig } from '@lib/utils/wagmi'
import { JUICED_STAKING_REWARDS_ABI } from '@vaults-v2/utils/abi/juicedStakingRewards.abi'
import { STAKING_REWARDS_ABI } from '@vaults-v2/utils/abi/stakingRewards.abi'
import { V3_STAKING_REWARDS_ABI } from '@vaults-v2/utils/abi/V3StakingRewards.abi'
import { VEYFI_GAUGE_ABI } from '@vaults-v2/utils/abi/veYFIGauge.abi'
import { TOKENIZED_STRATEGY_ABI } from '@vaults-v3/utils/abi/tokenizedStrategy.abi'
import { useEffect, useState } from 'react'
import { erc20Abi, zeroAddress } from 'viem'
import { useBlockNumber } from 'wagmi'
import { readContract, readContracts } from 'wagmi/actions'

export type TStakingInfo = {
	address: TAddress
	stakingToken: TAddress
	stakedGaugeSymbol: string
	rewardsToken: TAddress
	rewardDecimals: number | undefined
	stakingDecimals: number | undefined
	totalStaked: TNormalizedBN
	stakedBalanceOf: TNormalizedBN
	stakedEarned: TNormalizedBN
	vaultAllowance: TNormalizedBN
	vaultBalanceOf: TNormalizedBN
}
export function useVaultStakingData(props: { currentVault: TYDaemonVault }): {
	vaultData: TStakingInfo
	updateVaultData: VoidFunction
} {
	const { address } = useWeb3()
	const { data: blockNumber } = useBlockNumber({ watch: true })

	/**************************************************************************************************
	 ** Check if the current vault is in the list of disabled veYFI gauges. If it is, we should make
	 ** it possible to withdraw the rewards and display a corresponding message to the user.
	 *************************************************************************************************/
	const foundVaultWithDisabledStaking = DISABLED_VEYFI_GAUGES_VAULTS_LIST.find(
		vault => vault.address === props.currentVault.address
	)?.staking

	const stakingType = props.currentVault.staking.source as 'OP Boost' | 'VeYFI' | 'Juiced' | 'V3 Staking' | 'yBOLD'
	const [vaultData, setVaultData] = useState<TStakingInfo>({
		address: isZeroAddress(props.currentVault.staking.address)
			? props.currentVault.staking.address
			: toAddress(foundVaultWithDisabledStaking),
		stakingToken: toAddress(''),
		rewardsToken: toAddress(''),
		stakedGaugeSymbol: '',
		rewardDecimals: undefined,
		stakingDecimals: undefined,
		totalStaked: zeroNormalizedBN,
		stakedBalanceOf: zeroNormalizedBN,
		stakedEarned: zeroNormalizedBN,
		vaultAllowance: zeroNormalizedBN,
		vaultBalanceOf: zeroNormalizedBN
	})

	/**********************************************************************************************
	 ** The refetch function is a trigger that will be called whenever the user wants to refresh
	 ** the data. It will fetch the most up-to-date data from the blockchain and update the state.
	 *********************************************************************************************/
	const refetch = useAsyncTrigger(async () => {
		if (!props.currentVault.staking.available && !foundVaultWithDisabledStaking) {
			return
		}

		const stakingAddress = foundVaultWithDisabledStaking
			? toAddress(foundVaultWithDisabledStaking || zeroAddress)
			: toAddress(props.currentVault.staking.address)

		let stakingToken: TAddress = zeroAddress
		let rewardsToken: TAddress = zeroAddress
		let totalStaked = 0n
		let balanceOf = 0n
		let earned = 0n
		let allowance = 0n
		let vaultBalanceOf = 0n
		let stakedGaugeSymbol = ''
		/******************************************************************************************
		 ** To have the most up-to-date data, we fetch a few informations directly onChain, such as:
		 ** - the staking token
		 ** - the staking token symbol
		 ** - the rewards token
		 ** - the total staked amount in the staking contract
		 ** - the user's balance in the staking contract
		 ** - the user's earned amount in the staking contract
		 ** - the user's allowance for the vault token to be spent by the staking contract
		 ** - the user's balance in the vault contract
		 ******************************************************************************************/
		if (stakingType === 'OP Boost' || stakingType === 'VeYFI' || foundVaultWithDisabledStaking) {
			const contracts = [
				{
					key: 'stakingToken',
					address: toAddress(stakingAddress),
					chainId: props.currentVault.chainID,
					abi: stakingType === 'OP Boost' ? STAKING_REWARDS_ABI : VEYFI_GAUGE_ABI,
					functionName: stakingType === 'OP Boost' ? 'stakingToken' : 'asset'
				},
				{
					key: 'rewardsToken',
					address: toAddress(stakingAddress),
					chainId: props.currentVault.chainID,
					abi: stakingType === 'OP Boost' ? STAKING_REWARDS_ABI : VEYFI_GAUGE_ABI,
					functionName: stakingType === 'OP Boost' ? 'rewardsToken' : 'REWARD_TOKEN'
				},
				{
					key: 'stakedGaugeSymbol',
					address: toAddress(stakingAddress),
					chainId: props.currentVault.chainID,
					abi: VEYFI_GAUGE_ABI,
					functionName: 'symbol'
				},
				{
					key: 'totalStaked',
					address: toAddress(stakingAddress),
					abi: STAKING_REWARDS_ABI,
					chainId: props.currentVault.chainID,
					functionName: 'totalSupply'
				},
				{
					key: 'balanceOf',
					address: toAddress(stakingAddress),
					abi: STAKING_REWARDS_ABI,
					chainId: props.currentVault.chainID,
					functionName: 'balanceOf',
					args: [toAddress(address)]
				},
				{
					key: 'earned',
					address: toAddress(stakingAddress),
					abi: STAKING_REWARDS_ABI,
					chainId: props.currentVault.chainID,
					functionName: 'earned',
					args: [toAddress(address)]
				},
				{
					key: 'allowance',
					address: toAddress(props.currentVault.address),
					abi: erc20Abi,
					chainId: props.currentVault.chainID,
					functionName: 'allowance',
					args: [toAddress(address), toAddress(stakingAddress)]
				},
				{
					key: 'vaultBalanceOf',
					address: toAddress(props.currentVault.address),
					abi: erc20Abi,
					chainId: props.currentVault.chainID,
					functionName: 'balanceOf',
					args: [toAddress(address)]
				}
			]

			const calls = contracts.map(({ key: _key, ...rest }) => rest) as Parameters<
				typeof readContracts
			>[1]['contracts']

			const data = await readContracts(retrieveConfig(), {
				contracts: calls
			})

			// Map results to keys
			const resultMap = contracts.reduce(
				(acc, contract, idx) => {
					acc[contract.key] = data[idx]
					return acc
				},
				{} as {
					[key: string]:
						| { error: Error; result?: undefined; status: 'failure' }
						| { error?: undefined; result: unknown; status: 'success' }
				}
			)

			stakingToken = decodeAsAddress(resultMap.stakingToken)
			rewardsToken = decodeAsAddress(resultMap.rewardsToken)
			stakedGaugeSymbol = decodeAsString(resultMap.stakedGaugeSymbol)
			totalStaked = decodeAsBigInt(resultMap.totalStaked)
			balanceOf = isZeroAddress(address) ? 0n : decodeAsBigInt(resultMap.balanceOf)
			earned = isZeroAddress(address) ? 0n : decodeAsBigInt(resultMap.earned)
			allowance = isZeroAddress(address) ? 0n : decodeAsBigInt(resultMap.allowance)
			vaultBalanceOf = isZeroAddress(address) ? 0n : decodeAsBigInt(resultMap.vaultBalanceOf)
		} else if (stakingType === 'Juiced') {
			const data = await readContracts(retrieveConfig(), {
				contracts: [
					{
						address: toAddress(props.currentVault.staking.address),
						chainId: props.currentVault.chainID,
						abi: JUICED_STAKING_REWARDS_ABI,
						functionName: 'stakingToken'
					},
					{
						address: toAddress(props.currentVault.staking.address),
						chainId: props.currentVault.chainID,
						abi: JUICED_STAKING_REWARDS_ABI,
						functionName: 'rewardTokens',
						args: [0n]
					},

					{
						address: toAddress(props.currentVault.staking.address),
						abi: JUICED_STAKING_REWARDS_ABI,
						chainId: props.currentVault.chainID,
						functionName: 'totalSupply'
					},
					{
						address: toAddress(props.currentVault.staking.address),
						abi: JUICED_STAKING_REWARDS_ABI,
						chainId: props.currentVault.chainID,
						functionName: 'balanceOf',
						args: [toAddress(address)]
					},
					{
						address: toAddress(props.currentVault.address),
						abi: erc20Abi,
						chainId: props.currentVault.chainID,
						functionName: 'allowance',
						args: [toAddress(address), toAddress(props.currentVault.staking.address)]
					},
					{
						address: toAddress(props.currentVault.address),
						abi: erc20Abi,
						chainId: props.currentVault.chainID,
						functionName: 'balanceOf',
						args: [toAddress(address)]
					}
				]
			})
			stakingToken = decodeAsAddress(data[0])
			rewardsToken = decodeAsAddress(data[1])
			totalStaked = decodeAsBigInt(data[2])
			balanceOf = isZeroAddress(address) ? 0n : decodeAsBigInt(data[3])
			allowance = isZeroAddress(address) ? 0n : decodeAsBigInt(data[4])
			vaultBalanceOf = isZeroAddress(address) ? 0n : decodeAsBigInt(data[5])

			const earnedRaw = await readContract(retrieveConfig(), {
				address: toAddress(props.currentVault.staking.address),
				abi: JUICED_STAKING_REWARDS_ABI,
				chainId: props.currentVault.chainID,
				functionName: 'earned',
				args: [toAddress(address), rewardsToken]
			})
			earned = isZeroAddress(address) ? 0n : earnedRaw
		} else if (stakingType === 'V3 Staking') {
			const rewardTokensLength = await readContract(retrieveConfig(), {
				address: toAddress(props.currentVault.staking.address),
				chainId: props.currentVault.chainID,
				abi: V3_STAKING_REWARDS_ABI,
				functionName: 'rewardTokensLength'
			})

			const rewardTokensCalls: Parameters<typeof readContracts>[1]['contracts'][number][] = []
			for (let i = 0; i < Number(rewardTokensLength); i++) {
				rewardTokensCalls.push({
					address: toAddress(props.currentVault.staking.address),
					chainId: props.currentVault.chainID,
					abi: V3_STAKING_REWARDS_ABI,
					functionName: 'rewardTokens',
					args: [toBigInt(i)]
				})
			}
			const data = await readContracts(retrieveConfig(), {
				contracts: [
					{
						address: toAddress(props.currentVault.staking.address),
						chainId: props.currentVault.chainID,
						abi: V3_STAKING_REWARDS_ABI,
						functionName: 'stakingToken'
					},
					{
						address: toAddress(props.currentVault.staking.address),
						abi: V3_STAKING_REWARDS_ABI,
						chainId: props.currentVault.chainID,
						functionName: 'totalSupply'
					},
					{
						address: toAddress(props.currentVault.staking.address),
						abi: V3_STAKING_REWARDS_ABI,
						chainId: props.currentVault.chainID,
						functionName: 'symbol'
					},
					{
						address: toAddress(props.currentVault.staking.address),
						abi: V3_STAKING_REWARDS_ABI,
						chainId: props.currentVault.chainID,
						functionName: 'balanceOf',
						args: [toAddress(address)]
					},
					{
						address: toAddress(props.currentVault.address),
						abi: erc20Abi,
						chainId: props.currentVault.chainID,
						functionName: 'allowance',
						args: [toAddress(address), toAddress(props.currentVault.staking.address)]
					},
					{
						address: toAddress(props.currentVault.address),
						abi: erc20Abi,
						chainId: props.currentVault.chainID,
						functionName: 'balanceOf',
						args: [toAddress(address)]
					},
					...rewardTokensCalls
				]
			})
			stakingToken = decodeAsAddress(data[0])
			totalStaked = decodeAsBigInt(data[1])
			stakedGaugeSymbol = decodeAsString(data[2])
			balanceOf = isZeroAddress(address) ? 0n : decodeAsBigInt(data[3])
			allowance = isZeroAddress(address) ? 0n : decodeAsBigInt(data[4])
			vaultBalanceOf = isZeroAddress(address) ? 0n : decodeAsBigInt(data[5])
			rewardsToken = decodeAsAddress(data[6])

			const earnedRaw = await readContract(retrieveConfig(), {
				address: toAddress(props.currentVault.staking.address),
				abi: V3_STAKING_REWARDS_ABI,
				chainId: props.currentVault.chainID,
				functionName: 'earned',
				args: [toAddress(address), rewardsToken]
			})
			earned = isZeroAddress(address) ? 0n : earnedRaw
		} else if (stakingType === 'yBOLD') {
			const data = await readContracts(retrieveConfig(), {
				contracts: [
					{
						address: toAddress(props.currentVault.staking.address),
						chainId: props.currentVault.chainID,
						abi: TOKENIZED_STRATEGY_ABI,
						functionName: 'asset'
					},
					{
						address: toAddress(props.currentVault.staking.address),
						abi: TOKENIZED_STRATEGY_ABI,
						chainId: props.currentVault.chainID,
						functionName: 'totalSupply'
					},
					{
						address: toAddress(props.currentVault.staking.address),
						abi: TOKENIZED_STRATEGY_ABI,
						chainId: props.currentVault.chainID,
						functionName: 'balanceOf',
						args: [toAddress(address)]
					},
					{
						address: toAddress(props.currentVault.address),
						abi: erc20Abi,
						chainId: props.currentVault.chainID,
						functionName: 'allowance',
						args: [toAddress(address), toAddress(props.currentVault.staking.address)]
					},
					{
						address: toAddress(props.currentVault.address),
						abi: erc20Abi,
						chainId: props.currentVault.chainID,
						functionName: 'balanceOf',
						args: [toAddress(address)]
					}
				]
			})
			stakingToken = decodeAsAddress(data[0])
			rewardsToken = zeroAddress // yBOLD does not have a rewards token
			totalStaked = decodeAsBigInt(data[1])
			balanceOf = isZeroAddress(address) ? 0n : decodeAsBigInt(data[2])
			allowance = isZeroAddress(address) ? 0n : decodeAsBigInt(data[3])
			vaultBalanceOf = isZeroAddress(address) ? 0n : decodeAsBigInt(data[4])
			earned = 0n
		}

		/******************************************************************************************
		 ** Some extra elements are required at this point to be able to display a comprehensive
		 ** view of the user's holdings in the vault: we need to know what is the reward token. This
		 ** means we need to retrieve the token's symbol and decimals.
		 ******************************************************************************************/
		let decimalsResult: Array<
			| { error: Error; result?: undefined; status: 'failure' }
			| { error?: undefined; result: unknown; status: 'success' }
		>
		let rewardDecimals: number
		let stakingDecimals: number
		if (stakingType === 'yBOLD') {
			decimalsResult = await readContracts(retrieveConfig(), {
				contracts: [
					{
						address: stakingToken,
						abi: erc20Abi,
						chainId: props.currentVault.chainID,
						functionName: 'decimals'
					}
				]
			})
			rewardDecimals = 18
			stakingDecimals = decodeAsNumber(decimalsResult[0])
		} else {
			decimalsResult = await readContracts(retrieveConfig(), {
				contracts: [
					{
						address: rewardsToken,
						abi: erc20Abi,
						chainId: props.currentVault.chainID,
						functionName: 'decimals'
					},
					{
						address: stakingToken,
						abi: erc20Abi,
						chainId: props.currentVault.chainID,
						functionName: 'decimals'
					}
				]
			})
			rewardDecimals = decodeAsNumber(decimalsResult[0])
			stakingDecimals = decodeAsNumber(decimalsResult[1])
		}

		setVaultData({
			address: toAddress(stakingAddress),
			stakingToken,
			rewardsToken,
			rewardDecimals,
			stakingDecimals,
			stakedGaugeSymbol,
			totalStaked: toNormalizedBN(totalStaked, stakingDecimals),
			stakedBalanceOf: toNormalizedBN(balanceOf, stakingDecimals),
			stakedEarned: toNormalizedBN(earned, rewardDecimals),
			vaultAllowance: toNormalizedBN(allowance, props.currentVault.decimals),
			vaultBalanceOf: toNormalizedBN(vaultBalanceOf, props.currentVault.decimals)
		})
	}, [
		address,
		foundVaultWithDisabledStaking,
		props.currentVault.address,
		props.currentVault.chainID,
		props.currentVault.decimals,
		props.currentVault.staking.address,
		props.currentVault.staking.available,
		stakingType
	])

	// biome-ignore lint/correctness/useExhaustiveDependencies: fetch data on block number change
	useEffect(() => {
		refetch()
	}, [blockNumber, refetch])

	return {
		vaultData,
		updateVaultData: refetch
	}
}
