/**
 * Retry Policy with Exponential Backoff
 *
 * Implements automatic retry logic for transient failures with:
 * - Exponential backoff
 * - Jitter to prevent thundering herd
 * - Configurable retry conditions
 * - Rate limit awareness
 *
 * See RUNTIME_CONTRACT.md for full specification.
 */

import { CodegenError, ErrorCategory, shouldRetry as defaultShouldRetry } from "./errors";

/**
 * Retry policy configuration
 */
export interface RetryPolicy {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;

  /** Initial delay in milliseconds (default: 1000) */
  initialDelay?: number;

  /** Maximum delay in milliseconds (default: 30000) */
  maxDelay?: number;

  /** Backoff multiplier (default: 2 for exponential) */
  backoffMultiplier?: number;

  /** Add random jitter to delays (default: true) */
  jitter?: boolean;

  /** Custom function to determine if error should be retried */
  shouldRetry?: (error: CodegenError, attempt: number) => boolean;

  /** Maximum total time for all retries in ms (default: no limit) */
  maxTotalTime?: number;
}

/**
 * Default retry policy
 */
export const DEFAULT_RETRY_POLICY: Required<RetryPolicy> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: true,
  shouldRetry: defaultShouldRetry,
  maxTotalTime: Infinity
};

/**
 * Global retry policy (can be overridden)
 */
let globalRetryPolicy: RetryPolicy = DEFAULT_RETRY_POLICY;

/**
 * Set global retry policy
 *
 * @example
 * ```typescript
 * setRetryPolicy({
 *   maxAttempts: 5,
 *   initialDelay: 500,
 *   maxDelay: 60000
 * });
 * ```
 */
export function setRetryPolicy(policy: RetryPolicy): void {
  globalRetryPolicy = { ...DEFAULT_RETRY_POLICY, ...policy };
}

/**
 * Get current global retry policy
 */
export function getRetryPolicy(): RetryPolicy {
  return globalRetryPolicy;
}

/**
 * Calculate delay for a given attempt using exponential backoff
 *
 * Formula: delay = min(initialDelay * (backoffMultiplier ^ (attempt - 1)), maxDelay)
 * With jitter: delay ± random(25%)
 *
 * @example
 * ```typescript
 * calculateDelay(1, policy) // 1000ms
 * calculateDelay(2, policy) // 2000ms
 * calculateDelay(3, policy) // 4000ms
 * calculateDelay(4, policy) // 8000ms
 * ```
 */
export function calculateDelay(attempt: number, policy: RetryPolicy = globalRetryPolicy): number {
  const {
    initialDelay = DEFAULT_RETRY_POLICY.initialDelay,
    maxDelay = DEFAULT_RETRY_POLICY.maxDelay,
    backoffMultiplier = DEFAULT_RETRY_POLICY.backoffMultiplier,
    jitter = DEFAULT_RETRY_POLICY.jitter
  } = policy;

  // Exponential backoff
  const baseDelay = initialDelay * Math.pow(backoffMultiplier, attempt - 1);

  // Cap at max delay
  const cappedDelay = Math.min(baseDelay, maxDelay);

  // Add jitter if enabled
  if (jitter) {
    // Add ±25% random jitter
    const jitterAmount = cappedDelay * 0.25;
    const randomJitter = (Math.random() - 0.5) * 2 * jitterAmount;
    return Math.max(0, cappedDelay + randomJitter);
  }

  return cappedDelay;
}

/**
 * Sleep for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry an async operation with exponential backoff
 *
 * @param operation - Function to retry
 * @param policy - Retry policy (uses global policy if not provided)
 * @param onRetry - Callback called before each retry attempt
 *
 * @example
 * ```typescript
 * const result = await retryWithBackoff(
 *   async () => {
 *     const response = await fetch("https://api.example.com/data");
 *     if (!response.ok) throw new Error("Failed");
 *     return response.json();
 *   },
 *   { maxAttempts: 5 },
 *   (error, attempt, delay) => {
 *     console.log(`Retry attempt ${attempt} after ${delay}ms: ${error.message}`);
 *   }
 * );
 * ```
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  policy: RetryPolicy = {},
  onRetry?: (error: CodegenError, attempt: number, delay: number) => void
): Promise<T> {
  const mergedPolicy = { ...globalRetryPolicy, ...policy };
  const {
    maxAttempts = DEFAULT_RETRY_POLICY.maxAttempts,
    shouldRetry = DEFAULT_RETRY_POLICY.shouldRetry,
    maxTotalTime = DEFAULT_RETRY_POLICY.maxTotalTime
  } = mergedPolicy;

  const startTime = Date.now();
  let attempt = 0;
  let lastError: CodegenError | undefined;

  while (attempt < maxAttempts) {
    attempt++;

    try {
      return await operation();
    } catch (error) {
      // Wrap unknown errors
      lastError = error instanceof CodegenError
        ? error
        : new CodegenError({
            code: "INTERNAL_ERROR",
            message: error instanceof Error ? error.message : String(error),
            category: ErrorCategory.INTERNAL,
            retryable: false,
            originalError: error instanceof Error ? error : undefined
          });

      // Check if we should retry
      if (attempt >= maxAttempts || !shouldRetry(lastError, attempt)) {
        throw lastError;
      }

      // Check total time limit
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime >= maxTotalTime) {
        throw lastError;
      }

      // Calculate delay
      let delay = calculateDelay(attempt, mergedPolicy);

      // For rate limiting, use server-specified delay
      if (lastError.category === ErrorCategory.RATE_LIMIT && lastError.context?.retryAfter) {
        delay = Math.max(delay, lastError.context.retryAfter as number);
        // Cap rate limit delays at 5 minutes
        delay = Math.min(delay, 300000);
      }

      // Ensure we don't exceed max total time
      const remainingTime = maxTotalTime - elapsedTime;
      delay = Math.min(delay, remainingTime);

      // Notify before retry
      if (onRetry) {
        onRetry(lastError, attempt, delay);
      }

      // Wait before retrying
      await sleep(delay);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError!;
}

/**
 * Retry policy builder for fluent API
 *
 * @example
 * ```typescript
 * const policy = retryPolicy()
 *   .maxAttempts(5)
 *   .initialDelay(500)
 *   .maxDelay(60000)
 *   .exponentialBackoff(3)
 *   .withJitter()
 *   .shouldRetry((error) => error.category === ErrorCategory.TRANSPORT)
 *   .build();
 * ```
 */
export class RetryPolicyBuilder {
  private policy: RetryPolicy = {};

  maxAttempts(attempts: number): this {
    this.policy.maxAttempts = attempts;
    return this;
  }

  initialDelay(ms: number): this {
    this.policy.initialDelay = ms;
    return this;
  }

  maxDelay(ms: number): this {
    this.policy.maxDelay = ms;
    return this;
  }

  exponentialBackoff(multiplier: number): this {
    this.policy.backoffMultiplier = multiplier;
    return this;
  }

  withJitter(enabled = true): this {
    this.policy.jitter = enabled;
    return this;
  }

  shouldRetry(fn: (error: CodegenError, attempt: number) => boolean): this {
    this.policy.shouldRetry = fn;
    return this;
  }

  maxTotalTime(ms: number): this {
    this.policy.maxTotalTime = ms;
    return this;
  }

  build(): RetryPolicy {
    return this.policy;
  }
}

/**
 * Create a retry policy builder
 */
export function retryPolicy(): RetryPolicyBuilder {
  return new RetryPolicyBuilder();
}

/**
 * Preset retry policies for common scenarios
 */
export const RetryPresets = {
  /**
   * No retries
   */
  NONE: {
    maxAttempts: 1
  } as RetryPolicy,

  /**
   * Conservative: Few retries, long delays
   */
  CONSERVATIVE: {
    maxAttempts: 2,
    initialDelay: 5000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitter: true
  } as RetryPolicy,

  /**
   * Aggressive: Many retries, short delays
   */
  AGGRESSIVE: {
    maxAttempts: 5,
    initialDelay: 500,
    maxDelay: 10000,
    backoffMultiplier: 1.5,
    jitter: true
  } as RetryPolicy,

  /**
   * Default: Balanced approach
   */
  DEFAULT: DEFAULT_RETRY_POLICY,

  /**
   * Network optimized: Good for transient network failures
   */
  NETWORK: {
    maxAttempts: 4,
    initialDelay: 1000,
    maxDelay: 20000,
    backoffMultiplier: 2,
    jitter: true,
    shouldRetry: (error) => {
      return error.category === ErrorCategory.TRANSPORT ||
             error.category === ErrorCategory.TIMEOUT ||
             error.category === ErrorCategory.CONNECTION;
    }
  } as RetryPolicy,

  /**
   * Rate limit optimized: Respects server rate limits
   */
  RATE_LIMIT: {
    maxAttempts: 3,
    initialDelay: 60000, // 1 minute
    maxDelay: 300000,    // 5 minutes
    backoffMultiplier: 2,
    jitter: false, // Use exact server-specified delays
    shouldRetry: (error) => {
      return error.category === ErrorCategory.RATE_LIMIT;
    }
  } as RetryPolicy
};
