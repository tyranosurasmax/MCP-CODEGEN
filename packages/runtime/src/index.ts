/**
 * @mcp-codegen/runtime
 * Universal runtime for MCP, REST, and GraphQL tool execution
 */

// Export adapter interface
export type { SourceAdapter } from './adapter';

// Export universal runtime (primary API)
export { call, callTyped, registerAdapter, getAdapter } from './universal-runtime';
export type { CallOptions } from './universal-runtime';

// Export error types and utilities
export * from './errors';

// Export auth resolver
export { resolveAuth } from './auth-resolver';
export type { AuthConfig } from './auth-resolver';

// Export instrumentation
export {
  emitRuntimeEvent,
  onRuntimeEvent,
  offRuntimeEvent,
  recordCallMetric,
  getMetrics,
  getAllMetrics,
  resetMetrics,
  setLogger,
  setLogLevel,
  getLogger,
  LogLevel
} from './instrumentation';
export type { RuntimeEvent, RuntimeEventType, Logger, PerformanceMetrics, EventListener } from './instrumentation';

// Export retry policy
export {
  getRetryPolicy,
  setRetryPolicy,
  calculateDelay,
  sleep,
  retryWithBackoff,
  retryPolicy,
  RetryPolicyBuilder,
  RetryPresets
} from './retry-policy';
export type { RetryPolicy } from './retry-policy';

// Export schema normalizer
export { normalizeSchema } from './schema-normalizer';
