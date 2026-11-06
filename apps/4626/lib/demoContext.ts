'use client'

import type { createDemoWallet } from '@erc4626/lib/demoWallet'
import { createContext } from 'react'

export const DemoContext = createContext(false)
export const DemoWalletContext = createContext<ReturnType<typeof createDemoWallet> | undefined>(undefined)
