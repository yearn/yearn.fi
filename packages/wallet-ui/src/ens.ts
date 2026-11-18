import { type Address, isAddressEqual, namehash, type PublicClient, parseAbi, zeroAddress } from 'viem'
import { normalize } from 'viem/ens'

const registry = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e'
const registryAbi = parseAbi(['function resolver(bytes32 node) view returns (address)'])
const addressAbi = parseAbi(['function addr(bytes32 node) view returns (address)'])
const nameAbi = parseAbi(['function name(bytes32 node) view returns (string)'])
type TEnsClient = Pick<PublicClient, 'getEnsAddress' | 'readContract'>

export async function resolveEnsAddress(client: TEnsClient, input: string) {
  const name = normalize(input)
  const universal = await client.getEnsAddress({ name }).then(
    (address) => ({ address, error: null }),
    (error: unknown) => ({ address: null, error })
  )
  if (universal.address && universal.address !== zeroAddress) return { name, address: universal.address }

  // Some registered names return ResolverNotFound from the current universal
  // resolver despite having an Ethereum record. Query that name's own resolver;
  // never substitute the registry owner for a missing address record.
  const node = namehash(name)
  const resolver = await client.readContract({
    address: registry,
    abi: registryAbi,
    functionName: 'resolver',
    args: [node]
  })
  if (resolver === zeroAddress) {
    // A failed universal request could have missed a wildcard/CCIP resolver.
    // Preserve that failure rather than claiming the name has no address.
    if (universal.error) throw universal.error
    return { name, address: null }
  }
  const address = await client.readContract({ address: resolver, abi: addressAbi, functionName: 'addr', args: [node] })
  return { name, address: address === zeroAddress ? null : address }
}

export async function resolveEnsName(client: TEnsClient & Pick<PublicClient, 'getEnsName'>, address: Address) {
  const universal = await client.getEnsName({ address }).then(
    (name) => ({ name, error: null }),
    (error: unknown) => ({ name: null, error })
  )
  if (universal.name) return universal.name

  const node = namehash(`${address.slice(2).toLowerCase()}.addr.reverse`)
  const resolver = await client.readContract({
    address: registry,
    abi: registryAbi,
    functionName: 'resolver',
    args: [node]
  })
  if (resolver === zeroAddress) {
    if (universal.error) throw universal.error
    return null
  }

  const reverseName = await client.readContract({ address: resolver, abi: nameAbi, functionName: 'name', args: [node] })
  if (!reverseName) return null

  // A legacy reverse record can claim any name. Confirm that it resolves back to this wallet.
  const { name, address: forwardAddress } = await resolveEnsAddress(client, reverseName)
  return forwardAddress && isAddressEqual(address, forwardAddress) ? name : null
}
