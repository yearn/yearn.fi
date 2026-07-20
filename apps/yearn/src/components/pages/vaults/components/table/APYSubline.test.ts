import { describe, expect, it } from 'vitest'
import { getApySublineLines } from './APYSubline'

describe('getApySublineLines', () => {
  it('returns Kelp + EigenLayer lines when both rewards apply', () => {
    expect(
      getApySublineLines({
        hasPendleArbRewards: false,
        hasKelpNEngenlayer: true,
        hasKelp: false,
        isEligibleForSteer: false,
        steerPointsPerDollar: 0,
        isEligibleForSpectraBoost: false
      })
    ).toEqual(['+1x Kelp Miles', '+1x EigenLayer Points'])
  })

  it('returns single Kelp line', () => {
    expect(
      getApySublineLines({
        hasPendleArbRewards: false,
        hasKelpNEngenlayer: false,
        hasKelp: true,
        isEligibleForSteer: false,
        steerPointsPerDollar: 0,
        isEligibleForSpectraBoost: false
      })
    ).toEqual(['+ 1x Kelp Miles'])
  })

  it('returns ARB line', () => {
    expect(
      getApySublineLines({
        hasPendleArbRewards: true,
        hasKelpNEngenlayer: false,
        hasKelp: false,
        isEligibleForSteer: false,
        steerPointsPerDollar: 0,
        isEligibleForSpectraBoost: false
      })
    ).toEqual(['+ 2500 ARB/week'])
  })

  it('returns eligible for extra rewards when Spectra/Steer applies', () => {
    expect(
      getApySublineLines({
        hasPendleArbRewards: false,
        hasKelpNEngenlayer: false,
        hasKelp: false,
        isEligibleForSteer: true,
        steerPointsPerDollar: 2,
        isEligibleForSpectraBoost: false
      })
    ).toEqual(['Eligible for Extra Rewards'])
  })

  it('returns empty list when no subline data applies', () => {
    expect(
      getApySublineLines({
        hasPendleArbRewards: false,
        hasKelpNEngenlayer: false,
        hasKelp: false,
        isEligibleForSteer: false,
        steerPointsPerDollar: 0,
        isEligibleForSpectraBoost: false
      })
    ).toEqual([])
  })
})
