/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascading failures by failing fast when a service is down
 */

export interface CircuitBreakerOptions {
  failureThreshold: number;  // Number of failures before opening circuit
  successThreshold: number;  // Number of successes needed to close circuit
  timeout: number;          // How long to wait before retrying (ms)
}

export type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  successes: number;
  nextAttempt: number;
}

class CircuitBreaker {
  private options: CircuitBreakerOptions;
  private state: CircuitBreakerState;
  private listeners: Set<(state: CircuitState) => void> = new Set();

  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = {
      failureThreshold: options.failureThreshold ?? 5,
      successThreshold: options.successThreshold ?? 3,
      timeout: options.timeout ?? 30_000,
    };

    this.state = {
      state: 'closed',
      failures: 0,
      successes: 0,
      nextAttempt: 0,
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state.state === 'open') {
      if (Date.now() < this.state.nextAttempt) {
        throw new Error('Circuit breaker is open');
      }
      // Half-open: allow one request through
      this.state.state = 'half-open';
      this.state.successes = 0;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.state.failures = 0;

    if (this.state.state === 'half-open') {
      this.state.successes++;
      if (this.state.successes >= this.options.successThreshold) {
        this.transitionTo('closed');
      }
    }
  }

  private onFailure(): void {
    this.state.failures++;

    if (this.state.state === 'half-open') {
      this.transitionTo('open');
    } else if (this.state.failures >= this.options.failureThreshold) {
      this.transitionTo('open');
    }
  }

  private transitionTo(newState: CircuitState): void {
    this.state.state = newState;
    
    if (newState === 'open') {
      this.state.nextAttempt = Date.now() + this.options.timeout;
    }

    // Notify listeners
    for (const listener of this.listeners) {
      listener(newState);
    }
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state.state;
  }

  /**
   * Subscribe to state changes
   */
  onStateChange(listener: (state: CircuitState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Reset the circuit breaker
   */
  reset(): void {
    this.state = {
      state: 'closed',
      failures: 0,
      successes: 0,
      nextAttempt: 0,
    };
  }
}

// Pre-configured circuit breakers for external services
export const polymarketBreaker = new CircuitBreaker({
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 30_000,
});

export const valyuBreaker = new CircuitBreaker({
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60_000,
});

export const twitterBreaker = new CircuitBreaker({
  failureThreshold: 3,
  successThreshold: 2,
  timeout: 60_000,
});

/**
 * Execute with circuit breaker protection
 */
export async function withCircuitBreaker<T>(
  breaker: CircuitBreaker,
  fn: () => Promise<T>
): Promise<T> {
  return breaker.execute(fn);
}
