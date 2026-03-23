import type { Result } from "./types"

export function ok<T>(data: T): Result<T> {
  return { ok: true, data }
}

export function err<T>(error: string): Result<T> {
  return { ok: false, error }
}

export function isOk<T>(result: Result<T>): result is { ok: true; data: T } {
  return result.ok
}

export function isErr<T>(result: Result<T>): result is { ok: false; error: string } {
  return !result.ok
}
