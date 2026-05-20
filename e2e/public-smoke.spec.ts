import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

test.describe('public smoke paths', () => {
  const vaultSearch = (page: Page) => page.getByRole('textbox', { name: 'Find a Vault' })

  test('landing page can navigate into vaults', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveTitle(/Yearn/i)
    await expect(page.getByRole('link', { name: /Explore Vaults/i }).first()).toBeVisible()

    await page
      .getByRole('link', { name: /Explore Vaults/i })
      .first()
      .click()

    await expect(page).toHaveURL(/\/vaults/)
    await expect(vaultSearch(page)).toBeVisible()
  })

  test('vaults page exposes search and vault rows', async ({ page }) => {
    await page.goto('/vaults')

    await expect(vaultSearch(page)).toBeVisible()
    await expect(page.getByText(/Vault|APY|TVL/i).first()).toBeVisible()
  })

  test('portfolio page loads without a connected wallet', async ({ page }) => {
    await page.goto('/portfolio')

    await expect(page).toHaveURL(/\/portfolio/)
    await expect(page.getByText(/Portfolio|Connect|Wallet/i).first()).toBeVisible()
  })
})
