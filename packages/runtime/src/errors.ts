/**
 * Standardized Error Handling for Universal Runtime
 *
 * This module defines error shapes, categories, and codes as specified
 * in RUNTIME_CONTRACT.md
 */

/**
 * Error categories for standardized error handling
 */
export enum ErrorCategory {
  /** Configuration errors (not retryable) */
  CONFIG = "CONFIG",

  /** Parameter validation failed (not retryable) */
  VALIDATION = "VALIDATION",

  /** Tool discovery failed (retryable with backoff) */
  DISCOVERY = "DISCOVERY",

  /** Connection to source failed (retryable) */
  CONNECTION = "CONNECTION",

  /** Tool execution failed (retryable based on code) */
  EXECUTION = "EXECUTION",

  /** Request timed out (retryable) */
  TIMEOUT = "TIMEOUT",

  /** Network/transport failure (retryable) */
  TRANSPORT = "TRANSPORT",

  /** Authentication failed (not retryable without refresh) */
  AUTH = "AUTH",

  /** Rate limit exceeded (retryable with delay) */
  RATE_LIMIT = "RATE_LIMIT",

  /** Unexpected internal error (not retryable) */
  INTERNAL = "INTERNAL"
}

/**
 * Standard error codes
 */
export const ErrorCode = {
  // Configuration
  TOOL_NOT_FOUND: "TOOL_NOT_FOUND",
  INVALID_CONFIG: "INVALID_CONFIG",

  // Validation
  INVALID_PARAMS: "INVALID_PARAMS",
  SCHEMA_VALIDATION_FAILED: "SCHEMA_VALIDATION_FAILED",

  // Connection
  SOURCE_UNREACHABLE: "SOURCE_UNREACHABLE",
  MCP_PROCESS_DIED: "MCP_PROCESS_DIED",
  CONNECTION_TIMEOUT: "CONNECTION_TIMEOUT",

  // Execution
  EXECUTION_FAILED: "EXECUTION_FAILED",
  TIMEOUT: "TIMEOUT",

  // Transport
  NETWORK_ERROR: "NETWORK_ERROR",
  HTTP_ERROR_4XX: "HTTP_ERROR_4XX",
  HTTP_ERROR_5XX: "HTTP_ERROR_5XX",

  // Auth
  AUTH_FAILED: "AUTH_FAILED",
  AUTH_TOKEN_EXPIRED: "AUTH_TOKEN_EXPIRED",
  AUTH_MISSING: "AUTH_MISSING",

  // Rate limiting
  RATE_LIMITED: "RATE_LIMITED",

  // Internal
  INTERNAL_ERROR: "INTERNAL_ERROR",
  NOT_IMPLEMENTED: "NOT_IMPLEMENTED"
} as const;

export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode];

/**
 * Options for creating a CodegenError
 */
export interface CodegenErrorOptions {
  /** Error code (e.g., "TOOL_NOT_FOUND") */
  code: string;

  /** Human-readable error message */
  message: string;

  /** Error category for handling logic */
  category: ErrorCategory;

  /** Whether this error is retryable */
  retryable?: boolean;

  /** Original error that caused this */
  originalError?: Error;

  /** Additional context (params, response, etc.) */
  context?: Record<string, unknown>;
}

/**
 * Standardized error class for all runtime errors
 *
 * All errors thrown by the runtime conform to this shape.
 * See RUNTIME_CONTRACT.md for full specification.
 *
 * @example
 * ```typescript
 * throw new CodegenError({
 *   code: "TOOL_NOT_FOUND",
 *   message: "Tool 'github__invalid' not found",
 *   category: ErrorCategory.CONFIG,
 *   retryable: false,
 *   context: { toolName: "github__invalid" }
 * });
 * ```
 */
export class CodegenError extends Error {
  /** Error code for programmatic handling */
  readonly code: string;

  /** Error category (CONFIG, VALIDATION, etc.) */
  readonly category: ErrorCategory;

  /** Whether this error should be retried */
  readonly retryable: boolean;

  /** Original error if this wraps another error */
  readonly originalError?: Error;

  /** Additional context for debugging */
  readonly context?: Record<string, unknown>;

  constructor(options: CodegenErrorOptions) {
    super(options.message);
    this.name = "CodegenError";
    this.code = options.code;
    this.category = options.category;
    this.retryable = options.retryable ?? this.isRetryableByDefault(options.category);
    this.originalError = options.originalError;
    this.context = options.context;

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CodegenError);
    }
  }

  /**
   * Determine default retryability based on category
   */
  private isRetryableByDefault(category: ErrorCategory): boolean {
    switch (category) {
      case ErrorCategory.TRANSPORT:
      case ErrorCategory.TIMEOUT:
      case ErrorCategory.CONNECTION:
      case ErrorCategory.RATE_LIMIT:
        return true;

      case ErrorCategory.CONFIG:
      case ErrorCategory.VALIDATION:
      case ErrorCategory.AUTH:
      case ErrorCategory.INTERNAL:
        return false;

      case ErrorCategory.EXECUTION:
      case ErrorCategory.DISCOVERY:
        return false; // Depends on specific error

      default:
        return false;
    }
  }

  /**
   * Convert error to JSON for logging/serialization
   */
  toJSON(): object {
    return {
      name: this.name,
      code: this.code,
      category: this.category,
      message: this.message,
      retryable: this.retryable,
      context: this.context,
      stack: this.stack,
      originalError: this.originalError ? {
        name: this.originalError.name,
        message: this.originalError.message,
        stack: this.originalError.stack
      } : undefined
    };
  }

  /**
   * Create human-readable string representation
   */
  toString(): string {
    let str = `${this.name} [${this.code}]: ${this.message}`;
    if (this.context) {
      str += `\nContext: ${JSON.stringify(this.context, null, 2)}`;
    }
    if (this.originalError) {
      str += `\nCaused by: ${this.originalError.message}`;
    }
    return str;
  }
}

/**
 * Factory functions for common error types
 */

export function toolNotFoundError(toolName: string): CodegenError {
  return new CodegenError({
    code: ErrorCode.TOOL_NOT_FOUND,
    message: `Tool '${toolName}' not found`,
    category: ErrorCategory.CONFIG,
    retryable: false,
    context: { toolName }
  });
}

export function invalidParamsError(details: string, context?: Record<string, unknown>): CodegenError {
  return new CodegenError({
    code: ErrorCode.INVALID_PARAMS,
    message: `Invalid parameters: ${details}`,
    category: ErrorCategory.VALIDATION,
    retryable: false,
    context
  });
}

export function authFailedError(source: string, reason?: string): CodegenError {
  return new CodegenError({
    code: ErrorCode.AUTH_FAILED,
    message: `Authentication failed for source '${source}'${reason ? `: ${reason}` : ''}`,
    category: ErrorCategory.AUTH,
    retryable: false,
    context: { source, reason }
  });
}

export function rateLimitError(source: string, retryAfter?: number): CodegenError {
  return new CodegenError({
    code: ErrorCode.RATE_LIMITED,
    message: `Rate limit exceeded for '${source}'${retryAfter ? `. Retry after ${retryAfter}ms` : ''}`,
    category: ErrorCategory.RATE_LIMIT,
    retryable: true,
    context: { source, retryAfter }
  });
}

export function networkError(message: string, originalError?: Error): CodegenError {
  return new CodegenError({
    code: ErrorCode.NETWORK_ERROR,
    message: `Network error: ${message}`,
    category: ErrorCategory.TRANSPORT,
    retryable: true,
    originalError
  });
}

export function timeoutError(operation: string, timeoutMs: number): CodegenError {
  return new CodegenError({
    code: ErrorCode.TIMEOUT,
    message: `Operation '${operation}' timed out after ${timeoutMs}ms`,
    category: ErrorCategory.TIMEOUT,
    retryable: true,
    context: { operation, timeoutMs }
  });
}

export function executionError(toolName: string, message: string, originalError?: Error): CodegenError {
  return new CodegenError({
    code: ErrorCode.EXECUTION_FAILED,
    message: `Execution failed for '${toolName}': ${message}`,
    category: ErrorCategory.EXECUTION,
    retryable: false,
    originalError,
    context: { toolName }
  });
}

export function httpError(status: number, statusText: string, url: string): CodegenError {
  const is5xx = status >= 500 && status < 600;

  return new CodegenError({
    code: is5xx ? ErrorCode.HTTP_ERROR_5XX : ErrorCode.HTTP_ERROR_4XX,
    message: `HTTP ${status} ${statusText}: ${url}`,
    category: ErrorCategory.EXECUTION,
    retryable: is5xx, // Retry server errors, not client errors
    context: { status, statusText, url }
  });
}

export function connectionError(source: string, reason: string, originalError?: Error): CodegenError {
  return new CodegenError({
    code: ErrorCode.SOURCE_UNREACHABLE,
    message: `Cannot connect to source '${source}': ${reason}`,
    category: ErrorCategory.CONNECTION,
    retryable: true,
    originalError,
    context: { source, reason }
  });
}

export function mcpProcessDiedError(source: string, exitCode?: number): CodegenError {
  return new CodegenError({
    code: ErrorCode.MCP_PROCESS_DIED,
    message: `MCP process for '${source}' died${exitCode !== undefined ? ` with code ${exitCode}` : ''}`,
    category: ErrorCategory.CONNECTION,
    retryable: true,
    context: { source, exitCode }
  });
}

export function internalError(message: string, originalError?: Error): CodegenError {
  return new CodegenError({
    code: ErrorCode.INTERNAL_ERROR,
    message: `Internal error: ${message}`,
    category: ErrorCategory.INTERNAL,
    retryable: false,
    originalError
  });
}

/**
 * Wrap an unknown error into a CodegenError
 */
export function wrapError(error: unknown, defaultMessage = "Unknown error"): CodegenError {
  if (error instanceof CodegenError) {
    return error;
  }

  if (error instanceof Error) {
    return new CodegenError({
      code: ErrorCode.INTERNAL_ERROR,
      message: error.message || defaultMessage,
      category: ErrorCategory.INTERNAL,
      retryable: false,
      originalError: error
    });
  }

  return new CodegenError({
    code: ErrorCode.INTERNAL_ERROR,
    message: defaultMessage,
    category: ErrorCategory.INTERNAL,
    retryable: false,
    context: { originalError: error }
  });
}

/**
 * Check if an error should be retried
 *
 * Note: maxAttempts check is handled by the caller (retry-policy.ts)
 */
export function shouldRetry(error: CodegenError, attempt: number): boolean {
  // Check retryable flag
  if (!error.retryable) {
    return false;
  }

  // Category-specific logic
  switch (error.category) {
    case ErrorCategory.TRANSPORT:
    case ErrorCategory.TIMEOUT:
    case ErrorCategory.CONNECTION:
      return true;

    case ErrorCategory.RATE_LIMIT:
      return true; // Always retry rate limits with delay

    case ErrorCategory.EXECUTION:
      // Only retry 5xx errors
      return error.code === ErrorCode.HTTP_ERROR_5XX;

    default:
      return false;
  }
}
