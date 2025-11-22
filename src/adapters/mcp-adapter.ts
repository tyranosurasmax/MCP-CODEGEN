/**
 * MCP Adapter
 * Adapter for Model Context Protocol servers
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { BaseAdapter, AdapterConnectionError, AdapterExecutionError, AdapterTimeoutError } from './base';
import { ToolDefinition, MCPServerConfig } from '../types';

interface ClientInfo {
  client: Client;
  transport: StdioClientTransport;
  retries: number;
}

/**
 * MCP Adapter - connects to MCP servers via stdio
 */
export class MCPAdapter extends BaseAdapter {
  private clientInfo?: ClientInfo;
  private timeout: number = 60000; // 60 seconds
  private maxRetries: number = 2;

  constructor(name: string, private config: MCPServerConfig) {
    super(name, 'mcp');
  }

  /**
   * Discover tools from the MCP server
   */
  async discover(): Promise<ToolDefinition[]> {
    const client = await this.getClient();

    try {
      const result = await Promise.race([
        client.listTools(),
        this.timeoutPromise(`List tools from ${this.name} timed out`),
      ]);

      return (result.tools || []).map((tool: any) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema,
      }));
    } catch (error) {
      throw new AdapterExecutionError(
        `Failed to discover tools: ${error instanceof Error ? error.message : String(error)}`,
        this.name,
        this.type
      );
    }
  }

  /**
   * Execute an MCP tool
   */
  async execute(toolName: string, params: any): Promise<any> {
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
   * Handle tool execution errors with retry logic
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
      return this.execute(toolName, params);
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
