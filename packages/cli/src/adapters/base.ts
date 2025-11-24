/**
 * Universal Adapter Interface
 * Base abstraction for all source types (MCP, OpenAPI, GraphQL, etc.)
 */

import { ToolDefinition } from '../types';

/**
 * Core interface that all source adapters must implement
 */
export interface SourceAdapter {
  /** Unique identifier for this adapter instance */
  name: string;

  /** Type of source (mcp, openapi, graphql, database, etc.) */
  type: string;

  /**
   * Discover all available tools/endpoints from this source
   * @returns List of tool definitions
   */
  discover(): Promise<ToolDefinition[]>;

  /**
   * Execute a tool/endpoint
   * @param toolName - Name of the tool to execute
   * @param params - Parameters for the tool
   * @returns Result from the tool execution
   */
  execute(toolName: string, params: any): Promise<any>;

  /**
   * Validate connection/configuration
   * @returns true if adapter is properly configured
   */
  validate(): Promise<boolean>;

  /**
   * Close connections and cleanup resources
   */
  close(): Promise<void>;
}

/**
 * Base adapter class with common functionality
 */
export abstract class BaseAdapter implements SourceAdapter {
  constructor(
    public readonly name: string,
    public readonly type: string
  ) {}

  abstract discover(): Promise<ToolDefinition[]>;
  abstract execute(toolName: string, params: any): Promise<any>;

  /**
   * Default validation - can be overridden
   */
  async validate(): Promise<boolean> {
    return true;
  }

  /**
   * Default close - can be overridden
   */
  async close(): Promise<void> {
    // Default: no cleanup needed
  }

  /**
   * Generate a fully qualified tool name
   * Format: sourceName__toolName
   */
  protected qualifyToolName(toolName: string): string {
    return `${this.name}__${toolName}`;
  }

  /**
   * Parse a qualified tool name back to its parts
   */
  protected parseToolName(qualifiedName: string): { source: string; tool: string } {
    const parts = qualifiedName.split('__');
    if (parts.length !== 2) {
      throw new Error(`Invalid tool name format: ${qualifiedName}`);
    }
    return { source: parts[0], tool: parts[1] };
  }
}

/**
 * Error types for universal adapters
 */
export class AdapterError extends Error {
  constructor(
    message: string,
    public readonly adapterName: string,
    public readonly adapterType: string
  ) {
    super(message);
    this.name = 'AdapterError';
  }
}

export class AdapterConnectionError extends AdapterError {
  constructor(message: string, adapterName: string, adapterType: string) {
    super(message, adapterName, adapterType);
    this.name = 'AdapterConnectionError';
  }
}

export class AdapterExecutionError extends AdapterError {
  constructor(message: string, adapterName: string, adapterType: string) {
    super(message, adapterName, adapterType);
    this.name = 'AdapterExecutionError';
  }
}

export class AdapterValidationError extends AdapterError {
  constructor(message: string, adapterName: string, adapterType: string) {
    super(message, adapterName, adapterType);
    this.name = 'AdapterValidationError';
  }
}

export class AdapterTimeoutError extends AdapterError {
  constructor(message: string, adapterName: string, adapterType: string) {
    super(message, adapterName, adapterType);
    this.name = 'AdapterTimeoutError';
  }
}
