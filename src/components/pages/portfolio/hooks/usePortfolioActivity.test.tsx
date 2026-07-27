// @vitest-environment jsdom

import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePortfolioActivity } from './usePortfolioActivity'

vi.mock('@shared/contexts/useWeb3', () => ({
  useWeb3: () => ({ address: '0x1111111111111111111111111111111111111111' })
}))

vi.mock('@shared/hooks/useFetch', () => ({
  fetchWithSchema: vi.fn()
}))

vi.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: vi.fn(),
  useQuery: vi.fn()
}))

const useInfiniteQueryMock = vi.mocked(useInfiniteQuery)
const useQueryMock = vi.mocked(useQuery)

describe('usePortfolioActivity', () => {
  beforeEach(() => {
    useInfiniteQueryMock.mockReturnValue({
      data: {
        pages: [
          {
            entries: [{ chainId: 137 }, { chainId: 1 }, { chainId: 137 }]
          }
        ]
      },
      error: null,
      fetchNextPage: vi.fn(),
      hasNextPage: true,
      isFetching: false,
      isFetchingNextPage: false,
      isLoading: false
    } as unknown as ReturnType<typeof useInfiniteQuery>)
    useQueryMock.mockReturnValue({ data: undefined } as unknown as ReturnType<typeof useQuery>)
  })

  it('keeps fallback activity chain IDs stable while facets are loading', () => {
    const results: Array<ReturnType<typeof usePortfolioActivity>> = []

    function Probe(): ReactElement | null {
      results.push(usePortfolioActivity())
      return null
    }

    const view = render(<Probe />)
    view.rerender(<Probe />)

    expect(results[0]?.availableChainIds).toEqual([1, 137])
    expect(results[1]?.availableChainIds).toBe(results[0]?.availableChainIds)
  })
})
