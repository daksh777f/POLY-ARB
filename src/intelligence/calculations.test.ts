import { describe, it, expect } from 'vitest'
import { calculateNetEV, estimateCosts, evToConfidence, kellyFraction } from './calculations'

describe('EV Calculations', () => {
  describe('calculateNetEV', () => {
    it('should calculate positive EV when LLM estimate > market price', () => {
      const result = calculateNetEV({
        llmEstimate: 0.7,
        marketPrice: 0.5,
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
        liquidity: 100000,
      })

      expect(result.pHat).toBeGreaterThan(result.pHatLB)
      expect(result.evGross).toBeGreaterThan(0)
      expect(result.direction).toBe('yes')
    })

    it('should calculate negative EV when LLM estimate < market price', () => {
      const result = calculateNetEV({
        llmEstimate: 0.3,
        marketPrice: 0.6,
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        liquidity: 100000,
      })

      expect(result.evGross).toBeLessThan(0)
      expect(result.direction).toBe('no')
    })

    it('should apply conservative lower bound (pHatLB)', () => {
      const result = calculateNetEV({
        llmEstimate: 0.8,
        marketPrice: 0.4,
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        liquidity: 100000,
      })

      // pHatLB should be more conservative (closer to market price)
      expect(result.pHatLB).toBeLessThan(result.pHat)
      expect(result.evNetLB).toBeLessThan(result.evNet)
    })

    it('should mark as tradeable when lower bound EV is positive', () => {
      const result = calculateNetEV({
        llmEstimate: 0.9,
        marketPrice: 0.3,
        endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days
        liquidity: 1000000, // high liquidity = low slippage
      })

      expect(result.tradeable).toBe(true)
    })

    it('should not trade when costs exceed EV', () => {
      const result = calculateNetEV({
        llmEstimate: 0.55,
        marketPrice: 0.5,
        endDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day (high resolution risk)
        liquidity: 5000, // low liquidity = high slippage
      })

      expect(result.tradeable).toBe(false)
      expect(result.costs.total).toBeGreaterThan(result.evGross)
    })

    it('should clamp probabilities between 0 and 1', () => {
      const result1 = calculateNetEV({
        llmEstimate: 1.0, // edge case
        marketPrice: 0.5,
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        liquidity: 100000,
      })

      expect(result1.pHat).toBeLessThan(1)
      expect(result1.pHat).toBeGreaterThan(0)

      const result2 = calculateNetEV({
        llmEstimate: 0.0, // edge case
        marketPrice: 0.5,
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        liquidity: 100000,
      })

      expect(result2.pHat).toBeGreaterThan(0)
      expect(result2.pHat).toBeLessThan(1)
    })
  })

  describe('estimateCosts', () => {
    it('should estimate higher costs for low liquidity', () => {
      const lowLiqCosts = estimateCosts(5000, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString())
      const highLiqCosts = estimateCosts(500000, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString())

      expect(lowLiqCosts.slippage).toBeGreaterThan(highLiqCosts.slippage)
    })

    it('should estimate higher resolution risk near expiry', () => {
      const soonCosts = estimateCosts(100000, new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()) // 12 hours
      const laterCosts = estimateCosts(100000, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()) // 30 days

      expect(soonCosts.resolutionRisk).toBeGreaterThan(laterCosts.resolutionRisk)
    })

    it('should return valid cost breakdown', () => {
      const costs = estimateCosts(100000, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString())

      expect(costs).toHaveProperty('fee')
      expect(costs).toHaveProperty('slippage')
      expect(costs).toHaveProperty('latencyDecay')
      expect(costs).toHaveProperty('resolutionRisk')
      expect(costs).toHaveProperty('total')

      expect(costs.total).toBe(costs.fee + costs.slippage + costs.latencyDecay + costs.resolutionRisk)
    })
  })

  describe('evToConfidence', () => {
    it('should return high confidence for EV >= 0.15', () => {
      expect(evToConfidence(0.15)).toBe('high')
      expect(evToConfidence(0.20)).toBe('high')
      expect(evToConfidence(0.50)).toBe('high')
    })

    it('should return medium confidence for EV between 0.08 and 0.15', () => {
      expect(evToConfidence(0.08)).toBe('medium')
      expect(evToConfidence(0.10)).toBe('medium')
      expect(evToConfidence(0.14)).toBe('medium')
    })

    it('should return low confidence for EV < 0.08', () => {
      expect(evToConfidence(0.01)).toBe('low')
      expect(evToConfidence(0.05)).toBe('low')
      expect(evToConfidence(0.07)).toBe('low')
    })

    it('should work with negative EV', () => {
      expect(evToConfidence(-0.15)).toBe('high')
      expect(evToConfidence(-0.08)).toBe('medium')
      expect(evToConfidence(-0.05)).toBe('low')
    })
  })

  describe('kellyFraction', () => {
    it('should return 0 for no edge', () => {
      const kelly = kellyFraction(0.5, 0.5) // no edge
      expect(kelly).toBe(0)
    })

    it('should return positive fraction for positive edge', () => {
      const kelly = kellyFraction(0.7, 0.5) // positive edge
      expect(kelly).toBeGreaterThan(0)
    })

    it('should cap at 1 (100% of portfolio)', () => {
      const kelly = kellyFraction(1.0, 0.1) // very high edge
      expect(kelly).toBeLessThanOrEqual(1)
    })

    it('should apply fractional Kelly (lambda = 0.5)', () => {
      const fullKelly = (0.7 * 2 - 1) // 0.4
      const fracKelly = fullKelly * 0.5 // 0.2
      const kelly = kellyFraction(0.7, 0.5)
      expect(kelly).toBeCloseTo(fracKelly)
    })
  })
})
