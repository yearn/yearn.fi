// TODO: update once final version deployed
const VEYFI_REGISTRY_ABI = [
	'function getVaults() public view returns (address[] memory)',
	'function gauges(address _addr) public view returns (address)'
];

export default VEYFI_REGISTRY_ABI;
