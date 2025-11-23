/**
 * Instrumentation & Logging System
 *
 * Provides hooks for monitoring, logging, and telemetry:
 * - Event emission for all runtime operations
 * - Pluggable logger interface
 * - Performance metrics
 * - Debug mode
 *
 * See RUNTIME_CONTRACT.md for full specification.
 */

import { CodegenError } from "./errors";

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
  SILENT = "silent"
}

/**
 * Log level priority (for filtering)
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
  [LogLevel.SILENT]: 4
};

/**
 * Logger interface
 */
export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

/**
 * Default console logger
 */
class ConsoleLogger implements Logger {
  constructor(private level: LogLevel = LogLevel.INFO) {}

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.level];
  }

  private formatContext(context?: Record<string, unknown>): string {
    if (!context) return "";
    return ` ${JSON.stringify(context)}`;
  }

  debug(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(`[DEBUG] ${message}${this.formatContext(context)}`);
    }
  }

  info(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(`[INFO] ${message}${this.formatContext(context)}`);
    }
  }

  warn(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(`[WARN] ${message}${this.formatContext(context)}`);
    }
  }

  error(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(`[ERROR] ${message}${this.formatContext(context)}`);
    }
  }
}

/**
 * Global logger instance
 */
let logger: Logger = new ConsoleLogger(LogLevel.INFO);

/**
 * Set custom logger
 *
 * @example
 * ```typescript
 * import winston from 'winston';
 *
 * setLogger({
 *   debug: (msg, ctx) => winston.debug(msg, ctx),
 *   info: (msg, ctx) => winston.info(msg, ctx),
 *   warn: (msg, ctx) => winston.warn(msg, ctx),
 *   error: (msg, ctx) => winston.error(msg, ctx)
 * });
 * ```
 */
export function setLogger(customLogger: Logger): void {
  logger = customLogger;
}

/**
 * Set log level
 *
 * @example
 * ```typescript
 * setLogLevel("debug"); // Show all logs
 * setLogLevel("silent"); // No logs
 * ```
 */
export function setLogLevel(level: LogLevel | string): void {
  const logLevel = level as LogLevel;
  logger = new ConsoleLogger(logLevel);
}

/**
 * Get current logger
 */
export function getLogger(): Logger {
  return logger;
}

/**
 * Runtime event types
 */
export type RuntimeEventType =
  | "runtime:init"
  | "discovery:start"
  | "discovery:complete"
  | "discovery:error"
  | "call:start"
  | "call:success"
  | "call:error"
  | "call:retry"
  | "auth:resolve"
  | "auth:refresh"
  | "auth:error"
  | "connection:open"
  | "connection:close"
  | "connection:error"
  | "transport:send"
  | "transport:receive";

/**
 * Runtime event data structures
 */
export interface RuntimeEvent {
  type: RuntimeEventType;
  timestamp: Date;
  data: Record<string, unknown>;
}

/**
 * Event listener callback
 */
export type EventListener = (event: RuntimeEvent) => void;

/**
 * Event listeners registry
 */
const eventListeners = new Map<RuntimeEventType | "*", Set<EventListener>>();

/**
 * Subscribe to runtime events
 *
 * @param eventType - Event type to listen for, or "*" for all events
 * @param listener - Callback function
 *
 * @example
 * ```typescript
 * // Listen to all call errors
 * onRuntimeEvent("call:error", (event) => {
 *   console.error("Call failed:", event.data.toolName, event.data.error);
 * });
 *
 * // Listen to all events
 * onRuntimeEvent("*", (event) => {
 *   console.log("Event:", event.type, event.data);
 * });
 * ```
 */
export function onRuntimeEvent(eventType: RuntimeEventType | "*", listener: EventListener): void {
  if (!eventListeners.has(eventType)) {
    eventListeners.set(eventType, new Set());
  }
  eventListeners.get(eventType)!.add(listener);
}

/**
 * Unsubscribe from runtime events
 */
export function offRuntimeEvent(eventType: RuntimeEventType | "*", listener: EventListener): void {
  eventListeners.get(eventType)?.delete(listener);
}

/**
 * Emit a runtime event
 *
 * @internal
 */
export function emitRuntimeEvent(type: RuntimeEventType, data: Record<string, unknown>): void {
  const event: RuntimeEvent = {
    type,
    timestamp: new Date(),
    data
  };

  // Notify specific listeners
  eventListeners.get(type)?.forEach(listener => {
    try {
      listener(event);
    } catch (error) {
      logger.error("Event listener error", { error, eventType: type });
    }
  });

  // Notify wildcard listeners
  eventListeners.get("*")?.forEach(listener => {
    try {
      listener(event);
    } catch (error) {
      logger.error("Wildcard event listener error", { error, eventType: type });
    }
  });

  // Log event if debug level
  if (LOG_LEVEL_PRIORITY[LogLevel.DEBUG] >= LOG_LEVEL_PRIORITY[LogLevel.INFO]) {
    logger.debug(`Event: ${type}`, data);
  }
}

/**
 * Performance metrics tracking
 */
export interface PerformanceMetrics {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  retriedCalls: number;
  totalDuration: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
}

/**
 * Per-source metrics
 */
const metricsMap = new Map<string, PerformanceMetrics>();

/**
 * Record a call metric
 *
 * @internal
 */
export function recordCallMetric(source: string, success: boolean, duration: number, retried: boolean): void {
  if (!metricsMap.has(source)) {
    metricsMap.set(source, {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      retriedCalls: 0,
      totalDuration: 0,
      avgDuration: 0,
      minDuration: Infinity,
      maxDuration: 0
    });
  }

  const metrics = metricsMap.get(source)!;

  metrics.totalCalls++;
  if (success) {
    metrics.successfulCalls++;
  } else {
    metrics.failedCalls++;
  }
  if (retried) {
    metrics.retriedCalls++;
  }

  metrics.totalDuration += duration;
  metrics.avgDuration = metrics.totalDuration / metrics.totalCalls;
  metrics.minDuration = Math.min(metrics.minDuration, duration);
  metrics.maxDuration = Math.max(metrics.maxDuration, duration);
}

/**
 * Get metrics for a source
 *
 * @example
 * ```typescript
 * const metrics = getMetrics("github");
 * console.log(`Success rate: ${metrics.successfulCalls / metrics.totalCalls * 100}%`);
 * console.log(`Average duration: ${metrics.avgDuration}ms`);
 * ```
 */
export function getMetrics(source: string): PerformanceMetrics | undefined {
  return metricsMap.get(source);
}

/**
 * Get metrics for all sources
 */
export function getAllMetrics(): Map<string, PerformanceMetrics> {
  return new Map(metricsMap);
}

/**
 * Reset metrics
 */
export function resetMetrics(source?: string): void {
  if (source) {
    metricsMap.delete(source);
  } else {
    metricsMap.clear();
  }
}

/**
 * Telemetry helper functions
 */

/**
 * Measure execution time of an async operation
 *
 * @example
 * ```typescript
 * const result = await measureTime(
 *   async () => {
 *     return await call("github__list_repos", params);
 *   },
 *   (duration) => {
 *     console.log(`Call took ${duration}ms`);
 *   }
 * );
 * ```
 */
export async function measureTime<T>(
  operation: () => Promise<T>,
  onComplete?: (duration: number) => void
): Promise<T> {
  const start = Date.now();
  try {
    const result = await operation();
    const duration = Date.now() - start;
    if (onComplete) {
      onComplete(duration);
    }
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    if (onComplete) {
      onComplete(duration);
    }
    throw error;
  }
}

/**
 * Create a scoped logger with context
 *
 * @example
 * ```typescript
 * const scopedLogger = createScopedLogger({ source: "github", tool: "list_repos" });
 * scopedLogger.info("Starting request"); // [INFO] Starting request {"source":"github","tool":"list_repos"}
 * ```
 */
export function createScopedLogger(context: Record<string, unknown>): Logger {
  return {
    debug: (message, ctx) => logger.debug(message, { ...context, ...ctx }),
    info: (message, ctx) => logger.info(message, { ...context, ...ctx }),
    warn: (message, ctx) => logger.warn(message, { ...context, ...ctx }),
    error: (message, ctx) => logger.error(message, { ...context, ...ctx })
  };
}

/**
 * Debug mode flag
 */
let debugMode = false;

/**
 * Enable/disable debug mode
 *
 * When enabled, logs all events and detailed error information.
 */
export function setDebugMode(enabled: boolean): void {
  debugMode = enabled;
  if (enabled) {
    setLogLevel(LogLevel.DEBUG);
  }
}

/**
 * Check if debug mode is enabled
 */
export function isDebugMode(): boolean {
  return debugMode;
}

/**
 * Log error with full details in debug mode
 */
export function logError(error: CodegenError | Error, context?: Record<string, unknown>): void {
  if (error instanceof CodegenError) {
    logger.error(error.message, {
      ...context,
      code: error.code,
      category: error.category,
      retryable: error.retryable,
      context: error.context,
      stack: debugMode ? error.stack : undefined
    });
  } else {
    logger.error(error.message, {
      ...context,
      stack: debugMode ? error.stack : undefined
    });
  }
}
