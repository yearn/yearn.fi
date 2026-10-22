'use client'

import type { TAccountActivity } from '@yearn/site-header/account'
import { createContext, useContext } from 'react'

export const WalletActivityContext = createContext<(TAccountActivity & { ownerAddress?: string })[]>([])
export const useWalletActivity = () => useContext(WalletActivityContext)
