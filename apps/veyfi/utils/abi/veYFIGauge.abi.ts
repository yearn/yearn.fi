// TODO: update once final version deployed
const VEYFI_GAUGE_ABI = [
	'function earned(address _account) public view returns (uint256)',
	'function boostedBalanceOf(address _account) public view returns (uint256)',
	'function deposit(uint256 _assets) external returns (uint256)',
	'function withdraw(uint256 _assets, address _receiver, address _owner, bool _claim, bool _lock) external returns (uint256)',
	'function getReward() external returns (bool)'
];

export default VEYFI_GAUGE_ABI;
