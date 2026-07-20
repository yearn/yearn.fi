export function isProtectedEnsoTransactionStepEnabled({
  canExecute,
  prepareEnabled
}: {
  canExecute: boolean
  prepareEnabled: boolean
}): boolean {
  return canExecute && prepareEnabled
}
