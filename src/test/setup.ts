import { beforeAll, afterAll, afterEach, vi, expect } from 'vitest'

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock React Query
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn().mockReturnValue({
    data: undefined,
    isLoading: false,
    error: null,
  }),
  useMutation: vi.fn().mockReturnValue({
    mutate: vi.fn(),
    isLoading: false,
  }),
  QueryClient: vi.fn().mockImplementation(() => ({
    setQueryData: vi.fn(),
    getQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
  })),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => children,
  keepPreviousData: { placeholder: true },
}))

// Mock fetch globally
global.fetch = vi.fn()

// Console error/warn spy for testing
let consoleErrorSpy: ReturnType<typeof vi.spyOn>
let consoleWarnSpy: ReturnType<typeof vi.spyOn>

beforeAll(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  consoleErrorSpy?.mockClear()
  consoleWarnSpy?.mockClear()
  vi.clearAllMocks()
})

afterAll(() => {
  consoleErrorSpy?.mockRestore()
  consoleWarnSpy?.mockRestore()
})

// Extend expect with custom matchers for Result<T> type
expect.extend({
  toBeOkResult(received: unknown) {
    const result = received as { ok?: boolean }
    if (result && result.ok === true) {
      return {
        pass: true,
        message: () => 'Expected result not to be ok',
      }
    }
    return {
      pass: false,
      message: () => `Expected result to be ok, got ${JSON.stringify(received)}`,
    }
  },
  toBeErrorResult(received: unknown) {
    const result = received as { ok?: boolean; error?: string }
    if (result && result.ok === false && result.error) {
      return {
        pass: true,
        message: () => 'Expected result not to be error',
      }
    }
    return {
      pass: false,
      message: () => `Expected result to be error, got ${JSON.stringify(received)}`,
    }
  },
})
