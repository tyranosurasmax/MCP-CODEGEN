/**
 * MCP Runtime
 * Manages connections to MCP servers and tool execution
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import * as fs from 'fs';
import * as path from 'path';
import { ServerMap, MCPServerConfig } from '../types';

export class MCPConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MCPConnectionError';
  }
}

export class MCPValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MCPValidationError';
  }
}

export class MCPToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MCPToolError';
  }
}

export class MCPTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MCPTimeoutError';
  }
}

interface ClientInfo {
  client: Client;
  transport: StdioClientTransport;
  config: MCPServerConfig;
  retries: number;
}

export class MCPRuntime {
  private clients = new Map<string, ClientInfo>();
  private serverMap: ServerMap = {};
  private timeout: number = 60000; // 60 seconds
  private maxRetries: number = 2;

  constructor(serverMapPath?: string) {
    if (serverMapPath && fs.existsSync(serverMapPath)) {
      this.loadServerMap(serverMapPath);
    }
  }

  /**
   * Load server map from file
   */
  loadServerMap(serverMapPath: string): void {
    const content = fs.readFileSync(serverMapPath, 'utf-8');
    this.serverMap = JSON.parse(content);
  }

  /**
   * Set timeout for tool calls (in milliseconds)
   */
  setTimeout(ms: number): void {
    this.timeout = ms;
  }

  /**
   * Get or create MCP client for a server
   */
  async getClient(serverName: string): Promise<Client> {
    // Return existing client if connected
    if (this.clients.has(serverName)) {
      const info = this.clients.get(serverName)!;
      // TODO: Add health check
      return info.client;
    }

    // Create new client
    const config = this.serverMap[serverName];
    if (!config) {
      throw new MCPConnectionError(`Server not found: ${serverName}`);
    }

    return this.connectServer(serverName, config);
  }

  /**
   * Connect to an MCP server
   */
  private async connectServer(serverName: string, config: MCPServerConfig): Promise<Client> {
    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args || [],
      env: { ...process.env, ...(config.env || {}) } as Record<string, string>,
    });

    const client = new Client({
      name: 'mcp-codegen-runtime',
      version: '1.0.1',
    }, {
      capabilities: {},
    });

    try {
      await Promise.race([
        client.connect(transport),
        this.timeoutPromise(`Connection to ${serverName} timed out`),
      ]);

      this.clients.set(serverName, {
        client,
        transport,
        config,
        retries: 0,
      });

      return client;
    } catch (error) {
      throw new MCPConnectionError(
        `Failed to connect to ${serverName}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Call an MCP tool (untyped)
   */
  async callMCPTool(toolName: string, params?: any): Promise<any> {
    const [serverName, actualToolName] = this.parseToolName(toolName);
    const client = await this.getClient(serverName);

    try {
      const result = await Promise.race([
        client.callTool({ name: actualToolName, arguments: params || {} }),
        this.timeoutPromise(`Tool call ${toolName} timed out`),
      ]);

      return this.extractResult(result);
    } catch (error) {
      return this.handleToolError(serverName, toolName, error);
    }
  }

  /**
   * Call an MCP tool (typed)
   */
  async callMCPToolTyped<P, R>(toolName: string, params: P): Promise<R> {
    return this.callMCPTool(toolName, params) as Promise<R>;
  }

  /**
   * List all available tools from a server
   */
  async listTools(serverName: string): Promise<any[]> {
    const client = await this.getClient(serverName);

    try {
      const result = await Promise.race([
        client.listTools(),
        this.timeoutPromise(`List tools from ${serverName} timed out`),
      ]);

      return result.tools || [];
    } catch (error) {
      throw new MCPToolError(
        `Failed to list tools from ${serverName}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Close all connections
   */
  async closeAll(): Promise<void> {
    const promises = Array.from(this.clients.entries()).map(async ([name, info]) => {
      try {
        await info.client.close();
      } catch (error) {
        console.warn(`Failed to close connection to ${name}:`, error);
      }
    });

    await Promise.all(promises);
    this.clients.clear();
  }

  /**
   * Close specific server connection
   */
  async closeServer(serverName: string): Promise<void> {
    const info = this.clients.get(serverName);
    if (!info) return;

    try {
      await info.client.close();
    } finally {
      this.clients.delete(serverName);
    }
  }

  private parseToolName(toolName: string): [string, string] {
    const parts = toolName.split('__');
    if (parts.length !== 2) {
      throw new MCPValidationError(
        `Invalid tool name format: ${toolName}. Expected format: serverName__toolName`
      );
    }
    return [parts[0], parts[1]];
  }

  private extractResult(result: any): any {
    if (result.content && Array.isArray(result.content)) {
      // MCP returns content as array of content items
      if (result.content.length === 0) return null;
      if (result.content.length === 1) {
        return result.content[0].text || result.content[0];
      }
      return result.content.map((item: any) => item.text || item);
    }
    return result;
  }

  private async handleToolError(serverName: string, toolName: string, error: any): Promise<any> {
    const info = this.clients.get(serverName);

    // Try to restart server on connection errors
    if (info && info.retries < this.maxRetries) {
      console.warn(`Retrying ${toolName} after error (attempt ${info.retries + 1}/${this.maxRetries})`);

      // Close and reconnect
      await this.closeServer(serverName);
      info.retries++;
      this.clients.set(serverName, info);

      // Retry the call
      return this.callMCPTool(toolName);
    }

    throw new MCPToolError(
      `Tool call failed for ${toolName}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  private timeoutPromise(message: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new MCPTimeoutError(message)), this.timeout);
    });
  }
}

// Export singleton instance
let runtimeInstance: MCPRuntime | null = null;

export function getRuntime(): MCPRuntime {
  if (!runtimeInstance) {
    // Try to load from default location
    const defaultPath = path.join(process.cwd(), 'mcp', 'server-map.json');
    runtimeInstance = new MCPRuntime(
      fs.existsSync(defaultPath) ? defaultPath : undefined
    );
  }
  return runtimeInstance;
}

// Public API
export async function callMCPTool(toolName: string, params?: any): Promise<any> {
  return getRuntime().callMCPTool(toolName, params);
}

export async function callMCPToolTyped<P, R>(toolName: string, params: P): Promise<R> {
  return getRuntime().callMCPToolTyped<P, R>(toolName, params);
}

export async function getClient(serverName: string): Promise<any> {
  return getRuntime().getClient(serverName);
}
