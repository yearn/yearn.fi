import { EarnHeader } from '@/components/earn/EarnHeader'
import { DepositWidget } from '@/components/ytranche/DepositWidget'

export function RetailEarn() {
  return (
    <div className="ytranche-app">
      <EarnHeader />
      <main className="ytranche-main">
        <h1 className="sr-only">yTranche 2</h1>
        <DepositWidget />
      </main>
    </div>
  )
}
