/**
 * Source Adapter Interface
 * Base abstraction that all source adapters must implement
 */

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
  discover(): Promise<any[]>;

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
