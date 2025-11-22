/**
 * Universal Runtime
 * Manages all source adapters and provides unified execution interface
 */

import * as fs from 'fs';
import * as path from 'path';
import { SourceAdapter } from '../adapters/base';
import { MCPAdapter } from '../adapters/mcp-adapter';
import { OpenAPIAdapter } from '../adapters/openapi-adapter';
import { UniversalConfig, MCPServerConfig, OpenAPIConfig } from '../types';

export class UniversalRuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UniversalRuntimeError';
  }
}

/**
 * Universal Runtime - One runtime to rule them all
 */
export class UniversalRuntime {
  private adapters = new Map<string, SourceAdapter>();
  private config?: UniversalConfig;

  constructor(configPath?: string) {
    if (configPath && fs.existsSync(configPath)) {
      this.loadConfig(configPath);
    }
  }

  /**
   * Load configuration and initialize adapters
   */
  loadConfig(configPath: string): void {
    const content = fs.readFileSync(configPath, 'utf-8');
    this.config = JSON.parse(content);

    // Initialize MCP adapters
    if (this.config?.sources?.mcp) {
      for (const [name, config] of Object.entries(this.config.sources.mcp)) {
        if (!config.disabled) {
          this.registerAdapter(new MCPAdapter(name, config));
        }
      }
    }

    // Initialize OpenAPI adapters
    if (this.config?.sources?.openapi) {
      for (const [name, config] of Object.entries(this.config.sources.openapi)) {
        if (!config.disabled) {
          this.registerAdapter(new OpenAPIAdapter(name, config));
        }
      }
    }
  }

  /**
   * Register a source adapter
   */
  registerAdapter(adapter: SourceAdapter): void {
    this.adapters.set(adapter.name, adapter);
  }

  /**
   * Get adapter by name
   */
  getAdapter(name: string): SourceAdapter | undefined {
    return this.adapters.get(name);
  }

  /**
   * Get all adapters
   */
  getAllAdapters(): SourceAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Get adapters by type
   */
  getAdaptersByType(type: string): SourceAdapter[] {
    return this.getAllAdapters().filter(a => a.type === type);
  }

  /**
   * Call a tool from any source
   * @param qualifiedName - Format: "sourceName__toolName"
   * @param params - Tool parameters
   */
  async call(qualifiedName: string, params?: any): Promise<any> {
    const { source, tool } = this.parseQualifiedName(qualifiedName);

    const adapter = this.adapters.get(source);
    if (!adapter) {
      throw new UniversalRuntimeError(`Source not found: ${source}`);
    }

    return adapter.execute(tool, params);
  }

  /**
   * Typed version of call
   */
  async callTyped<P, R>(qualifiedName: string, params: P): Promise<R> {
    return this.call(qualifiedName, params) as Promise<R>;
  }

  /**
   * Discover tools from a specific source
   */
  async discoverSource(sourceName: string): Promise<any[]> {
    const adapter = this.adapters.get(sourceName);
    if (!adapter) {
      throw new UniversalRuntimeError(`Source not found: ${sourceName}`);
    }

    return adapter.discover();
  }

  /**
   * Discover tools from all sources
   */
  async discoverAll(): Promise<Map<string, any[]>> {
    const results = new Map<string, any[]>();

    for (const [name, adapter] of this.adapters.entries()) {
      try {
        const tools = await adapter.discover();
        results.set(name, tools);
      } catch (error) {
        console.warn(`Failed to discover tools from ${name}:`, error);
        results.set(name, []);
      }
    }

    return results;
  }

  /**
   * Validate all adapters
   */
  async validateAll(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const [name, adapter] of this.adapters.entries()) {
      try {
        const valid = await adapter.validate();
        results.set(name, valid);
      } catch (error) {
        results.set(name, false);
      }
    }

    return results;
  }

  /**
   * Close all adapters
   */
  async closeAll(): Promise<void> {
    const promises = Array.from(this.adapters.values()).map(adapter =>
      adapter.close().catch(error => {
        console.warn(`Failed to close ${adapter.name}:`, error);
      })
    );

    await Promise.all(promises);
    this.adapters.clear();
  }

  /**
   * Close specific adapter
   */
  async closeAdapter(name: string): Promise<void> {
    const adapter = this.adapters.get(name);
    if (adapter) {
      await adapter.close();
      this.adapters.delete(name);
    }
  }

  /**
   * Parse qualified tool name
   */
  private parseQualifiedName(qualifiedName: string): { source: string; tool: string } {
    const parts = qualifiedName.split('__');
    if (parts.length !== 2) {
      throw new UniversalRuntimeError(
        `Invalid qualified name: ${qualifiedName}. Expected format: sourceName__toolName`
      );
    }
    return { source: parts[0], tool: parts[1] };
  }
}

// ============================================================================
// Singleton Instance and Public API
// ============================================================================

let runtimeInstance: UniversalRuntime | null = null;

/**
 * Get singleton runtime instance
 */
export function getRuntime(): UniversalRuntime {
  if (!runtimeInstance) {
    // Try to load from default locations
    const possiblePaths = [
      path.join(process.cwd(), 'codegen.config.json'),
      path.join(process.cwd(), '.codegenrc'),
      path.join(process.cwd(), 'mcp', 'config.json'),
    ];

    for (const configPath of possiblePaths) {
      if (fs.existsSync(configPath)) {
        runtimeInstance = new UniversalRuntime(configPath);
        return runtimeInstance;
      }
    }

    // Create empty runtime if no config found
    runtimeInstance = new UniversalRuntime();
  }

  return runtimeInstance;
}

/**
 * Reset singleton (useful for testing)
 */
export function resetRuntime(): void {
  if (runtimeInstance) {
    runtimeInstance.closeAll().catch(console.error);
  }
  runtimeInstance = null;
}

// ============================================================================
// Public API Functions
// ============================================================================

/**
 * Call a tool from any source
 */
export async function call(qualifiedName: string, params?: any): Promise<any> {
  return getRuntime().call(qualifiedName, params);
}

/**
 * Call a tool with type safety
 */
export async function callTyped<P, R>(qualifiedName: string, params: P): Promise<R> {
  return getRuntime().callTyped<P, R>(qualifiedName, params);
}

/**
 * Get a source adapter
 */
export function getAdapter(name: string): SourceAdapter | undefined {
  return getRuntime().getAdapter(name);
}

/**
 * Discover tools from all sources
 */
export async function discoverAll(): Promise<Map<string, any[]>> {
  return getRuntime().discoverAll();
}

// ============================================================================
// Legacy MCP API (for backward compatibility)
// ============================================================================

/**
 * @deprecated Use call() instead
 */
export async function callMCPTool(toolName: string, params?: any): Promise<any> {
  return call(toolName, params);
}

/**
 * @deprecated Use callTyped() instead
 */
export async function callMCPToolTyped<P, R>(toolName: string, params: P): Promise<R> {
  return callTyped<P, R>(toolName, params);
}

/**
 * @deprecated Use getAdapter() instead
 */
export async function getClient(serverName: string): Promise<any> {
  const adapter = getAdapter(serverName);
  if (!adapter) {
    throw new UniversalRuntimeError(`Adapter not found: ${serverName}`);
  }
  return adapter;
}
