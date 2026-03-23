import { describe, it, expect } from 'vitest'
import { ok, err, isOk, isErr } from './result'

describe('Result<T>', () => {
  describe('ok()', () => {
    it('should create an ok result with data', () => {
      const result = ok<{ value: number }>({ value: 42 })
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data).toEqual({ value: 42 })
      }
    })

    it('should work with primitive types', () => {
      const numResult = ok(42)
      expect(numResult.ok).toBe(true)
      if (numResult.ok) {
        expect(numResult.data).toBe(42)
      }

      const strResult = ok('hello')
      expect(strResult.ok).toBe(true)
      if (strResult.ok) {
        expect(strResult.data).toBe('hello')
      }

      const boolResult = ok(true)
      expect(boolResult.ok).toBe(true)
    })
  })

  describe('err()', () => {
    it('should create an error result with message', () => {
      const result = err<string>('Something went wrong')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe('Something went wrong')
      }
    })
  })

  describe('isOk()', () => {
    it('should return true for ok results', () => {
      const result = ok({ data: 123 })
      expect(isOk(result)).toBe(true)
    })

    it('should return false for error results', () => {
      const result = err('error message')
      expect(isOk(result)).toBe(false)
    })

    it('should narrow the type in conditional', () => {
      const result = ok(42)
      if (isOk(result)) {
        expect(result.data * 2).toBe(84)
      }
    })
  })

  describe('isErr()', () => {
    it('should return false for ok results', () => {
      const result = ok({ data: 123 })
      expect(isErr(result)).toBe(false)
    })

    it('should return true for error results', () => {
      const result = err('error message')
      expect(isErr(result)).toBe(true)
    })

    it('should narrow the type in conditional', () => {
      const result = err('failed')
      if (isErr(result)) {
        expect(result.error).toBe('failed')
      }
    })
  })
})
