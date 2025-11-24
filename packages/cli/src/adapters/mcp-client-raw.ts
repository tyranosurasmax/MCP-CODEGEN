/**
 * Lightweight MCP JSON-RPC Client
 * Bypasses SDK validation to handle non-standard schemas
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface RawMCPClientConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export class RawMCPClient extends EventEmitter {
  private process?: ChildProcess;
  private buffer: string = '';
  private pendingRequests: Map<number, { resolve: Function; reject: Function }> = new Map();
  private requestId: number = 1;

  constructor(private config: RawMCPClientConfig) {
    super();
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.process = spawn(this.config.command, this.config.args, {
        env: { ...process.env, ...this.config.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      if (!this.process.stdout || !this.process.stdin) {
        reject(new Error('Failed to create stdio streams'));
        return;
      }

      // Handle stdout data
      this.process.stdout.on('data', (data) => {
        this.handleData(data);
      });

      // Handle stderr for debugging
      this.process.stderr?.on('data', (data) => {
        console.warn('[MCP Server]:', data.toString());
      });

      // Handle process errors
      this.process.on('error', (error) => {
        reject(error);
      });

      // Send initialize request
      this.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'mcp-codegen',
          version: '1.1.0',
        },
      })
        .then(() => {
          // Send initialized notification
          return this.sendNotification('notifications/initialized', {});
        })
        .then(() => {
          resolve();
        })
        .catch(reject);
    });
  }

  async listTools(): Promise<any[]> {
    const result = await this.sendRequest('tools/list', {});
    return result.tools || [];
  }

  async callTool(name: string, args: any): Promise<any> {
    const result = await this.sendRequest('tools/call', {
      name,
      arguments: args || {}
    });
    return result;
  }

  async close(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = undefined;
    }
  }

  private async sendRequest(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = this.requestId++;
      const request = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      this.pendingRequests.set(id, { resolve, reject });

      const message = JSON.stringify(request) + '\n';
      this.process?.stdin?.write(message);
    });
  }

  private sendNotification(method: string, params: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const notification = {
        jsonrpc: '2.0',
        method,
        params,
      };

      const message = JSON.stringify(notification) + '\n';
      const written = this.process?.stdin?.write(message);
      if (written) {
        resolve();
      } else {
        reject(new Error('Failed to write notification'));
      }
    });
  }

  private handleData(data: Buffer): void {
    this.buffer += data.toString();

    // Process complete JSON-RPC messages (newline-delimited)
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const message = JSON.parse(line);
        this.handleMessage(message);
      } catch (error) {
        console.warn('Failed to parse JSON-RPC message:', line);
      }
    }
  }

  private handleMessage(message: any): void {
    if (message.id && this.pendingRequests.has(message.id)) {
      const pending = this.pendingRequests.get(message.id)!;
      this.pendingRequests.delete(message.id);

      if (message.error) {
        pending.reject(new Error(message.error.message || 'Request failed'));
      } else {
        pending.resolve(message.result);
      }
    }
  }
}
