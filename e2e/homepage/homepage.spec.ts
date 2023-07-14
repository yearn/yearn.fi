/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable unused-imports/no-unused-vars */
import {expect, test} from '@playwright/test';

test.describe('Home page', (): void => {
	test.beforeEach(async ({page}): Promise<void> => {
		await page.goto('/');
	});

	test('has all apps', async ({page}): Promise<void> => {
		const vaultsAppBox = page.getByTestId('app-box-vaults');
		const ycrvAppBox = page.getByTestId('app-box-ycrv');
		const veyfiAppBox = page.getByTestId('app-box-veyfi');
		const ybribeAppBox = page.getByTestId('app-box-ybribe');
	
		await expect(vaultsAppBox).toBeVisible();
		await expect(ycrvAppBox).toBeVisible();
		await expect(veyfiAppBox).toBeVisible();
		await expect(ybribeAppBox).toBeVisible();
	
		await vaultsAppBox.click();
		await expect(page).toHaveTitle('Yearn Vaults');

		await page.goto('/');
	
		await ycrvAppBox.click();
		await expect(page).toHaveTitle('yCRV');

		await page.goto('/');
	
		await veyfiAppBox.click();
		await expect(page).toHaveTitle('veYFI');

		await page.goto('/');
	
		await ybribeAppBox.click();
		await expect(page).toHaveTitle('yBribe');
	});

	test('has functional connect wallet button', async ({page}): Promise<void> => {
		const connectWalletButton = page.getByText('Connect wallet');

		await expect(connectWalletButton).toBeVisible();

		await connectWalletButton.click();

		await expect(page.getByText('Connect your wallet')).toBeVisible();
		
		await expect(page.getByText('Select your wallet from the options to get started')).toBeVisible();

		const loginOptions = page.locator('.yearn--modalLogin-card');

		expect(await loginOptions.count()).toBe(2);

		const allLoginOptions = await loginOptions.all();

		expect(await allLoginOptions[0].innerText()).toBe('Frame');
		
		expect(await allLoginOptions[1].innerText()).toBe('WalletConnect');
	});	

	test.skip('has functional network switch', async ({page}): Promise<void> => {});

	test.skip('has functional bug/feature report button', async ({page}): Promise<void> => {});

	test.skip('has all external links visible', async ({page}): Promise<void> => {});
});
