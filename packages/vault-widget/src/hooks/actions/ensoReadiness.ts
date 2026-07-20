export async function refreshEnsoReadiness(
  refetchAllowance: () => Promise<unknown>,
  refetchRoute: () => Promise<unknown>
): Promise<void> {
  await refetchAllowance()
  await refetchRoute()
}
