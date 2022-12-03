export function getMessariSubgraphEndpoint(chainID: number): string {
	switch (chainID) {
	case 1:
		return 'https://api.thegraph.com/subgraphs/name/messari/yearn-v2-ethereum';
	case 250:
		return 'https://api.thegraph.com/subgraphs/name/messari/yearn-v2-fantom';
	case 42161:
		return 'https://api.thegraph.com/subgraphs/name/messari/yearn-v2-arbitrum';
	default:
		return ('https://api.thegraph.com/subgraphs/name/messari/yearn-v2-ethereum');
	}
}