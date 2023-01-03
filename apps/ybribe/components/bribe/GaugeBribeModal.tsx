import React, {useCallback, useState} from 'react';
import {Contract} from 'ethcall';
import {ethers} from 'ethers';
import useSWR from 'swr';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {ERC20_ABI} from '@yearn-finance/web-lib/utils/abi';
import {isZeroAddress, toAddress} from '@yearn-finance/web-lib/utils/address';
import {CURVE_BRIBE_V3_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {formatToNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatCounterValue} from '@yearn-finance/web-lib/utils/format.value';
import {getProvider, newEthCallProvider} from '@yearn-finance/web-lib/utils/web3/providers';
import {defaultTxStatus, Transaction} from '@yearn-finance/web-lib/utils/web3/transaction';
import {useYearn} from '@common/contexts/useYearn';
import {handleInputChange} from '@common/utils';
import {approveERC20} from '@common/utils/actions/approveToken';
import {useBribes} from '@yBribe/contexts/useBribes';
import {addReward} from '@yBribe/utils/actions/addReward';

import type {BigNumber} from 'ethers';
import type {ChangeEvent, ReactElement} from 'react';
import type {TCurveGauges} from '@common/types/curves';
import type {TNormalizedBN} from '@common/types/types';


function	GaugeBribeModal({currentGauge, onClose}: {currentGauge: TCurveGauges, onClose: VoidFunction}): ReactElement {
	const {chainID, safeChainID} = useChainID();
	const {address, provider, isActive, openLoginModal, onSwitchChain} = useWeb3();
	const {refresh} = useBribes();
	const {prices} = useYearn();
	const [amount, set_amount] = useState<TNormalizedBN>({raw: ethers.constants.Zero, normalized: 0});
	const [tokenAddress, set_tokenAddress] = useState<string>('');
	const [txStatusApprove, set_txStatusApprove] = useState(defaultTxStatus);
	const [txStatusAddReward, set_txStatusAddReward] = useState(defaultTxStatus);

	const expectedOutFetcher = useCallback(async (args: [string]): Promise<{
		name: string;
		symbol: string;
		decimals: number;
		normalized: number,
		raw: BigNumber,
		allowance: BigNumber,
	}> => {
		const	[_tokenAddress] = args;
		const	currentProvider = safeChainID === 1 ? provider || getProvider(1) : getProvider(1);
		const	ethcallProvider = await newEthCallProvider(currentProvider);
		const	erc20Contract = new Contract(_tokenAddress, ERC20_ABI);

		const	[name, symbol, decimals, balance, allowance] = await ethcallProvider.tryAll([
			erc20Contract.name(),
			erc20Contract.symbol(),
			erc20Contract.decimals(),
			erc20Contract.balanceOf(address),
			erc20Contract.allowance(address, CURVE_BRIBE_V3_ADDRESS)
		]) as [string, string, number, BigNumber, BigNumber];

		return ({
			name,
			symbol,
			decimals,
			raw: balance,
			normalized: formatToNormalizedValue(balance, decimals),
			allowance
		});
	}, [safeChainID, provider, address]);

	/* 🔵 - Yearn Finance ******************************************************
	** SWR hook to get the expected out for a given in/out pair with a specific
	** amount. This hook is called every 10s or when amount/in or out changes.
	** Calls the expectedOutFetcher callback.
	**************************************************************************/
	const	{data: selectedToken, mutate} = useSWR(
		isActive && !isZeroAddress(tokenAddress) ? [toAddress(tokenAddress)] : null, expectedOutFetcher,
		{refreshInterval: 10000, shouldRetryOnError: false}
	);

	async function	onApproveFrom(): Promise<void> {
		new Transaction(provider, approveERC20, set_txStatusApprove).populate(
			tokenAddress,
			CURVE_BRIBE_V3_ADDRESS,
			amount.raw
		).onSuccess(async (): Promise<void> => {
			mutate();
		}).perform();
	}
	
	function	onAddReward(): void {
		new Transaction(provider, addReward, set_txStatusAddReward).populate(
			currentGauge.gauge,
			tokenAddress,
			amount.raw
		).onSuccess(async (): Promise<void> => {
			onClose();
			mutate();
			await refresh();
		}).perform();
	}

	function renderButton(): ReactElement {
		if (!isActive) {
			return (
				<Button
					onClick={openLoginModal}
					className={'w-full'}>
					{'Connect wallet'}
				</Button>
			);
		}
		if (![1, 1337].includes(chainID)) {
			return (
				<Button
					onClick={(): void => onSwitchChain(1, true)}
					className={'w-full'}>
					{'Switch to Ethereum Mainnet'}
				</Button>
			);
		}
		if (txStatusApprove.pending || amount.raw.gt(selectedToken?.allowance || 0)) {
			return (
				<Button
					onClick={onApproveFrom}
					className={'w-full'}
					isBusy={txStatusApprove.pending}
					isDisabled={
						!isActive ||
						isZeroAddress(tokenAddress) ||
						amount.raw.isZero() ||
						![1, 1337].includes(chainID)
					}>
					{`Approve ${selectedToken?.symbol || 'token'}`}
				</Button>
			);
		}

		return (
			<Button
				onClick={onAddReward}
				className={'w-full'}
				isBusy={txStatusAddReward.pending}
				isDisabled={
					!isActive ||
					isZeroAddress(tokenAddress) ||
					amount.raw.isZero() ||
					amount.raw.gt(selectedToken?.raw || ethers.constants.Zero) ||
					![1, 1337].includes(chainID)
				}>
				{'Deposit'}
			</Button>
		);
	}

	return (
		<div className={'mx-auto block w-full bg-neutral-0 p-4 md:p-10'}>
			<div className={'relative z-20 col-span-6 flex flex-col space-y-1'}>
				<div>
					<b className={'text-3xl text-neutral-900'}>{`Offer bribe to ${currentGauge.name}`}</b>
					<p className={'pt-4'}>{'Choose your reward token contract and reward amount to offer a bribe on your chosen gauge.'}</p>
				</div>
			</div>
			<div className={'mt-6 grid grid-cols-12 gap-4'}>
				<div className={'relative z-20 col-span-12 flex flex-col space-y-4'}>
					<label className={'flex flex-col space-y-1 '}>
						<p className={'text-base text-neutral-600'}>
							{'Reward Token'}
						</p>
						<div className={'flex h-10 items-center bg-neutral-100 p-2'}>
							<div className={'flex h-10 w-full flex-row items-center justify-between py-4 px-0'}>
								<input
									className={`w-full overflow-x-scroll border-none bg-transparent py-4 px-0 font-bold outline-none scrollbar-none ${isActive ? '' : 'cursor-not-allowed'}`}
									type={'text'}
									placeholder={'0x...'}
									value={tokenAddress}
									onChange={(e: ChangeEvent<HTMLInputElement>): void => {
										const	{value} = e.target;
										if (value === '' || value.match(/^(0[x]{0,1})[a-fA-F0-9]{0,40}/gm)?.includes(value)) {
											if (isZeroAddress(value)) {
												set_tokenAddress(value);
											} else {
												set_tokenAddress(toAddress(value));
											}
										}
									}} />
							</div>
						</div>
					</label>
			
					<label className={'flex flex-col space-y-1'}>
						<p className={'text-base text-neutral-600'}>{'Reward Amount'}</p>
						<div className={'flex h-10 items-center bg-neutral-100 p-2'}>
							<div className={'flex h-10 w-full flex-row items-center justify-between py-4 px-0'}>
								<input
									className={`w-full overflow-x-scroll border-none bg-transparent py-4 px-0 font-bold outline-none scrollbar-none ${isActive ? '' : 'cursor-not-allowed'}`}
									type={'text'}
									disabled={!isActive}
									value={amount.normalized}
									onChange={(e: ChangeEvent<HTMLInputElement>): void => {
										set_amount(handleInputChange(e, selectedToken?.decimals || 18));
									}} />
								<button
									onClick={(): void => {
										set_amount({
											raw: selectedToken?.raw || ethers.constants.Zero,
											normalized: selectedToken?.normalized || 0
										});
									}}
									className={'cursor-pointer bg-neutral-900 px-2 py-1 text-xs text-neutral-0 transition-colors hover:bg-neutral-700'}>
									{'Max'}
								</button>
							</div>
						</div>
					</label>
				
					<div className={'space-y-1 border-t border-neutral-200 bg-neutral-0 py-6'}>
						<div className={'flex flex-row items-center justify-between'}>
							<p className={'text-sm text-neutral-400'}>
								{'Token'}
							</p>
							<p className={'text-base tabular-nums text-neutral-900'}>
								{selectedToken ? `${selectedToken?.name} (${selectedToken?.symbol})` : '-'}
							</p>
						</div>
						<div className={'flex flex-row items-center justify-between'}>
							<p className={'text-sm text-neutral-400'}>
								{'Value'}
							</p>
							<p className={'font-number text-base text-neutral-900'}>
								{selectedToken ? formatCounterValue(amount?.normalized || 0, (Number(prices?.[toAddress(tokenAddress)] || 0) / 1000000)) : '-'}
							</p>
						</div>
						<div className={'flex flex-row items-center justify-between'}>
							<p className={'text-sm text-neutral-400'}>
								{'Amount'}
							</p>
							<p className={'font-number text-sm text-neutral-900'}>
								{selectedToken ? `${amount.raw.toString()}` : '-'}
							</p>
						</div>
						<div className={'flex flex-row items-center justify-between'}>
							<p className={'text-sm text-neutral-400'}>
								{'Gauge'}
							</p>
							<p className={'font-number text-sm text-neutral-900'}>
								{toAddress(currentGauge.gauge)}
							</p>
						</div>
					</div>

					<div>{renderButton()}</div>
				</div>
			</div>
		</div>
	);
}

export {GaugeBribeModal};
