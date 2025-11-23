/**
 * Universal Runtime - Core Implementation
 *
 * Provides unified execution interface for all adapter types (MCP, REST, GraphQL).
 * Integrates with error handling, retry policy, auth resolution, and instrumentation.
 */

import { MCPAdapter } from "../adapters/mcp-adapter";
import { OpenAPIAdapter } from "../adapters/openapi-adapter";
import { CodegenError, toolNotFoundError, wrapError } from "./errors";
import { emitRuntimeEvent, recordCallMetric } from "./instrumentation";
import { retryWithBackoff, getRetryPolicy } from "./retry-policy";

/**
 * Adapter registry
 * Maps source names to adapter instances
 */
const adapterRegistry = new Map<string, MCPAdapter | OpenAPIAdapter>();

/**
 * Call options for runtime execution
 */
export interface CallOptions {
  /** Override global retry policy for this call */
  retry?: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
  };

  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;

  /** Skip instrumentation events for this call */
  skipInstrumentation?: boolean;
}

/**
 * Register an adapter with the runtime
 *
 * @internal Used by generated code
 */
export function registerAdapter(name: string, adapter: MCPAdapter | OpenAPIAdapter): void {
  adapterRegistry.set(name, adapter);
}

/**
 * Get registered adapter by name
 *
 * @internal
 */
export function getAdapter(name: string): MCPAdapter | OpenAPIAdapter | undefined {
  return adapterRegistry.get(name);
}

/**
 * Parse tool name into source and tool parts
 *
 * Format: "source__tool_name"
 * Example: "github__list_repos" -> { source: "github", tool: "list_repos" }
 */
function parseToolName(toolName: string): { source: string; tool: string } {
  const parts = toolName.split("__");
  if (parts.length !== 2) {
    throw toolNotFoundError(toolName);
  }

  return {
    source: parts[0],
    tool: parts[1]
  };
}

/**
 * Execute any tool by name with runtime type checking
 */
export async function call(
  toolName: string,
  params: unknown,
  options?: CallOptions
): Promise<unknown> {
  const startTime = Date.now();
  const { source, tool } = parseToolName(toolName);

  // Emit start event
  if (!options?.skipInstrumentation) {
    emitRuntimeEvent("call:start", { toolName, source, tool, params });
  }

  try {
    // Get adapter
    const adapter = adapterRegistry.get(source);
    if (!adapter) {
      throw toolNotFoundError(toolName);
    }

    // Execute with retry policy
    const result = await retryWithBackoff(
      async () => {
        return await adapter.execute(tool, params);
      },
      options?.retry || getRetryPolicy(),
      (error, attempt, delay) => {
        if (!options?.skipInstrumentation) {
          emitRuntimeEvent("call:retry", {
            toolName,
            source,
            tool,
            attempt,
            delay,
            error: error.message
          });
        }
      }
    );

    // Record success metrics
    const duration = Date.now() - startTime;
    if (!options?.skipInstrumentation) {
      emitRuntimeEvent("call:success", { toolName, source, tool, result, duration });
      recordCallMetric(source, true, duration, false);
    }

    return result;

  } catch (error) {
    const duration = Date.now() - startTime;

    // Wrap error if needed
    const codegenError = error instanceof CodegenError
      ? error
      : wrapError(error, `Failed to execute ${toolName}`);

    // Record failure metrics
    if (!options?.skipInstrumentation) {
      emitRuntimeEvent("call:error", {
        toolName,
        source,
        tool,
        error: codegenError.toJSON(),
        duration
      });
      recordCallMetric(source, false, duration, false);
    }

    throw codegenError;
  }
}

/**
 * Execute any tool with compile-time type safety
 */
export async function callTyped<TParams = unknown, TResult = unknown>(
  toolName: string,
  params: TParams,
  options?: CallOptions
): Promise<TResult> {
  return call(toolName, params, options) as Promise<TResult>;
}

/**
 * Legacy MCP-specific API (deprecated)
 */
export async function callMCPTool(toolName: string, params: unknown): Promise<unknown> {
  console.warn("callMCPTool is deprecated. Use call() instead.");
  return call(toolName, params);
}

export async function callMCPToolTyped<TParams, TResult>(
  toolName: string,
  params: TParams
): Promise<TResult> {
  console.warn("callMCPToolTyped is deprecated. Use callTyped() instead.");
  return callTyped<TParams, TResult>(toolName, params);
}

export function getClient(serverName: string): any {
  console.warn("getClient is deprecated. Adapters are managed internally.");
  return getAdapter(serverName);
}

/**
 * Discover all tools from all registered adapters
 */
export async function discoverAll(): Promise<Map<string, any[]>> {
  const results = new Map<string, any[]>();

  for (const [name, adapter] of adapterRegistry.entries()) {
    try {
      const tools = await adapter.discover();
      results.set(name, tools);
    } catch (error) {
      console.error(`Failed to discover tools from ${name}:`, error);
      results.set(name, []);
    }
  }

  return results;
}

/**
 * Get runtime instance (for advanced usage)
 */
export class UniversalRuntime {
  static registerAdapter(name: string, adapter: MCPAdapter | OpenAPIAdapter): void {
    registerAdapter(name, adapter);
  }

  static getAdapters(): Map<string, MCPAdapter | OpenAPIAdapter> {
    return new Map(adapterRegistry);
  }

  static clearAdapters(): void {
    adapterRegistry.clear();
  }

  static async call(toolName: string, params: unknown, options?: CallOptions): Promise<unknown> {
    return call(toolName, params, options);
  }

  static async callTyped<TParams, TResult>(
    toolName: string,
    params: TParams,
    options?: CallOptions
  ): Promise<TResult> {
    return callTyped<TParams, TResult>(toolName, params, options);
  }
}

export function getRuntime(): typeof UniversalRuntime {
  return UniversalRuntime;
}
