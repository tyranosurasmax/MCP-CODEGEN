/**
 * GraphQL Adapter
 *
 * Discovers GraphQL APIs via introspection and executes queries/mutations
 * as universal tools.
 */

import axios, { AxiosInstance } from 'axios';
import { BaseAdapter } from './base';
import { ToolDefinition } from '../types';
import {
  resolveAuth,
  AuthConfig,
  CodegenError,
  ErrorCategory,
  executionError,
  timeoutError,
} from '@mcp-codegen/runtime';

export interface GraphQLConfig {
  type: 'graphql';
  endpoint: string;
  auth?: AuthConfig;
  headers?: Record<string, string>;
  timeout?: number;
  disabled?: boolean;
}

interface GraphQLField {
  name: string;
  description?: string;
  args: GraphQLInputValue[];
  type: GraphQLType;
  isDeprecated?: boolean;
  deprecationReason?: string;
}

interface GraphQLInputValue {
  name: string;
  description?: string;
  type: GraphQLType;
  defaultValue?: string;
}

interface GraphQLType {
  kind: string;
  name?: string;
  ofType?: GraphQLType;
}

interface IntrospectionQuery {
  __schema: {
    queryType?: { name: string };
    mutationType?: { name: string };
    types: Array<{
      kind: string;
      name: string;
      description?: string;
      fields?: GraphQLField[];
      inputFields?: GraphQLInputValue[];
    }>;
  };
}

/**
 * GraphQL Adapter - Converts GraphQL APIs into universal tools
 */
export class GraphQLAdapter extends BaseAdapter {
  private endpoint: string;
  private config: GraphQLConfig;
  private client: AxiosInstance;
  private schema?: IntrospectionQuery;

  constructor(name: string, config: GraphQLConfig) {
    super(name, 'graphql');
    this.endpoint = config.endpoint;
    this.config = config;

    this.client = axios.create({
      baseURL: this.endpoint,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        ...(config.headers || {}),
      },
    });
  }

  /**
   * Validate GraphQL endpoint by running introspection
   */
  async validate(): Promise<boolean> {
    try {
      await this.introspect();
      return true;
    } catch (error) {
      console.error(`GraphQL validation failed for ${this.name}:`, error);
      return false;
    }
  }

  /**
   * Run GraphQL introspection query to discover schema
   */
  private async introspect(): Promise<IntrospectionQuery> {
    if (this.schema) {
      return this.schema;
    }

    const introspectionQuery = `
      query IntrospectionQuery {
        __schema {
          queryType { name }
          mutationType { name }
          types {
            kind
            name
            description
            fields {
              name
              description
              args {
                name
                description
                type {
                  kind
                  name
                  ofType {
                    kind
                    name
                    ofType {
                      kind
                      name
                      ofType {
                        kind
                        name
                      }
                    }
                  }
                }
                defaultValue
              }
              type {
                kind
                name
                ofType {
                  kind
                  name
                  ofType {
                    kind
                    name
                    ofType {
                      kind
                      name
                    }
                  }
                }
              }
              isDeprecated
              deprecationReason
            }
            inputFields {
              name
              description
              type {
                kind
                name
                ofType {
                  kind
                  name
                  ofType {
                    kind
                    name
                  }
                }
              }
              defaultValue
            }
          }
        }
      }
    `;

    try {
      const headers = await this.getAuthHeaders();

      const response = await this.client.post('', {
        query: introspectionQuery,
      }, { headers });

      if (response.data.errors) {
        throw new Error(`Introspection failed: ${JSON.stringify(response.data.errors)}`);
      }

      this.schema = response.data.data as IntrospectionQuery;
      return this.schema;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw timeoutError('GraphQL introspection', this.config.timeout || 30000);
        }
        throw new CodegenError({
          code: 'GRAPHQL_INTROSPECTION_FAILED',
          message: `GraphQL introspection failed: ${error.message}`,
          category: ErrorCategory.DISCOVERY,
          retryable: true,
          context: { endpoint: this.endpoint, error: error.message },
        });
      }
      throw error;
    }
  }

  /**
   * Get authentication headers
   */
  private async getAuthHeaders(): Promise<Record<string, string>> {
    if (!this.config.auth) {
      return {};
    }

    const authResult = await resolveAuth({
      source: this.name,
      tool: 'introspection',
      config: this.config.auth,
    });

    return authResult.headers || {};
  }

  /**
   * Discover all queries and mutations as tools
   */
  async discover(): Promise<ToolDefinition[]> {
    const schema = await this.introspect();
    const tools: ToolDefinition[] = [];

    // Get Query type
    const queryType = schema.__schema.types.find(
      t => t.name === schema.__schema.queryType?.name
    );

    if (queryType?.fields) {
      for (const field of queryType.fields) {
        if (!field.isDeprecated) {
          tools.push(this.fieldToTool(field, 'query'));
        }
      }
    }

    // Get Mutation type
    const mutationType = schema.__schema.types.find(
      t => t.name === schema.__schema.mutationType?.name
    );

    if (mutationType?.fields) {
      for (const field of mutationType.fields) {
        if (!field.isDeprecated) {
          tools.push(this.fieldToTool(field, 'mutation'));
        }
      }
    }

    return tools;
  }

  /**
   * Convert GraphQL field to tool definition
   */
  private fieldToTool(field: GraphQLField, operationType: 'query' | 'mutation'): ToolDefinition {
    const inputSchema: any = {
      type: 'object',
      properties: {},
      required: [],
    };

    // Convert field arguments to JSON schema
    for (const arg of field.args) {
      const argType = this.graphqlTypeToJsonSchema(arg.type);
      inputSchema.properties[arg.name] = {
        ...argType,
        description: arg.description,
      };

      // Mark as required if non-null type
      if (this.isNonNullType(arg.type)) {
        inputSchema.required.push(arg.name);
      }
    }

    return {
      name: field.name,
      description: field.description || `${operationType}: ${field.name}`,
      inputSchema,
      outputSchema: {
        type: 'object',
        description: `Result from ${field.name}`,
      },
    };
  }

  /**
   * Convert GraphQL type to JSON Schema type
   */
  private graphqlTypeToJsonSchema(type: GraphQLType): any {
    // Unwrap non-null and list types
    let currentType = type;
    let isArray = false;

    while (currentType.kind === 'NON_NULL' || currentType.kind === 'LIST') {
      if (currentType.kind === 'LIST') {
        isArray = true;
      }
      if (currentType.ofType) {
        currentType = currentType.ofType;
      } else {
        break;
      }
    }

    // Map GraphQL scalar types to JSON schema types
    const scalarMap: Record<string, string> = {
      'String': 'string',
      'Int': 'integer',
      'Float': 'number',
      'Boolean': 'boolean',
      'ID': 'string',
    };

    let jsonType: any = {
      type: scalarMap[currentType.name || ''] || 'object',
    };

    if (isArray) {
      jsonType = {
        type: 'array',
        items: jsonType,
      };
    }

    return jsonType;
  }

  /**
   * Check if GraphQL type is non-null
   */
  private isNonNullType(type: GraphQLType): boolean {
    return type.kind === 'NON_NULL';
  }

  /**
   * Execute a GraphQL query or mutation
   */
  async execute(toolName: string, params: any): Promise<any> {
    const schema = await this.introspect();

    // Determine if this is a query or mutation
    const queryType = schema.__schema.types.find(
      t => t.name === schema.__schema.queryType?.name
    );
    const mutationType = schema.__schema.types.find(
      t => t.name === schema.__schema.mutationType?.name
    );

    let operationType: 'query' | 'mutation' = 'query';
    let field: GraphQLField | undefined;

    // Check query type first
    if (queryType?.fields) {
      field = queryType.fields.find(f => f.name === toolName);
    }

    // If not found, check mutation type
    if (!field && mutationType?.fields) {
      field = mutationType.fields.find(f => f.name === toolName);
      operationType = 'mutation';
    }

    if (!field) {
      throw executionError(
        toolName,
        `GraphQL field '${toolName}' not found in schema`
      );
    }

    // Build GraphQL query/mutation
    const operation = this.buildOperation(toolName, field, params, operationType);

    try {
      const headers = await this.getAuthHeaders();

      const response = await this.client.post('', {
        query: operation,
        variables: params,
      }, { headers });

      if (response.data.errors) {
        throw executionError(
          toolName,
          `GraphQL errors: ${JSON.stringify(response.data.errors)}`
        );
      }

      return response.data.data[toolName];
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw timeoutError(`GraphQL ${operationType} ${toolName}`, this.config.timeout || 30000);
        }
        throw executionError(
          toolName,
          `GraphQL execution failed: ${error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * Build GraphQL operation string
   */
  private buildOperation(
    name: string,
    field: GraphQLField,
    params: any,
    operationType: 'query' | 'mutation'
  ): string {
    const args = field.args
      .map(arg => `$${arg.name}: ${this.typeToString(arg.type)}`)
      .join(', ');

    const fieldArgs = field.args
      .map(arg => `${arg.name}: $${arg.name}`)
      .join(', ');

    return `
      ${operationType} ${name}${args ? `(${args})` : ''} {
        ${name}${fieldArgs ? `(${fieldArgs})` : ''} {
          __typename
        }
      }
    `;
  }

  /**
   * Convert GraphQL type to string representation
   */
  private typeToString(type: GraphQLType): string {
    if (type.kind === 'NON_NULL') {
      return `${this.typeToString(type.ofType!)}!`;
    }
    if (type.kind === 'LIST') {
      return `[${this.typeToString(type.ofType!)}]`;
    }
    return type.name || 'String';
  }

  /**
   * Close any connections
   */
  async close(): Promise<void> {
    // Axios doesn't need explicit cleanup
  }
}
