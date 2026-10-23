// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Script } from "forge-std/Script.sol";

/**
 * @title DeployedAddresses
 * @notice Centralized registry of previously deployed contract addresses across different networks
 * @dev This contract provides network-specific addresses to enable reusing deployed contracts
 *      instead of redeploying them. When an address is set to address(0), the deployment
 *      script will deploy a new instance of that contract.
 *
 * IMPORTANT: Network detection cannot rely solely on chain ID because:
 * - Tenderly staging is a mainnet FORK (chain ID = 1, same as production mainnet)
 * - Cannot distinguish fork from real mainnet using only block.chainid
 * - Must use explicit network selection via DEPLOYMENT_NETWORK environment variable
 *
 * Network Configuration:
 * - Set DEPLOYMENT_NETWORK env var to: "mainnet", "sepolia", "staging", or "anvil"
 * - Example: DEPLOYMENT_NETWORK=staging forge script ...
 */
contract DeployedAddresses is Script {
    /**
     * @notice Container for all protocol contract addresses
     * @dev Set any address to address(0) to trigger fresh deployment
     */
    struct ContractAddresses {
        // Core Infrastructure
        address linearAllowanceSingleton;
        // Factory Contracts
        address paymentSplitterFactory;
        address skyCompounderStrategyFactory;
        address morphoCompounderStrategyFactory;
        address regenEarningPowerCalculatorFactory;
        address regenStakerFactory;
        address allocationMechanismFactory;
        // External Strategy Contracts (not deployed by this script, tracked for reference)
        address yieldDonatingTokenizedStrategy;
        address yearnV3StrategyFactory;
        address lidoStrategyFactory;
        // AddressSet Factory and Contracts (for allowlists/blocklists)
        address addressSetFactory;
        address stakerAllowset;
        address stakerBlockset;
        address allocationMechanismAllowset;
        // Calculators
        address regenEarningPowerCalculator;
    }

    /**
     * @notice Get deployed contract addresses by reading DEPLOYMENT_NETWORK environment variable
     * @dev This is the RECOMMENDED way to get addresses. Reads env var and maps to network.
     *      Valid values: "mainnet", "sepolia", "staging", "anvil"
     *      Falls back to staging if env var is not set.
     * @return ContractAddresses struct with network-specific addresses
     */
    function getAddressesByEnv() public view returns (ContractAddresses memory) {
        string memory network = vm.envOr("DEPLOYMENT_NETWORK", string("staging"));

        if (keccak256(bytes(network)) == keccak256(bytes("mainnet"))) {
            return getMainnetAddresses();
        }
        if (keccak256(bytes(network)) == keccak256(bytes("sepolia"))) {
            return getSepoliaAddresses();
        }
        if (keccak256(bytes(network)) == keccak256(bytes("anvil"))) {
            return getAnvilAddresses();
        }
        // Default to staging (includes "staging" and any unknown values)
        return getStagingAddresses();
    }

    /**
     * @notice Mainnet (Ethereum) deployed contract addresses
     * @dev Mainnet addresses for existing contracts that can be reused
     * @return ContractAddresses struct for mainnet
     */
    function getMainnetAddresses() internal pure returns (ContractAddresses memory) {
        return
            ContractAddresses({
                linearAllowanceSingleton: address(0),
                // Factory contracts - existing mainnet deployments
                paymentSplitterFactory: 0x5711765E0756B45224fc1FdA1B41ab344682bBcb,
                skyCompounderStrategyFactory: 0xbe5352d0eCdB13D9f74c244B634FdD729480Bb6F,
                morphoCompounderStrategyFactory: 0x052d20B0e0b141988bD32772C735085e45F357c1,
                regenEarningPowerCalculatorFactory: 0xD916da52d277b28CaDFfEE5350bA98cf3d8fa441,
                regenStakerFactory: 0x6a8250C95d2e866e95fe4749eD540357B8e44a9a,
                allocationMechanismFactory: address(0),
                // External strategy contracts - existing mainnet deployments
                yieldDonatingTokenizedStrategy: 0xb27064A2C51b8C5b39A5Bb911AD34DB039C3aB9c,
                yearnV3StrategyFactory: 0x6D8c4E4A158083E30B53ba7df3cFB885fC096fF6,
                lidoStrategyFactory: address(0),
                // AddressSet factory and contracts - to be deployed
                addressSetFactory: 0x908FA1747a5E12708c0e575875F2685750CFEfD1,
                stakerAllowset: 0x4FFAb2c015d9dCd5D20d489E644D99ae67a57270,
                stakerBlockset: 0xD65B1936D497be8e2f56862664833eB64D1e2d7e,
                allocationMechanismAllowset: 0xE000b30E2BC08A39BD863d4df6c42148439A1D1B,
                // Calculators
                regenEarningPowerCalculator: 0xEa8AEe52411f153547744e98E592dd9FF14b76B0
            });
    }

    /**
     * @notice Sepolia (Ethereum testnet) deployed contract addresses
     * @dev Currently all addresses are zero - except the contracts that are deployed to Sepolia
     * @return ContractAddresses struct for Sepolia testnet
     */
    function getSepoliaAddresses() internal pure returns (ContractAddresses memory) {
        return
            ContractAddresses({
                linearAllowanceSingleton: address(0),
                paymentSplitterFactory: address(0),
                skyCompounderStrategyFactory: address(0),
                morphoCompounderStrategyFactory: address(0),
                regenEarningPowerCalculatorFactory: address(0),
                regenStakerFactory: address(0),
                allocationMechanismFactory: 0x4fc209Fbc5eFE0549cdB878f206942a91bBC17d2,
                yieldDonatingTokenizedStrategy: address(0),
                yearnV3StrategyFactory: address(0),
                lidoStrategyFactory: address(0),
                addressSetFactory: address(0),
                stakerAllowset: address(0),
                stakerBlockset: address(0),
                allocationMechanismAllowset: address(0),
                regenEarningPowerCalculator: address(0)
            });
    }

    /**
     * @notice Tenderly Staging (virtual testnet) deployed contract addresses
     * @dev Staging is a mainnet fork, so it uses the same addresses as mainnet
     * @return ContractAddresses struct for staging environment
     */
    function getStagingAddresses() internal pure returns (ContractAddresses memory) {
        return
            ContractAddresses({
                linearAllowanceSingleton: address(0),
                // Factory contracts - reuse existing mainnet deployments
                paymentSplitterFactory: 0x5711765E0756B45224fc1FdA1B41ab344682bBcb,
                skyCompounderStrategyFactory: 0xbe5352d0eCdB13D9f74c244B634FdD729480Bb6F,
                morphoCompounderStrategyFactory: 0x052d20B0e0b141988bD32772C735085e45F357c1,
                // RegenStaker and AllocationMechanism - deploy fresh (protocol-specific)
                regenEarningPowerCalculatorFactory: 0xD916da52d277b28CaDFfEE5350bA98cf3d8fa441,
                regenStakerFactory: 0x6a8250C95d2e866e95fe4749eD540357B8e44a9a,
                allocationMechanismFactory: 0x944f609aF006543E2AE28b555A3ACa594480B612,
                // External strategy contracts - reuse existing mainnet deployments
                yieldDonatingTokenizedStrategy: 0xb27064A2C51b8C5b39A5Bb911AD34DB039C3aB9c,
                yearnV3StrategyFactory: 0x6D8c4E4A158083E30B53ba7df3cFB885fC096fF6,
                lidoStrategyFactory: address(0),
                // AddressSet factory and contracts - deploy fresh (protocol-specific)
                addressSetFactory: 0x908FA1747a5E12708c0e575875F2685750CFEfD1,
                stakerAllowset: address(0),
                stakerBlockset: address(0),
                allocationMechanismAllowset: address(0),
                // Calculators
                regenEarningPowerCalculator: 0xEa8AEe52411f153547744e98E592dd9FF14b76B0
            });
    }

    /**
     * @notice Anvil (local testnet) deployed contract addresses
     * @dev All addresses are zero for local testing - everything deploys fresh
     * @return ContractAddresses struct for Anvil local environment
     */
    function getAnvilAddresses() internal pure returns (ContractAddresses memory) {
        return
            ContractAddresses({
                linearAllowanceSingleton: address(0),
                paymentSplitterFactory: address(0),
                skyCompounderStrategyFactory: address(0),
                morphoCompounderStrategyFactory: address(0),
                regenEarningPowerCalculatorFactory: address(0),
                regenStakerFactory: address(0),
                allocationMechanismFactory: address(0),
                yieldDonatingTokenizedStrategy: address(0),
                yearnV3StrategyFactory: address(0),
                lidoStrategyFactory: address(0),
                addressSetFactory: address(0),
                stakerAllowset: address(0),
                stakerBlockset: address(0),
                allocationMechanismAllowset: address(0),
                regenEarningPowerCalculator: address(0)
            });
    }
}
