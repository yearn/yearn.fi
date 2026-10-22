import { CONTRACTS, DISPLAY_RECEIVER, readProtocolData, TOKEN_DECIMALS, WITHDRAW_MAX_LOSS_BPS } from '@/lib/ethereum'

export const dynamic = 'force-dynamic'

const governanceUrl = 'https://gov.yearn.fi/t/yip-91-ytranche/14659'
const governanceVoteUrl =
  'https://snapshot.box/#/s:styfi.eth/proposal/0xa348d353b66f46c6957a938a42fbf860eaffc855cd9163d8042780f65ea72612'
const auditUrl = 'https://www.chainsecurity.com/security-audit/yearn-ytranche'
const auditReportUrl = 'https://reports.chainsecurity.com/Yearn/ChainSecurity_Yearn_ytranche_Audit.pdf'

export async function GET() {
  const result = await readProtocolData()
    .then((protocol) => ({ protocol, readError: null }))
    .catch((error: unknown) => ({
      protocol: null,
      readError: error instanceof Error ? error.message : 'Live Ethereum read failed'
    }))
  const { protocol, readError } = result

  const subordinateAssets = protocol ? protocol.leveredAssets + protocol.equityAssets : null
  const totalTrancheAssets = protocol && subordinateAssets !== null ? protocol.trancheAssets + subordinateAssets : null
  const subordinateShareOfTotalBps =
    protocol && subordinateAssets !== null && totalTrancheAssets && totalTrancheAssets > 0n
      ? (subordinateAssets * 10_000n) / totalTrancheAssets
      : null

  return Response.json(
    {
      schema_version: '1.3.0',
      product_id: 'yearn-ytranche-usd-senior-ethereum',
      name: 'yTranche USD Fixed',
      status: 'deployed',
      data_status: protocol ? 'available' : 'unavailable',
      generated_at: new Date().toISOString(),
      network: { name: 'Ethereum', chain_id: 1 },
      deposit_asset: {
        symbol: 'USDC',
        address: CONTRACTS.usdc,
        decimals: TOKEN_DECIMALS
      },
      position_token: {
        symbol: 'yvUSD-A',
        standard: 'ERC-4626',
        address: CONTRACTS.fixed,
        decimals: TOKEN_DECIMALS
      },
      return_profile: {
        kind: 'configurable_target',
        target_rate_bps: protocol?.targetRateBps.toString() ?? null,
        target_rate_guaranteed: false,
        realized_apy_bps: null,
        realized_apy_note: 'Not published by this prototype; never inferred from the target rate.',
        excess_profit_share_bps: protocol?.excessShareBps.toString() ?? null,
        accrual_paused: protocol?.accrualPaused ?? null
      },
      term: {
        fixed_term: false,
        maturity_date: null,
        tranche_withdrawal_cooldown_seconds: 0
      },
      liquidity: {
        tranche_cooldown: false,
        note: 'Redemption remains subject to underlying vault liquidity and queueing. This interface requires the strategy to deliver its current share value in full.'
      },
      withdrawal_execution: {
        kind: 'direct_withdraw_or_redeem',
        input_asset: 'yvUSD-A',
        output_asset: 'USDC',
        approval_required_when_owner_is_caller: false,
        max_redeem_method: 'maxRedeem(address)',
        preview_method: 'previewRedeem(uint256)',
        transaction_methods: ['withdraw(uint256,address,address,uint256)', 'redeem(uint256,address,address,uint256)'],
        configured_max_loss_bps: WITHDRAW_MAX_LOSS_BPS.toString(),
        note: 'The shared Yearn widget uses explicit four-argument withdraw/redeem overloads with maxLoss set to zero.'
      },
      loss_priority: ['reserve_if_configured', 'equity', 'levered', 'senior'],
      risk: {
        principal_guaranteed: false,
        reserve_status: 'not_read_by_interface',
        reserve_note:
          'The controller supports an optional reserve, but this endpoint does not verify its current configuration or balance.',
        summary:
          'Equity and Levered absorb losses before Senior. If subordinated capital is exhausted, Senior may lose principal.'
      },
      governance: {
        yip: 91,
        status: 'approved',
        specification_url: governanceUrl,
        vote_url: governanceVoteUrl,
        vote_closed_at: '2026-07-18T19:18:59Z'
      },
      security_assessment: {
        auditor: 'ChainSecurity',
        status: 'published',
        report_date: '2026-07-15',
        reviewed_commit: '58182cf41f38aa86365942a23af4876fbd76fca2',
        scope: ['TrancheStrategy', 'LockedTrancheStrategy', 'TrancheController', 'Hook', 'Authorizer'],
        assessment_url: auditUrl,
        report_url: auditReportUrl,
        findings: { critical: 0, high: 0, medium: 0, low: 5, informational: 17 },
        note: 'The assessment is time-boxed and does not guarantee the absence of vulnerabilities. Review its scope, exclusions, and accepted risks.'
      },
      live_onchain: protocol
        ? {
            block_number: protocol.blockNumber.toString(),
            units: 'base units; divide token amounts by 10^deposit_asset.decimals',
            senior_assets: protocol.trancheAssets.toString(),
            levered_assets: protocol.leveredAssets.toString(),
            equity_assets: protocol.equityAssets.toString(),
            subordinate_assets: subordinateAssets?.toString() ?? null,
            subordinate_share_of_total_bps: subordinateShareOfTotalBps?.toString() ?? null,
            subordinate_share_formula:
              '(levered_assets + equity_assets) / (senior_assets + levered_assets + equity_assets)',
            deposit_capacity: {
              status: protocol.maxDeposit > 0n ? 'available_for_reference_receiver' : 'closed_for_reference_receiver',
              max_deposit_for_reference_receiver: protocol.maxDeposit.toString(),
              reference_receiver: DISPLAY_RECEIVER,
              note: 'ERC-4626 maxDeposit may be receiver-specific; query the Fixed contract for the intended allocator address before execution.'
            },
            controller_claim: protocol.coverageClaim.toString(),
            controller_covered: protocol.coverageCovered.toString()
          }
        : null,
      contracts: {
        fixed: CONTRACTS.fixed,
        levered: CONTRACTS.levered,
        equity: CONTRACTS.equity,
        controller: CONTRACTS.controller,
        hook: CONTRACTS.hook,
        underlying_vault: CONTRACTS.vault
      },
      primary_sources: [
        { type: 'governance_specification', url: governanceUrl },
        { type: 'governance_approval', url: governanceVoteUrl },
        { type: 'security_assessment', url: auditUrl },
        { type: 'security_assessment_report', url: auditReportUrl },
        { type: 'verified_contract', url: `https://etherscan.io/address/${CONTRACTS.fixed}#code` },
        {
          type: 'verified_controller',
          url: `https://etherscan.io/address/${CONTRACTS.controller}#code`
        }
      ],
      interface: {
        capabilities: [
          'wallet_connect',
          'exact_amount_approval',
          'deposit',
          'direct_redeem',
          'onchain_deposit_preview',
          'onchain_redeem_preview'
        ],
        limitations: [
          'USDC-only direct execution; no zaps or token routing',
          'no custody-provider integration',
          'a published security assessment does not eliminate smart-contract risk'
        ]
      },
      data_error: readError
    },
    {
      headers: {
        'access-control-allow-origin': '*',
        'cache-control': 'no-store'
      }
    }
  )
}
