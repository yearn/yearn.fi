const YBAL_BALANCER_POOL_ABI = [{'inputs':[{'components':[{'internalType':'contract IVault', 'name':'vault', 'type':'address'}, {'internalType':'contract IProtocolFeePercentagesProvider', 'name':'protocolFeeProvider', 'type':'address'}, {'internalType':'string', 'name':'name', 'type':'string'}, {'internalType':'string', 'name':'symbol', 'type':'string'}, {'internalType':'contract IERC20[]', 'name':'tokens', 'type':'address[]'}, {'internalType':'contract IRateProvider[]', 'name':'rateProviders', 'type':'address[]'}, {'internalType':'uint256[]', 'name':'tokenRateCacheDurations', 'type':'uint256[]'}, {'internalType':'bool[]', 'name':'exemptFromYieldProtocolFeeFlags', 'type':'bool[]'}, {'internalType':'uint256', 'name':'amplificationParameter', 'type':'uint256'}, {'internalType':'uint256', 'name':'swapFeePercentage', 'type':'uint256'}, {'internalType':'uint256', 'name':'pauseWindowDuration', 'type':'uint256'}, {'internalType':'uint256', 'name':'bufferPeriodDuration', 'type':'uint256'}, {'internalType':'address', 'name':'owner', 'type':'address'}, {'internalType':'string', 'name':'version', 'type':'string'}], 'internalType':'struct ComposableStablePool.NewPoolParams', 'name':'params', 'type':'tuple'}], 'stateMutability':'nonpayable', 'type':'constructor'}, {'anonymous':false, 'inputs':[{'indexed':false, 'internalType':'uint256', 'name':'startValue', 'type':'uint256'}, {'indexed':false, 'internalType':'uint256', 'name':'endValue', 'type':'uint256'}, {'indexed':false, 'internalType':'uint256', 'name':'startTime', 'type':'uint256'}, {'indexed':false, 'internalType':'uint256', 'name':'endTime', 'type':'uint256'}], 'name':'AmpUpdateStarted', 'type':'event'}, {'anonymous':false, 'inputs':[{'indexed':false, 'internalType':'uint256', 'name':'currentValue', 'type':'uint256'}], 'name':'AmpUpdateStopped', 'type':'event'}, {'anonymous':false, 'inputs':[{'indexed':true, 'internalType':'address', 'name':'owner', 'type':'address'}, {'indexed':true, 'internalType':'address', 'name':'spender', 'type':'address'}, {'indexed':false, 'internalType':'uint256', 'name':'value', 'type':'uint256'}], 'name':'Approval', 'type':'event'}, {'anonymous':false, 'inputs':[{'indexed':false, 'internalType':'bool', 'name':'paused', 'type':'bool'}], 'name':'PausedStateChanged', 'type':'event'}, {'anonymous':false, 'inputs':[{'indexed':true, 'internalType':'uint256', 'name':'feeType', 'type':'uint256'}, {'indexed':false, 'internalType':'uint256', 'name':'protocolFeePercentage', 'type':'uint256'}], 'name':'ProtocolFeePercentageCacheUpdated', 'type':'event'}, {'anonymous':false, 'inputs':[{'indexed':false, 'internalType':'bool', 'name':'enabled', 'type':'bool'}], 'name':'RecoveryModeStateChanged', 'type':'event'}, {'anonymous':false, 'inputs':[{'indexed':false, 'internalType':'uint256', 'name':'swapFeePercentage', 'type':'uint256'}], 'name':'SwapFeePercentageChanged', 'type':'event'}, {'anonymous':false, 'inputs':[{'indexed':true, 'internalType':'uint256', 'name':'tokenIndex', 'type':'uint256'}, {'indexed':false, 'internalType':'uint256', 'name':'rate', 'type':'uint256'}], 'name':'TokenRateCacheUpdated', 'type':'event'}, {'anonymous':false, 'inputs':[{'indexed':true, 'internalType':'uint256', 'name':'tokenIndex', 'type':'uint256'}, {'indexed':true, 'internalType':'contract IRateProvider', 'name':'provider', 'type':'address'}, {'indexed':false, 'internalType':'uint256', 'name':'cacheDuration', 'type':'uint256'}], 'name':'TokenRateProviderSet', 'type':'event'}, {'anonymous':false, 'inputs':[{'indexed':true, 'internalType':'address', 'name':'from', 'type':'address'}, {'indexed':true, 'internalType':'address', 'name':'to', 'type':'address'}, {'indexed':false, 'internalType':'uint256', 'name':'value', 'type':'uint256'}], 'name':'Transfer', 'type':'event'}, {'inputs':[], 'name':'DELEGATE_PROTOCOL_SWAP_FEES_SENTINEL', 'outputs':[{'internalType':'uint256', 'name':'', 'type':'uint256'}], 'stateMutability':'view', 'type':'function'}, {'inputs':[], 'name':'DOMAIN_SEPARATOR', 'outputs':[{'internalType':'bytes32', 'name':'', 'type':'bytes32'}], 'stateMutability':'view', 'type':'function'}, {'inputs':[{'internalType':'address', 'name':'owner', 'type':'address'}, {'internalType':'address', 'name':'spender', 'type':'address'}], 'name':'allowance', 'outputs':[{'internalType':'uint256', 'name':'', 'type':'uint256'}], 'stateMutability':'view', 'type':'function'}, {'inputs':[{'internalType':'address', 'name':'spender', 'type':'address'}, {'internalType':'uint256', 'name':'amount', 'type':'uint256'}], 'name':'approve', 'outputs':[{'internalType':'bool', 'name':'', 'type':'bool'}], 'stateMutability':'nonpayable', 'type':'function'}, {'inputs':[{'internalType':'address', 'name':'account', 'type':'address'}], 'name':'balanceOf', 'outputs':[{'internalType':'uint256', 'name':'', 'type':'uint256'}], 'stateMutability':'view', 'type':'function'}, {'inputs':[], 'name':'decimals', 'outputs':[{'internalType':'uint8', 'name':'', 'type':'uint8'}], 'stateMutability':'view', 'type':'function'}, {'inputs':[{'internalType':'address', 'name':'spender', 'type':'address'}, {'internalType':'uint256', 'name':'amount', 'type':'uint256'}], 'name':'decreaseAllowance', 'outputs':[{'internalType':'bool', 'name':'', 'type':'bool'}], 'stateMutability':'nonpayable', 'type':'function'}, {'inputs':[], 'name':'disableRecoveryMode', 'outputs':[], 'stateMutability':'nonpayable', 'type':'function'}, {'inputs':[], 'name':'enableRecoveryMode', 'outputs':[], 'stateMutability':'nonpayable', 'type':'function'}, {'inputs':[{'internalType':'bytes4', 'name':'selector', 'type':'bytes4'}], 'name':'getActionId', 'outputs':[{'internalType':'bytes32', 'name':'', 'type':'bytes32'}], 'stateMutability':'view', 'type':'function'}, {'inputs':[], 'name':'getActualSupply', 'outputs':[{'internalType':'uint256', 'name':'', 'type':'uint256'}], 'stateMutability':'view', 'type':'function'}, {'inputs':[], 'name':'getAmplificationParameter', 'outputs':[{'internalType':'uint256', 'name':'value', 'type':'uint256'}, {'internalType':'bool', 'name':'isUpdating', 'type':'bool'}, {'internalType':'uint256', 'name':'precision', 'type':'uint256'}], 'stateMutability':'view', 'type':'function'}, {'inputs':[], 'name':'getAuthorizer', 'outputs':[{'internalType':'contract IAuthorizer', 'name':'', 'type':'address'}], 'stateMutability':'view', 'type':'function'}, {'inputs':[], 'name':'getBptIndex', 'outputs':[{'internalType':'uint256', 'name':'', 'type':'uint256'}], 'stateMutability':'view', 'type':'function'}, {'inputs':[], 'name':'getDomainSeparator', 'outputs':[{'internalType':'bytes32', 'name':'', 'type':'bytes32'}], 'stateMutability':'view', 'type':'function'}, {'inputs':[], 'name':'getLastJoinExitData', 'outputs':[{'internalType':'uint256', 'name':'lastJoinExitAmplification', 'type':'uint256'}, {'internalType':'uint256', 'name':'lastPostJoinExitInvariant', 'type':'uint256'}], 'stateMutability':'view', 'type':'function'}, {'inputs':[], 'name':'getMinimumBpt', 'outputs':[{'internalType':'uint256', 'name':'', 'type':'uint256'}], 'stateMutability':'pure', 'type':'function'}, {'inputs':[{'internalType':'address', 'name':'account', 'type':'address'}], 'name':'getNextNonce', 'outputs':[{'internalType':'uint256', 'name':'', 'type':'uint256'}], 'stateMutability':'view', 'type':'function'}, {'inputs':[], 'name':'getOwner', 'outputs':[{'internalType':'address', 'name':'', 'type':'address'}], 'stateMutability':'view', 'type':'function'}, {'inputs':[], 'name':'getPausedState', 'outputs':[{'internalType':'bool', 'name':'paused', 'type':'bool'}, {'internalType':'uint256', 'name':'pauseWindowEndTime', 'type':'uint256'}, {'internalType':'uint256', 'name':'bufferPeriodEndTime', 'type':'uint256'}], 'stateMutability':'view', 'type':'function'}, {'inputs':[], 'name':'getPoolId', 'outputs':[{'internalType':'bytes32', 'name':'', 'type':'bytes32'}], 'stateMutability':'view', 'type':'function'}, {'inputs':[{'internalType':'uint256', 'name':'feeType', 'type':'uint256'}], 'name':'getProtocolFeePercentageCache', 'outputs':[{'internalType':'uint256', 'name':'', 'type':'uint256'}], 'stateMutability':'view', 'type':'function'}, {'inputs':[], 'name':'getProtocolFeesCollector', 'outputs':[{'internalType':'contract IProtocolFeesCollector', 'name':'', 'type':'address'}], 'stateMutability':'view', 'type':'function'}, {'inputs':[], 'name':'getProtocolSwapFeeDelegation', 'outputs':[{'internalType':'bool', 'name':'', 'type':'bool'}], 'stateMutability':'view', 'type':'function'}, {'inputs':[], 'name':'getRate', 'outputs':[{'internalType':'uint256', 'name':'', 'type':'uint256'}], 'stateMutability':'view', 'type':'function'}, {'inputs':[], 'name':'getRateProviders', 'outputs':[{'internalType':'contract IRateProvider[]', 'name':'', 'type':'address[]'}], 'stateMutability':'view', 'type':'function'}, {'inputs':[], 'name':'getScalingFactors', 'outputs':[{'internalType':'uint256[]', 'name':'', 'type':'uint256[]'}], 'stateMutability':'view', 'type':'function'}, {'inputs':[], 'name':'getSwapFeePercentage', 'outputs':[{'internalType':'uint256', 'name':'', 'type':'uint256'}], 'stateMutability':'view', 'type':'function'}, {'inputs':[{'internalType':'contract IERC20', 'name':'token', 'type':'address'}], 'name':'getTokenRate', 'outputs':[{'internalType':'uint256', 'name':'', 'type':'uint256'}], 'stateMutability':'view', 'type':'function'}, {'inputs':[{'internalType':'contract IERC20', 'name':'token', 'type':'address'}], 'name':'getTokenRateCache', 'outputs':[{'internalType':'uint256', 'name':'rate', 'type':'uint256'}, {'internalType':'uint256', 'name':'oldRate', 'type':'uint256'}, {'internalType':'uint256', 'name':'duration', 'type':'uint256'}, {'internalType':'uint256', 'name':'expires', 'type':'uint256'}], 'stateMutability':'view', 'type':'function'}, {'inputs':[], 'name':'getVault', 'outputs':[{'internalType':'contract IVault', 'name':'', 'type':'address'}], 'stateMutability':'view', 'type':'function'}, {'inputs':[], 'name':'inRecoveryMode', 'outputs':[{'internalType':'bool', 'name':'', 'type':'bool'}], 'stateMutability':'view', 'type':'function'}, {'inputs':[{'internalType':'address', 'name':'spender', 'type':'address'}, {'internalType':'uint256', 'name':'addedValue', 'type':'uint256'}], 'name':'increaseAllowance', 'outputs':[{'internalType':'bool', 'name':'', 'type':'bool'}], 'stateMutability':'nonpayable', 'type':'function'}, {'inputs':[{'internalType':'contract IERC20', 'name':'token', 'type':'address'}], 'name':'isTokenExemptFromYieldProtocolFee', 'outputs':[{'internalType':'bool', 'name':'', 'type':'bool'}], 'stateMutability':'view', 'type':'function'}, {'inputs':[], 'name':'name', 'outputs':[{'internalType':'string', 'name':'', 'type':'string'}], 'stateMutability':'view', 'type':'function'}, {'inputs':[{'internalType':'address', 'name':'owner', 'type':'address'}], 'name':'nonces', 'outputs':[{'internalType':'uint256', 'name':'', 'type':'uint256'}], 'stateMutability':'view', 'type':'function'}, {'inputs':[{'internalType':'bytes32', 'name':'poolId', 'type':'bytes32'}, {'internalType':'address', 'name':'sender', 'type':'address'}, {'internalType':'address', 'name':'recipient', 'type':'address'}, {'internalType':'uint256[]', 'name':'balances', 'type':'uint256[]'}, {'internalType':'uint256', 'name':'lastChangeBlock', 'type':'uint256'}, {'internalType':'uint256', 'name':'protocolSwapFeePercentage', 'type':'uint256'}, {'internalType':'bytes', 'name':'userData', 'type':'bytes'}], 'name':'onExitPool', 'outputs':[{'internalType':'uint256[]', 'name':'', 'type':'uint256[]'}, {'internalType':'uint256[]', 'name':'', 'type':'uint256[]'}], 'stateMutability':'nonpayable', 'type':'function'}, {'inputs':[{'internalType':'bytes32', 'name':'poolId', 'type':'bytes32'}, {'internalType':'address', 'name':'sender', 'type':'address'}, {'internalType':'address', 'name':'recipient', 'type':'address'}, {'internalType':'uint256[]', 'name':'balances', 'type':'uint256[]'}, {'internalType':'uint256', 'name':'lastChangeBlock', 'type':'uint256'}, {'internalType':'uint256', 'name':'protocolSwapFeePercentage', 'type':'uint256'}, {'internalType':'bytes', 'name':'userData', 'type':'bytes'}], 'name':'onJoinPool', 'outputs':[{'internalType':'uint256[]', 'name':'', 'type':'uint256[]'}, {'internalType':'uint256[]', 'name':'', 'type':'uint256[]'}], 'stateMutability':'nonpayable', 'type':'function'}, {'inputs':[{'components':[{'internalType':'enum IVault.SwapKind', 'name':'kind', 'type':'uint8'}, {'internalType':'contract IERC20', 'name':'tokenIn', 'type':'address'}, {'internalType':'contract IERC20', 'name':'tokenOut', 'type':'address'}, {'internalType':'uint256', 'name':'amount', 'type':'uint256'}, {'internalType':'bytes32', 'name':'poolId', 'type':'bytes32'}, {'internalType':'uint256', 'name':'lastChangeBlock', 'type':'uint256'}, {'internalType':'address', 'name':'from', 'type':'address'}, {'internalType':'address', 'name':'to', 'type':'address'}, {'internalType':'bytes', 'name':'userData', 'type':'bytes'}], 'internalType':'struct IPoolSwapStructs.SwapRequest', 'name':'swapRequest', 'type':'tuple'}, {'internalType':'uint256[]', 'name':'balances', 'type':'uint256[]'}, {'internalType':'uint256', 'name':'indexIn', 'type':'uint256'}, {'internalType':'uint256', 'name':'indexOut', 'type':'uint256'}], 'name':'onSwap', 'outputs':[{'internalType':'uint256', 'name':'', 'type':'uint256'}], 'stateMutability':'nonpayable', 'type':'function'}, {'inputs':[], 'name':'pause', 'outputs':[], 'stateMutability':'nonpayable', 'type':'function'}, {'inputs':[{'internalType':'address', 'name':'owner', 'type':'address'}, {'internalType':'address', 'name':'spender', 'type':'address'}, {'internalType':'uint256', 'name':'value', 'type':'uint256'}, {'internalType':'uint256', 'name':'deadline', 'type':'uint256'}, {'internalType':'uint8', 'name':'v', 'type':'uint8'}, {'internalType':'bytes32', 'name':'r', 'type':'bytes32'}, {'internalType':'bytes32', 'name':'s', 'type':'bytes32'}], 'name':'permit', 'outputs':[], 'stateMutability':'nonpayable', 'type':'function'}, {'inputs':[{'internalType':'bytes32', 'name':'poolId', 'type':'bytes32'}, {'internalType':'address', 'name':'sender', 'type':'address'}, {'internalType':'address', 'name':'recipient', 'type':'address'}, {'internalType':'uint256[]', 'name':'balances', 'type':'uint256[]'}, {'internalType':'uint256', 'name':'lastChangeBlock', 'type':'uint256'}, {'internalType':'uint256', 'name':'protocolSwapFeePercentage', 'type':'uint256'}, {'internalType':'bytes', 'name':'userData', 'type':'bytes'}], 'name':'queryExit', 'outputs':[{'internalType':'uint256', 'name':'bptIn', 'type':'uint256'}, {'internalType':'uint256[]', 'name':'amountsOut', 'type':'uint256[]'}], 'stateMutability':'nonpayable', 'type':'function'}, {'inputs':[{'internalType':'bytes32', 'name':'poolId', 'type':'bytes32'}, {'internalType':'address', 'name':'sender', 'type':'address'}, {'internalType':'address', 'name':'recipient', 'type':'address'}, {'internalType':'uint256[]', 'name':'balances', 'type':'uint256[]'}, {'internalType':'uint256', 'name':'lastChangeBlock', 'type':'uint256'}, {'internalType':'uint256', 'name':'protocolSwapFeePercentage', 'type':'uint256'}, {'internalType':'bytes', 'name':'userData', 'type':'bytes'}], 'name':'queryJoin', 'outputs':[{'internalType':'uint256', 'name':'bptOut', 'type':'uint256'}, {'internalType':'uint256[]', 'name':'amountsIn', 'type':'uint256[]'}], 'stateMutability':'nonpayable', 'type':'function'}, {'inputs':[{'internalType':'contract IERC20', 'name':'token', 'type':'address'}, {'internalType':'bytes', 'name':'poolConfig', 'type':'bytes'}], 'name':'setAssetManagerPoolConfig', 'outputs':[], 'stateMutability':'nonpayable', 'type':'function'}, {'inputs':[{'internalType':'uint256', 'name':'swapFeePercentage', 'type':'uint256'}], 'name':'setSwapFeePercentage', 'outputs':[], 'stateMutability':'nonpayable', 'type':'function'}, {'inputs':[{'internalType':'contract IERC20', 'name':'token', 'type':'address'}, {'internalType':'uint256', 'name':'duration', 'type':'uint256'}], 'name':'setTokenRateCacheDuration', 'outputs':[], 'stateMutability':'nonpayable', 'type':'function'}, {'inputs':[{'internalType':'uint256', 'name':'rawEndValue', 'type':'uint256'}, {'internalType':'uint256', 'name':'endTime', 'type':'uint256'}], 'name':'startAmplificationParameterUpdate', 'outputs':[], 'stateMutability':'nonpayable', 'type':'function'}, {'inputs':[], 'name':'stopAmplificationParameterUpdate', 'outputs':[], 'stateMutability':'nonpayable', 'type':'function'}, {'inputs':[], 'name':'symbol', 'outputs':[{'internalType':'string', 'name':'', 'type':'string'}], 'stateMutability':'view', 'type':'function'}, {'inputs':[], 'name':'totalSupply', 'outputs':[{'internalType':'uint256', 'name':'', 'type':'uint256'}], 'stateMutability':'view', 'type':'function'}, {'inputs':[{'internalType':'address', 'name':'recipient', 'type':'address'}, {'internalType':'uint256', 'name':'amount', 'type':'uint256'}], 'name':'transfer', 'outputs':[{'internalType':'bool', 'name':'', 'type':'bool'}], 'stateMutability':'nonpayable', 'type':'function'}, {'inputs':[{'internalType':'address', 'name':'sender', 'type':'address'}, {'internalType':'address', 'name':'recipient', 'type':'address'}, {'internalType':'uint256', 'name':'amount', 'type':'uint256'}], 'name':'transferFrom', 'outputs':[{'internalType':'bool', 'name':'', 'type':'bool'}], 'stateMutability':'nonpayable', 'type':'function'}, {'inputs':[], 'name':'unpause', 'outputs':[], 'stateMutability':'nonpayable', 'type':'function'}, {'inputs':[], 'name':'updateProtocolFeePercentageCache', 'outputs':[], 'stateMutability':'nonpayable', 'type':'function'}, {'inputs':[{'internalType':'contract IERC20', 'name':'token', 'type':'address'}], 'name':'updateTokenRateCache', 'outputs':[], 'stateMutability':'nonpayable', 'type':'function'}, {'inputs':[], 'name':'version', 'outputs':[{'internalType':'string', 'name':'', 'type':'string'}], 'stateMutability':'view', 'type':'function'}] as const;

export YBAL_BALANCER_POOL_ABI;
