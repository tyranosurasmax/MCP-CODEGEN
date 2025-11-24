/**
 * MCP Adapter
 * Adapter for Model Context Protocol servers
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { BaseAdapter, AdapterConnectionError, AdapterExecutionError, AdapterTimeoutError } from './base';
import { ToolDefinition, MCPServerConfig } from '../types';
import { RawMCPClient } from './mcp-client-raw';

interface ClientInfo {
  client: Client;
  transport: StdioClientTransport;
  retries: number;
}

interface RawClientInfo {
  client: RawMCPClient;
  retries: number;
}

/**
 * MCP Adapter - connects to MCP servers via stdio
 */
export class MCPAdapter extends BaseAdapter {
  private clientInfo?: ClientInfo;
  private rawClientInfo?: RawClientInfo;
  private timeout: number = 60000; // 60 seconds
  private maxRetries: number = 2;
  private useRawClient: boolean = true; // Use raw client to bypass SDK validation

  constructor(name: string, private config: MCPServerConfig) {
    super(name, 'mcp');
  }

  /**
   * Discover tools from the MCP server
   */
  async discover(): Promise<ToolDefinition[]> {
    if (this.useRawClient) {
      return this.discoverWithRawClient();
    }
    return this.discoverWithSDK();
  }

  /**
   * Discover tools using raw client (bypasses SDK validation)
   */
  private async discoverWithRawClient(): Promise<ToolDefinition[]> {
    const rawClient = await this.getRawClient();

    try {
      const tools = await Promise.race([
        rawClient.listTools(),
        this.timeoutPromise(`List tools from ${this.name} timed out`),
      ]);

      // Map and normalize tools (no SDK validation issues!)
      return tools.map((tool: any) => ({
        name: tool.name || 'unnamed',
        description: tool.description || '',
        inputSchema: this.normalizeSchema(tool.inputSchema),
        outputSchema: this.normalizeSchema(tool.outputSchema),
      }));
    } catch (error) {
      console.warn(`Failed to discover tools from ${this.name}:`, error);
      throw new AdapterExecutionError(
        `Failed to discover tools: ${error instanceof Error ? error.message : String(error)}`,
        this.name,
        this.type
      );
    }
  }

  /**
   * Discover tools using official SDK (strict validation)
   */
  private async discoverWithSDK(): Promise<ToolDefinition[]> {
    const client = await this.getClient();

    try {
      const result = await Promise.race([
        client.listTools(),
        this.timeoutPromise(`List tools from ${this.name} timed out`),
      ]);

      return (result.tools || []).map((tool: any) => ({
        name: tool.name,
        description: tool.description || '',
        inputSchema: this.normalizeSchema(tool.inputSchema),
        outputSchema: this.normalizeSchema(tool.outputSchema),
      }));
    } catch (error) {
      console.error(`Failed to discover tools from ${this.name}:`, error);
      throw new AdapterExecutionError(
        `Failed to discover tools: ${error instanceof Error ? error.message : String(error)}`,
        this.name,
        this.type
      );
    }
  }

  /**
   * Normalize JSON Schema to ensure compatibility
   */
  private normalizeSchema(schema: any): any {
    if (!schema) {
      return { type: 'object', properties: {} };
    }

    // If schema is missing type, assume object
    if (typeof schema === 'object' && !schema.type) {
      return { ...schema, type: 'object' };
    }

    // If type is an array, take the first non-null type
    if (Array.isArray(schema.type)) {
      const nonNullType = schema.type.find((t: string) => t !== 'null');
      return { ...schema, type: nonNullType || 'object' };
    }

    return schema;
  }

  /**
   * Execute an MCP tool
   */
  async execute(toolName: string, params: any): Promise<any> {
    if (this.useRawClient) {
      return this.executeWithRawClient(toolName, params);
    }
    return this.executeWithSDK(toolName, params);
  }

  /**
   * Execute tool using raw client
   */
  private async executeWithRawClient(toolName: string, params: any): Promise<any> {
    const client = await this.getRawClient();

    try {
      const result = await Promise.race([
        client.callTool(toolName, params || {}),
        this.timeoutPromise(`Tool call ${toolName} timed out`),
      ]);

      return this.extractResult(result);
    } catch (error) {
      return this.handleRawToolError(toolName, params, error);
    }
  }

  /**
   * Execute tool using SDK client
   */
  private async executeWithSDK(toolName: string, params: any): Promise<any> {
    const client = await this.getClient();

    try {
      const result = await Promise.race([
        client.callTool({ name: toolName, arguments: params || {} }),
        this.timeoutPromise(`Tool call ${toolName} timed out`),
      ]);

      return this.extractResult(result);
    } catch (error) {
      return this.handleToolError(toolName, params, error);
    }
  }

  /**
   * Validate MCP server configuration
   */
  async validate(): Promise<boolean> {
    try {
      await this.getClient();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Close MCP client connection
   */
  async close(): Promise<void> {
    if (this.rawClientInfo) {
      try {
        await this.rawClientInfo.client.close();
      } catch (error) {
        console.warn(`Failed to close raw MCP connection for ${this.name}:`, error);
      } finally {
        this.rawClientInfo = undefined;
      }
    }
    if (this.clientInfo) {
      try {
        await this.clientInfo.client.close();
      } catch (error) {
        console.warn(`Failed to close MCP connection for ${this.name}:`, error);
      } finally {
        this.clientInfo = undefined;
      }
    }
  }

  /**
   * Get or create raw MCP client
   */
  private async getRawClient(): Promise<RawMCPClient> {
    if (this.rawClientInfo) {
      return this.rawClientInfo.client;
    }

    return this.connectRawClient();
  }

  /**
   * Connect to MCP server using raw client
   */
  private async connectRawClient(): Promise<RawMCPClient> {
    const client = new RawMCPClient({
      command: this.config.command,
      args: this.config.args || [],
      env: this.config.env,
    });

    try {
      await Promise.race([
        client.connect(),
        this.timeoutPromise(`Connection to ${this.name} timed out`),
      ]);

      this.rawClientInfo = {
        client,
        retries: 0,
      };

      return client;
    } catch (error) {
      throw new AdapterConnectionError(
        `Failed to connect: ${error instanceof Error ? error.message : String(error)}`,
        this.name,
        this.type
      );
    }
  }

  /**
   * Get or create MCP client
   */
  private async getClient(): Promise<Client> {
    if (this.clientInfo) {
      return this.clientInfo.client;
    }

    return this.connectServer();
  }

  /**
   * Connect to MCP server
   */
  private async connectServer(): Promise<Client> {
    const transport = new StdioClientTransport({
      command: this.config.command,
      args: this.config.args || [],
      env: { ...process.env, ...(this.config.env || {}) } as Record<string, string>,
    });

    const client = new Client({
      name: 'codegen-runtime',
      version: '1.1.0',
    }, {
      capabilities: {},
    });

    try {
      await Promise.race([
        client.connect(transport),
        this.timeoutPromise(`Connection to ${this.name} timed out`),
      ]);

      this.clientInfo = {
        client,
        transport,
        retries: 0,
      };

      return client;
    } catch (error) {
      throw new AdapterConnectionError(
        `Failed to connect: ${error instanceof Error ? error.message : String(error)}`,
        this.name,
        this.type
      );
    }
  }

  /**
   * Extract result from MCP response
   */
  private extractResult(result: any): any {
    if (result.content && Array.isArray(result.content)) {
      if (result.content.length === 0) return null;
      if (result.content.length === 1) {
        return result.content[0].text || result.content[0];
      }
      return result.content.map((item: any) => item.text || item);
    }
    return result;
  }

  /**
   * Handle tool execution errors with retry logic (SDK client)
   */
  private async handleToolError(toolName: string, params: any, error: any): Promise<any> {
    if (this.clientInfo && this.clientInfo.retries < this.maxRetries) {
      console.warn(`Retrying ${toolName} after error (attempt ${this.clientInfo.retries + 1}/${this.maxRetries})`);

      // Close and reconnect
      const currentRetries = this.clientInfo.retries;
      await this.close();

      // Reconnect and retry
      await this.getClient();
      if (this.clientInfo) {
        this.clientInfo.retries = currentRetries + 1;
      }

      // Retry the call
      return this.executeWithSDK(toolName, params);
    }

    throw new AdapterExecutionError(
      `Tool call failed: ${error instanceof Error ? error.message : String(error)}`,
      this.name,
      this.type
    );
  }

  /**
   * Handle tool execution errors with retry logic (raw client)
   */
  private async handleRawToolError(toolName: string, params: any, error: any): Promise<any> {
    if (this.rawClientInfo && this.rawClientInfo.retries < this.maxRetries) {
      console.warn(`Retrying ${toolName} after error (attempt ${this.rawClientInfo.retries + 1}/${this.maxRetries})`);

      // Close and reconnect
      const currentRetries = this.rawClientInfo.retries;
      await this.close();

      // Reconnect and retry
      await this.getRawClient();
      if (this.rawClientInfo) {
        this.rawClientInfo.retries = currentRetries + 1;
      }

      // Retry the call
      return this.executeWithRawClient(toolName, params);
    }

    throw new AdapterExecutionError(
      `Tool call failed: ${error instanceof Error ? error.message : String(error)}`,
      this.name,
      this.type
    );
  }

  /**
   * Create timeout promise
   */
  private timeoutPromise(message: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new AdapterTimeoutError(message, this.name, this.type)), this.timeout);
    });
  }
}
