/**
 * OpenAPI Adapter
 * Adapter for REST APIs with OpenAPI/Swagger specifications
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import * as fs from 'fs';
import { BaseAdapter, AdapterConnectionError, AdapterExecutionError } from './base';
import { ToolDefinition, OpenAPIConfig, OpenAPISpec } from '../types';

/**
 * OpenAPI Adapter - wraps REST APIs from OpenAPI specs
 */
export class OpenAPIAdapter extends BaseAdapter {
  private spec?: OpenAPISpec;
  private client?: AxiosInstance;
  private baseUrl: string;

  constructor(name: string, private config: OpenAPIConfig) {
    super(name, 'openapi');
    this.baseUrl = config.baseUrl || '';
  }

  /**
   * Discover endpoints from OpenAPI spec
   */
  async discover(): Promise<ToolDefinition[]> {
    this.spec = await this.loadSpec();
    this.client = this.createHttpClient();

    const tools: ToolDefinition[] = [];

    // Iterate through paths and operations
    for (const [path, pathItem] of Object.entries(this.spec.paths || {})) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method.toLowerCase())) {
          const tool = this.operationToTool(method.toLowerCase(), path, operation as any);
          if (tool) {
            tools.push(tool);
          }
        }
      }
    }

    return tools;
  }

  /**
   * Execute REST API call
   */
  async execute(toolName: string, params: any): Promise<any> {
    if (!this.client) {
      throw new AdapterConnectionError('Client not initialized', this.name, this.type);
    }

    try {
      // Parse tool name to get method and path
      const { method, path } = this.parseOperationName(toolName);

      // Resolve path parameters
      const resolvedPath = this.resolvePath(path, params.path || {});

      // Build request config
      const config: AxiosRequestConfig = {
        method,
        url: resolvedPath,
        params: params.query,
        data: params.body,
        headers: {
          ...this.config.headers,
          ...params.headers,
        },
      };

      // Make request
      const response = await this.client.request(config);
      return response.data;
    } catch (error: any) {
      throw new AdapterExecutionError(
        `API call failed: ${error.response?.data?.message || error.message || String(error)}`,
        this.name,
        this.type
      );
    }
  }

  /**
   * Validate OpenAPI spec can be loaded
   */
  async validate(): Promise<boolean> {
    try {
      await this.loadSpec();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Close HTTP client
   */
  async close(): Promise<void> {
    this.client = undefined;
    this.spec = undefined;
  }

  /**
   * Load OpenAPI specification
   */
  private async loadSpec(): Promise<OpenAPISpec> {
    try {
      if (this.config.spec.startsWith('http://') || this.config.spec.startsWith('https://')) {
        // Fetch from URL
        const response = await axios.get(this.config.spec, { maxRedirects: 10 });
        return response.data;
      } else {
        // Load from file
        const content = fs.readFileSync(this.config.spec, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      throw new AdapterConnectionError(
        `Failed to load OpenAPI spec: ${error instanceof Error ? error.message : String(error)}`,
        this.name,
        this.type
      );
    }
  }

  /**
   * Create HTTP client with auth
   */
  private createHttpClient(): AxiosInstance {
    const config: AxiosRequestConfig = {
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: this.config.headers || {},
    };

    // Add authentication
    if (this.config.auth) {
      switch (this.config.auth.type) {
        case 'bearer':
          config.headers!['Authorization'] = `Bearer ${this.resolveEnvVar(this.config.auth.token)}`;
          break;
        case 'apiKey':
          if (this.config.auth.in === 'header') {
            config.headers![this.config.auth.name] = this.resolveEnvVar(this.config.auth.value);
          }
          break;
        case 'basic':
          const username = this.resolveEnvVar(this.config.auth.username);
          const password = this.resolveEnvVar(this.config.auth.password);
          const auth = Buffer.from(`${username}:${password}`).toString('base64');
          config.headers!['Authorization'] = `Basic ${auth}`;
          break;
      }
    }

    return axios.create(config);
  }

  /**
   * Convert OpenAPI operation to ToolDefinition
   */
  private operationToTool(method: string, path: string, operation: any): ToolDefinition | null {
    if (!operation) return null;

    const toolName = this.generateToolName(method, path, operation.operationId);

    return {
      name: toolName,
      description: operation.summary || operation.description || `${method.toUpperCase()} ${path}`,
      inputSchema: this.buildInputSchema(operation, path),
      outputSchema: this.buildOutputSchema(operation),
    };
  }

  /**
   * Generate tool name from operation
   */
  private generateToolName(method: string, path: string, operationId?: string): string {
    if (operationId) {
      return operationId.replace(/[^a-zA-Z0-9_]/g, '_');
    }

    // Generate from method and path
    const pathParts = path.split('/').filter(p => p && !p.startsWith('{'));
    const name = [method, ...pathParts].join('_').replace(/[^a-zA-Z0-9_]/g, '_');
    return name;
  }

  /**
   * Build JSON Schema for input parameters
   */
  private buildInputSchema(operation: any, path: string): any {
    const schema: any = {
      type: 'object',
      properties: {},
      required: [],
    };

    // Path parameters
    const pathParams = (operation.parameters || []).filter((p: any) => p.in === 'path');
    if (pathParams.length > 0) {
      schema.properties.path = {
        type: 'object',
        properties: {},
        required: pathParams.filter((p: any) => p.required).map((p: any) => p.name),
      };
      pathParams.forEach((p: any) => {
        schema.properties.path.properties[p.name] = p.schema || { type: 'string' };
      });
      if (pathParams.some((p: any) => p.required)) {
        schema.required.push('path');
      }
    }

    // Query parameters
    const queryParams = (operation.parameters || []).filter((p: any) => p.in === 'query');
    if (queryParams.length > 0) {
      schema.properties.query = {
        type: 'object',
        properties: {},
        required: queryParams.filter((p: any) => p.required).map((p: any) => p.name),
      };
      queryParams.forEach((p: any) => {
        schema.properties.query.properties[p.name] = p.schema || { type: 'string' };
      });
    }

    // Request body
    if (operation.requestBody) {
      const content = operation.requestBody.content?.['application/json'];
      if (content?.schema) {
        schema.properties.body = content.schema;
        if (operation.requestBody.required) {
          schema.required.push('body');
        }
      }
    }

    return schema;
  }

  /**
   * Build JSON Schema for output
   */
  private buildOutputSchema(operation: any): any {
    const response200 = operation.responses?.['200'] || operation.responses?.['201'];
    if (response200) {
      const content = response200.content?.['application/json'];
      if (content?.schema) {
        return content.schema;
      }
    }
    return { type: 'object' };
  }

  /**
   * Resolve path with parameters
   */
  private resolvePath(pathTemplate: string, params: Record<string, any>): string {
    let resolved = pathTemplate;
    for (const [key, value] of Object.entries(params)) {
      resolved = resolved.replace(`{${key}}`, String(value));
    }
    return resolved;
  }

  /**
   * Parse operation name back to method and path
   */
  private parseOperationName(toolName: string): { method: string; path: string } {
    // Try to find in spec
    if (this.spec) {
      for (const [path, pathItem] of Object.entries(this.spec.paths || {})) {
        for (const [method, operation] of Object.entries(pathItem)) {
          const opName = this.generateToolName(method, path, (operation as any).operationId);
          if (opName === toolName) {
            return { method: method.toLowerCase(), path };
          }
        }
      }
    }

    throw new AdapterExecutionError(
      `Operation not found: ${toolName}`,
      this.name,
      this.type
    );
  }

  /**
   * Resolve environment variables in strings
   * Supports: ${VAR}, $VAR, ${VAR:-default}
   */
  private resolveEnvVar(value: string): string {
    // Handle ${VAR:-default} syntax
    const withDefault = /\$\{([A-Z_][A-Z0-9_]*):-([^}]*)\}/gi;
    value = value.replace(withDefault, (_, varName, defaultValue) => {
      return process.env[varName] ?? defaultValue;
    });

    // Handle ${VAR} syntax
    const withBraces = /\$\{([A-Z_][A-Z0-9_]*)\}/gi;
    value = value.replace(withBraces, (_, varName) => {
      return process.env[varName] ?? "";
    });

    // Handle $VAR syntax (no braces)
    const withoutBraces = /\$([A-Z_][A-Z0-9_]*)/g;
    value = value.replace(withoutBraces, (_, varName) => {
      return process.env[varName] ?? "";
    });

    return value;
  }
}
