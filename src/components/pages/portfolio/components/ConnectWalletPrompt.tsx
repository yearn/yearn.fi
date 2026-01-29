import { Button } from '@shared/components/Button'
import type { ReactElement } from 'react'

type TConnectWalletPromptProps = {
  title: string
  description: string
  buttonText?: string
  onConnect: () => void
}

export function ConnectWalletPrompt({
  title,
  description,
  buttonText = 'Connect wallet',
  onConnect
}: TConnectWalletPromptProps): ReactElement {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-4 py-12 text-center sm:px-6 sm:py-16">
      <p className="text-base font-semibold text-text-primary sm:text-lg">{title}</p>
      <p className="max-w-md text-sm text-text-secondary">{description}</p>
      <Button onClick={onConnect} variant="filled" className="min-h-[44px] px-6">
        {buttonText}
      </Button>
    </div>
  )
}
