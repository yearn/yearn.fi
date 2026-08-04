import { beforeEach, describe, expect, it, vi } from 'vitest'
import Page, { generateMetadata } from './page'

const {
  mockBuildVaultMetadataFromInput,
  mockBuildVaultStructuredDataFromInput,
  mockFetchVaultMetadataSnapshot,
  mockGetVaultDetailPageDehydratedState,
  mockNotFound
} = vi.hoisted(() => ({
  mockBuildVaultMetadataFromInput: vi.fn(),
  mockBuildVaultStructuredDataFromInput: vi.fn(),
  mockFetchVaultMetadataSnapshot: vi.fn(),
  mockGetVaultDetailPageDehydratedState: vi.fn(),
  mockNotFound: vi.fn()
}))

vi.mock('next/navigation', () => ({
  notFound: mockNotFound
}))

vi.mock('@/server/ssr/publicDataHydration', () => ({
  getVaultDetailPageDehydratedState: mockGetVaultDetailPageDehydratedState
}))

vi.mock('../../../../metadata', () => ({
  buildVaultMetadataFromInput: mockBuildVaultMetadataFromInput,
  buildVaultStructuredDataFromInput: mockBuildVaultStructuredDataFromInput,
  fetchVaultMetadataSnapshot: mockFetchVaultMetadataSnapshot,
  yearnOrganizationJsonLd: {}
}))

const PAGE_PROPS = {
  params: Promise.resolve({
    chainID: '1',
    address: '0x7B5A0182E400b241b317e781a4e9dEdFc1429822'
  })
}
const NOT_FOUND_ERROR = new Error('NEXT_NOT_FOUND')

describe('vault detail page visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNotFound.mockImplementation(() => {
      throw NOT_FOUND_ERROR
    })
  })

  it('returns not found before rendering a hidden vault page', async () => {
    mockFetchVaultMetadataSnapshot.mockResolvedValue({ meta: { isHidden: true } })

    await expect(Page(PAGE_PROPS)).rejects.toBe(NOT_FOUND_ERROR)
    expect(mockBuildVaultStructuredDataFromInput).not.toHaveBeenCalled()
    expect(mockGetVaultDetailPageDehydratedState).not.toHaveBeenCalled()
  })

  it('returns not found before publishing hidden vault metadata', async () => {
    mockFetchVaultMetadataSnapshot.mockResolvedValue({ meta: { isHidden: true } })

    await expect(generateMetadata(PAGE_PROPS)).rejects.toBe(NOT_FOUND_ERROR)
    expect(mockBuildVaultMetadataFromInput).not.toHaveBeenCalled()
  })

  it('keeps visible vault detail pages available', async () => {
    const snapshot = { meta: { isHidden: false } }
    const metadata = { title: 'Visible Vault' }
    mockFetchVaultMetadataSnapshot.mockResolvedValue(snapshot)
    mockBuildVaultMetadataFromInput.mockReturnValue(metadata)

    await expect(generateMetadata(PAGE_PROPS)).resolves.toBe(metadata)
    expect(mockBuildVaultMetadataFromInput).toHaveBeenCalledWith({
      chainID: '1',
      address: '0x7B5A0182E400b241b317e781a4e9dEdFc1429822',
      snapshot
    })
  })
})
