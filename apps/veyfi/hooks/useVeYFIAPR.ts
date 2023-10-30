import {useMemo, useState} from 'react';
import {useContractRead} from 'wagmi';
import {VEYFI_ABI} from '@veYFI/utils/abi/veYFI.abi';
import {VEYFI_GAUGE_ABI} from '@veYFI/utils/abi/veYFIGauge.abi';
import {SECONDS_PER_YEAR, VE_YFI_GAUGES, VEYFI_CHAIN_ID} from '@veYFI/utils/constants';
import {readContracts} from '@wagmi/core';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {VEYFI_ADDRESS, YFI_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {decodeAsBigInt} from '@yearn-finance/web-lib/utils/decoder';
import {toBigInt, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {getClient} from '@yearn-finance/web-lib/utils/wagmi/utils';
import {useAsyncTrigger} from '@common/hooks/useAsyncEffect';
import {useTokenPrice} from '@common/hooks/useTokenPrice';

import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TNormalizedBN} from '@common/types/types';

type TUseVeYFIAPR = {
	dYFIPrice: number;
};
function useVeYFIAPR({dYFIPrice}: TUseVeYFIAPR): number {
	const [rate, set_rate] = useState<bigint>(0n);
	const yfiPrice = useTokenPrice(YFI_ADDRESS);
	const {data: veYFISupply} = useContractRead({
		address: VEYFI_ADDRESS,
		abi: VEYFI_ABI,
		functionName: 'totalSupply',
		chainId: VEYFI_CHAIN_ID
	});

	useAsyncTrigger(async (): Promise<void> => {
		const publicClient = getClient(VEYFI_CHAIN_ID);
		const rangeLimit = toBigInt(process.env.RANGE_LIMIT);
		const currentBlockNumber = await publicClient.getBlockNumber();
		const from = 18373500n;

		const depositors: [{address: TAddress; gauge: TAddress; balance: TNormalizedBN}] = [] as any;
		/* 🔵 - Yearn Finance **********************************************************************
		 ** First we need to retrieve all the depositors in a gauge
		 ******************************************************************************************/
		for (let i = from; i < currentBlockNumber; i += rangeLimit) {
			const logs = await publicClient.getLogs({
				address: VE_YFI_GAUGES,
				events: [
					{
						anonymous: false,
						inputs: [
							{indexed: true, internalType: 'address', name: 'caller', type: 'address'},
							{indexed: true, internalType: 'address', name: 'owner', type: 'address'},
							{indexed: false, internalType: 'uint256', name: 'assets', type: 'uint256'},
							{indexed: false, internalType: 'uint256', name: 'shares', type: 'uint256'}
						],
						name: 'Deposit',
						type: 'event'
					}
				],
				fromBlock: i,
				toBlock: i + rangeLimit
			});
			for (const log of logs) {
				depositors.push({address: toAddress(log.args.owner), gauge: log.address, balance: toNormalizedBN(0)});
			}
		}

		/* 🔵 - Yearn Finance **********************************************************************
		 ** Then, for each one of theses depositors, we need to check the current boostedBalance.
		 ******************************************************************************************/
		const allDepositorsBalances = await readContracts({
			contracts: depositors.map(({gauge, address}): any => ({
				address: gauge,
				abi: VEYFI_GAUGE_ABI,
				chainId: VEYFI_CHAIN_ID,
				functionName: 'boostedBalanceOf',
				args: [address]
			}))
		});
		for (let i = 0; i < depositors.length; i++) {
			depositors[i].balance = toNormalizedBN(decodeAsBigInt(allDepositorsBalances[i]), 18);
		}

		// Remove duplicates (on address and gauge)
		const seen = new Set();
		const depositorsWithoutDuplicates = depositors.filter((depositor): boolean => {
			const isDuplicate = seen.has(depositor.address + depositor.gauge);
			seen.add(depositor.address + depositor.gauge);
			return !isDuplicate;
		});

		// remove depositors with 0 balance
		const depositorsWithBalance = depositorsWithoutDuplicates.filter(
			(depositor): boolean => depositor.balance.raw > 0n
		);

		/* 🔵 - Yearn Finance **********************************************************************
		 ** Then, for each gauge we need to know the totalSupply and the rewardRate
		 ******************************************************************************************/
		const calls = [];
		for (const gauge of VE_YFI_GAUGES) {
			calls.push({address: gauge, abi: VEYFI_GAUGE_ABI, chainId: VEYFI_CHAIN_ID, functionName: 'totalSupply'});
			calls.push({address: gauge, abi: VEYFI_GAUGE_ABI, chainId: VEYFI_CHAIN_ID, functionName: 'rewardRate'});
		}
		const totalSupplyAndRewardRate = await readContracts({
			contracts: calls
		});

		/* 🔵 - Yearn Finance **********************************************************************
		 ** Then we can calculate the rate for each gauge
		 ******************************************************************************************/
		let rate = 0n;
		let index = 0;
		for (const gauge of VE_YFI_GAUGES) {
			const supply = decodeAsBigInt(totalSupplyAndRewardRate[index++]);
			const rewardRate = decodeAsBigInt(totalSupplyAndRewardRate[index++]);
			let boosted = 0n;
			for (const depositor of depositorsWithBalance) {
				if (toAddress(depositor.gauge) === toAddress(gauge)) {
					boosted += depositor.balance.raw;
				}
			}
			rate += (rewardRate * (supply - boosted)) / supply;
		}
		set_rate(rate);
	}, []);

	const APR = useMemo((): number => {
		return (
			(Number(toNormalizedBN(rate).normalized) * SECONDS_PER_YEAR * dYFIPrice) /
			Number(toNormalizedBN(toBigInt(veYFISupply)).normalized) /
			yfiPrice
		);
	}, [rate, dYFIPrice, yfiPrice, veYFISupply]);

	return APR;
}

export {useVeYFIAPR};
