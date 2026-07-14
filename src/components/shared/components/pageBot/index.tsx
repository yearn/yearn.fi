'use client'

import { cl } from '@shared/utils'
import type { PageAgent } from 'page-agent'
import type { ReactElement } from 'react'
import { useState } from 'react'
import { env } from '@/env'
import { getPageInstructions, SYSTEM_INSTRUCTIONS } from './instructions'

const GUARD_SELECTOR = '[data-page-bot-guard]'

// Module-level holder: AppProviders remounts on cross-segment navigation, but the
// page-agent panel is appended to document.body and must only ever exist once.
const agentHolder: { current: Promise<PageAgent> | null } = { current: null }

async function loadAgent(): Promise<PageAgent> {
  const { PageAgent: PageAgentImpl } = await import('page-agent')

  const agent = new PageAgentImpl({
    baseURL: '/api/agent/llm',
    model: 'yearn-page-bot-proxy',
    language: 'en-US',
    maxSteps: 25,
    instructions: {
      system: SYSTEM_INSTRUCTIONS,
      getPageInstructions
    }
  })

  // page-agent only honors data-page-agent-not-interactive on the exact element,
  // so stamp every descendant of guarded containers right before each DOM extraction
  agent.pageController.addEventListener('beforeUpdate', () => {
    document.querySelectorAll(`${GUARD_SELECTOR}, ${GUARD_SELECTOR} *`).forEach((element) => {
      element.setAttribute('data-page-agent-not-interactive', '')
    })
  })

  return agent
}

export function PageBot(): ReactElement | null {
  const [isLoading, setIsLoading] = useState(false)

  if (env.NEXT_PUBLIC_PAGE_BOT !== 'true') {
    return null
  }

  const handleOpen = async (): Promise<void> => {
    setIsLoading(true)
    try {
      if (!agentHolder.current) {
        agentHolder.current = loadAgent()
      }
      const agent = await agentHolder.current
      agent.panel.show()
    } catch (error) {
      agentHolder.current = null
      console.error('Failed to start PageBot:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleOpen}
      disabled={isLoading}
      aria-label="Open PageBot assistant"
      className={cl(
        'fixed z-50 bottom-20 left-4 md:bottom-6 md:left-6 h-12 px-4 rounded-full',
        'bg-surface border border-border',
        'flex items-center justify-center gap-2',
        'shadow-lg transition-all duration-200',
        'hover:bg-surface-secondary active:scale-95',
        'text-text-primary text-sm font-medium',
        { 'opacity-60': isLoading }
      )}
    >
      <span aria-hidden={true}>{'✦'}</span>
      {isLoading ? 'Loading…' : 'PageBot'}
    </button>
  )
}
