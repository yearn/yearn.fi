# E2E Tests for Widget Components

End-to-end tests for WidgetDepositFinal and WidgetWithdrawFinal using Synpress + Playwright on Polygon mainnet.

## Prerequisites

1. **Funded Test Wallet**
   - Create a new wallet specifically for testing
   - Fund it with:
     - ~0.5 MATIC (for gas fees)
     - ~20 USDC (for deposit tests)
     - ~20 DAI (for Enso zap tests)
   - NEVER use a wallet with real funds

2. **Environment Setup**
   - Copy `.env.e2e.example` to `.env.e2e`
   - Add your test wallet private key to `E2E_PRIVATE_KEY`
   - Update minimum balance requirements if needed

## Setup

```bash
# Install dependencies
npm install

# Install Chromium browser
npx playwright install chromium

# Create .env.e2e file with your test wallet private key
cp .env.e2e.example .env.e2e
# Edit .env.e2e and add your private key
```

## Running Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run in UI mode (interactive)
npm run test:e2e:ui

# Run in debug mode (step-by-step)
npm run test:e2e:debug

# Run only deposit tests
npm run test:e2e -- widget-deposit

# Run only withdraw tests
npm run test:e2e -- widget-withdraw
```

## Test Coverage

### Deposit Tests
- **Vanilla Deposit**: USDC → Vault
- **Enso Deposit**: DAI → Vault (via Enso zap)

### Withdraw Tests
- **Vanilla Withdraw**: Vault → USDC
- **Enso Withdraw**: Vault → DAI (via Enso zap)

## Configuration

### Test Vault
Current test vault: USDC vault on Polygon
- Update `e2e/fixtures/test-vault.ts` if vault changes

### Wallet Requirements
- Minimum MATIC: 0.1 (configurable in `.env.e2e`)
- Minimum USDC: 10 (configurable in `.env.e2e`)
- Minimum DAI: 10 (configurable in `.env.e2e`)

## Troubleshooting

### "Insufficient balance" errors
- Check your test wallet balances
- Fund the wallet with required tokens
- Verify you're on Polygon network

### "Unable to find route" errors
- Enso API might be down
- Token pair might not be supported
- Check network connectivity

### Metamask not connecting
- Tests require headed mode (headless: false)
- Synpress will inject Metamask automatically
- Don't manually interact with Metamask during tests

### Tests timing out
- Polygon RPC might be slow
- Increase timeout in test if needed
- Check network status: https://polygonscan.com/

## Cost Estimate

- Initial funding: ~$10-20
- Per test run: ~$0.50-1.00 in gas fees
- Can run ~20-40 test suites before refilling

## Maintenance

1. Monitor wallet balances (use balance logging)
2. Refill when balances drop below minimums
3. Update vault config if test vault changes
4. Keep Synpress and Playwright updated
