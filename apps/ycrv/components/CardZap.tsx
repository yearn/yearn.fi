import React, {useMemo} from 'react';
import {ethers} from 'ethers';
import {motion} from 'framer-motion';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {CRV_TOKEN_ADDRESS, LPYCRV_TOKEN_ADDRESS, YCRV_CURVE_POOL_ADDRESS, YCRV_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {formatBN, formatToNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatCounterValue} from '@yearn-finance/web-lib/utils/format.value';
import performBatchedUpdates from '@yearn-finance/web-lib/utils/performBatchedUpdates';
import {Dropdown} from '@common/components/TokenDropdown';
import {useYearn} from '@common/contexts/useYearn';
import ArrowDown from '@common/icons/ArrowDown';
import {handleInputChange} from '@common/utils';
import CardTransactorContextApp, {useCardTransactor} from '@yCRV/components/CardTransactorWrapper';
import {useExtendedWallet} from '@yCRV/contexts/useExtendedWallet';
import {CardVariants, CardVariantsInner} from '@yCRV/utils/animations';
import {ZAP_OPTIONS_FROM, ZAP_OPTIONS_TO} from '@yCRV/utils/zapOptions';

import type {ChangeEvent, ReactElement} from 'react';
import type {TDropdownOption} from '@common/types/types';

function	CardZap(): ReactElement {
	const	{isActive} = useWeb3();
	const	{balances} = useExtendedWallet();
	const	{vaults, prices} = useYearn();
	const	{
		txStatusApprove, txStatusZap,
		selectedOptionFrom, set_selectedOptionFrom,
		selectedOptionTo, set_selectedOptionTo,
		amount, set_amount,
		set_hasTypedSomething,
		fromVaultAPY, toVaultAPY, expectedOutWithSlippage,
		allowanceFrom, onApproveFrom, onZap, onIncreaseCRVAllowance
	} = useCardTransactor();

	const	ycrvPrice = useMemo((): number => (
		formatToNormalizedValue(
			formatBN(prices?.[YCRV_TOKEN_ADDRESS] || 0),
			6
		)
	), [prices]);

	const	ycrvCurvePoolPrice = useMemo((): number => (
		formatToNormalizedValue(
			formatBN(prices?.[YCRV_CURVE_POOL_ADDRESS] || 0),
			6
		)
	), [prices]);

	/* 🔵 - Yearn Finance ******************************************************
	** useMemo to get the current possible TO vaults path for the current FROM
	**************************************************************************/
	const	possibleTo = useMemo((): TDropdownOption[] => {
		if (selectedOptionFrom.value === YCRV_CURVE_POOL_ADDRESS) {
			const possibleOptions = ZAP_OPTIONS_TO.filter((option): boolean => option.value === LPYCRV_TOKEN_ADDRESS);
			if (selectedOptionTo.value !== LPYCRV_TOKEN_ADDRESS) {
				set_selectedOptionTo(possibleOptions[0]);
			}
			return possibleOptions;
		}
		return ZAP_OPTIONS_TO.filter((option): boolean => option.value !== selectedOptionFrom.value);
	}, [selectedOptionFrom.value, selectedOptionTo.value, ZAP_OPTIONS_TO]); // eslint-disable-line react-hooks/exhaustive-deps

	function	renderButton(): ReactElement {
		const	balanceForInputToken = balances?.[toAddress(selectedOptionFrom.value)]?.raw || ethers.constants.Zero;
		const	isAboveBalance = amount.raw.gt(balanceForInputToken) || balanceForInputToken.eq(ethers.constants.Zero);
		const	isAboveAllowance = (amount.raw).gt(allowanceFrom);

		if (txStatusApprove.pending || isAboveAllowance) {
			if (allowanceFrom.gt(ethers.constants.Zero) && toAddress(selectedOptionFrom.value) === CRV_TOKEN_ADDRESS) {
				return (
					<Button
						onClick={onIncreaseCRVAllowance}
						className={'w-full'}
						isBusy={txStatusApprove.pending}
						isDisabled={
							!isActive
							|| (amount.raw).isZero()
							|| isAboveBalance
						}>
						{'Increase Allowance'}
					</Button>
				);	
			}
			return (
				<Button
					onClick={onApproveFrom}
					className={'w-full'}
					isBusy={txStatusApprove.pending}
					isDisabled={
						!isActive
						|| (amount.raw).isZero()
						|| isAboveBalance
					}>
					{isAboveBalance ? 'Insufficient balance' : `Approve ${selectedOptionFrom?.label || 'token'}`}
				</Button>
			);	
		}

		return (
			<Button
				onClick={onZap}
				className={'w-full'}
				isBusy={txStatusZap.pending}
				isDisabled={
					!isActive ||
					(amount.raw).isZero() ||
					amount.raw.gt(balanceForInputToken)
				}>
				{isAboveBalance && !amount.raw.isZero() ? 'Insufficient balance' : 'Swap'}
			</Button>
		);
	}
	
	return (
		<>
			<div aria-label={'card title'} className={'flex flex-col pb-8'}>
				<h2 className={'text-3xl font-bold'}>{'Supercharge your'}</h2>
				<h2 className={'text-3xl font-bold'}>{'yield with yCRV'}</h2>
			</div>
			<div aria-label={'card description'} className={'w-full pb-10 md:w-[96%]'}>
				<p className={'text-neutral-600'}>{'Swap any token within the yCRV ecosystem for any other. Maybe you want to swap for a higher yield, or maybe you just like swapping. It’s ok, we don’t judge.'}</p>
			</div>

			<div className={'grid grid-cols-2 gap-4'}>
				<label className={'relative z-20 flex flex-col space-y-1'}>
					<p className={'text-base text-neutral-600'}>{'Swap from'}</p>
					<Dropdown
						defaultOption={ZAP_OPTIONS_FROM[0]}
						options={ZAP_OPTIONS_FROM}
						selected={selectedOptionFrom}
						onSelect={(option: TDropdownOption): void => {
							performBatchedUpdates((): void => {
								if (option.value === selectedOptionTo.value) {
									set_selectedOptionTo(ZAP_OPTIONS_TO.find((o: TDropdownOption): boolean => o.value !== option.value) as TDropdownOption);
								}
								set_selectedOptionFrom(option);
								set_amount({
									raw: balances[toAddress(option.value)]?.raw || ethers.constants.Zero,
									normalized: balances[toAddress(option.value)]?.normalized || 0
								});
							});
						}} />
					<p className={'pl-2 !text-xs font-normal !text-green-600'}>
						{fromVaultAPY}
					</p>
				</label>
				<div className={'flex flex-col space-y-1'}>
					<label
						htmlFor={'amount'}
						className={'text-base text-neutral-600'}>
						{'Amount'}
					</label>
					<div className={'flex h-10 items-center bg-neutral-100 p-2'}>
						<div className={'flex h-10 w-full flex-row items-center justify-between py-4 px-0'}>
							<input
								id={'amount'}
								className={`w-full overflow-x-scroll border-none bg-transparent py-4 px-0 font-bold outline-none scrollbar-none ${isActive ? '' : 'cursor-not-allowed'}`}
								type={'text'}
								disabled={!isActive}
								value={amount.normalized}
								onChange={(e: ChangeEvent<HTMLInputElement>): void => {
									performBatchedUpdates((): void => {
										set_amount(handleInputChange(e, balances[toAddress(selectedOptionFrom.value)]?.decimals || 18));
										set_hasTypedSomething(true);
									});
								}} />
							<button
								onClick={(): void => {
									set_amount({
										raw: balances[toAddress(selectedOptionFrom.value)]?.raw || ethers.constants.Zero,
										normalized: balances[toAddress(selectedOptionFrom.value)]?.normalized || 0
									});
								}}
								className={'cursor-pointer text-sm text-neutral-500 transition-colors hover:text-neutral-900'}>
								{'max'}
							</button>
						</div>
					</div>
					<p className={'pl-2 text-xs font-normal text-neutral-600'}>
						{formatCounterValue(
							amount?.normalized || 0,
							toAddress(selectedOptionFrom.value) === YCRV_TOKEN_ADDRESS
								? ycrvPrice || 0
								: toAddress(selectedOptionFrom.value) === YCRV_CURVE_POOL_ADDRESS
									? ycrvCurvePoolPrice || 0
									: balances?.[toAddress(selectedOptionFrom.value)]?.normalizedPrice
									|| vaults?.[toAddress(selectedOptionFrom.value)]?.tvl?.price
									|| 0
						)}
					</p>
				</div>
			</div>

			<div className={'mt-2 mb-4 hidden grid-cols-2 gap-4 md:grid lg:mt-8 lg:mb-10'}>
				<div className={'flex items-center justify-center'}>
					<ArrowDown />
				</div>
				<div className={'flex items-center justify-center'}>
					<ArrowDown />
				</div>
			</div>

			<div className={'mt-4 mb-8 grid grid-cols-2 gap-4 md:mt-0'}>
				<label className={'relative z-10 flex flex-col space-y-1'}>
					<p className={'text-base text-neutral-600'}>{'Swap to'}</p>
					<Dropdown
						defaultOption={possibleTo[0]}
						options={possibleTo}
						selected={selectedOptionTo}
						onSelect={(option: TDropdownOption): void => set_selectedOptionTo(option)} />
					<p className={'pl-2 !text-xs font-normal !text-green-600'}>
						{toVaultAPY}
					</p>
				</label>
				<div className={'flex flex-col space-y-1'}>
					<div>
						<p className={'hidden text-base text-neutral-600 md:block'}>{'You will receive minimum'}</p>
						<p className={'block text-base text-neutral-600 md:hidden'}>{'You will receive min'}</p>
					</div>
					<div className={'flex h-10 items-center bg-neutral-300 p-2'}>
						<b className={'overflow-x-scroll scrollbar-none'}>
							{expectedOutWithSlippage}
						</b>
					</div>
					<p className={'pl-2 text-xs font-normal text-neutral-600'}>
						{formatCounterValue(
							expectedOutWithSlippage,
							toAddress(selectedOptionTo.value) === YCRV_TOKEN_ADDRESS
								? ycrvPrice || 0
								: toAddress(selectedOptionFrom.value) === YCRV_CURVE_POOL_ADDRESS
									? ycrvCurvePoolPrice || 0
									: balances?.[toAddress(selectedOptionTo.value)]?.normalizedPrice
									|| vaults?.[toAddress(selectedOptionTo.value)]?.tvl?.price
									|| 0
						)}
					</p>
				</div>
			</div>

			<div aria-label={'card actions'}>
				<div className={'mb-3'}>
					{renderButton()}
				</div>
			</div>
		</>
	);
}

function	CardZapWrapper(): ReactElement {
	const {txStatusApprove, txStatusZap} = useCardTransactor();
	
	return (
		<div>
			<motion.div
				initial={'rest'}
				whileHover={'hover'}
				animate={'rest'}
				variants={CardVariants as never}
				className={'hidden h-[733px] w-[592px] items-center justify-end lg:flex'}
				custom={!txStatusApprove.none || !txStatusZap.none}>
				<motion.div
					variants={CardVariantsInner as never}
					custom={!txStatusApprove.none || !txStatusZap.none}
					className={'h-[701px] w-[560px] bg-neutral-200 p-12'}>
					<CardZap />
				</motion.div>
			</motion.div>
			<div className={'w-full bg-neutral-200 p-4 md:p-8 lg:hidden'}>
				<CardZap />
			</div>
		</div>
	);
}

function	WithCardTransactor(): ReactElement {
	return (
		<CardTransactorContextApp
			defaultOptionFrom={ZAP_OPTIONS_FROM[0]}
			defaultOptionTo={ZAP_OPTIONS_TO[0]}>
			<CardZapWrapper />
		</CardTransactorContextApp>
	);
}
export default WithCardTransactor;
