/**
 * Core type definitions for universal codegen
 */

// ============================================================================
// MCP Types
// ============================================================================

export interface MCPServerConfig {
  type?: 'mcp';
  command: string;
  args?: string[];
  env?: Record<string, string>;
  disabled?: boolean;
}

export interface ServerMap {
  [serverName: string]: MCPServerConfig;
}

// ============================================================================
// OpenAPI Types
// ============================================================================

export interface OpenAPIConfig {
  type: 'openapi';
  spec: string; // URL or file path to OpenAPI spec
  baseUrl?: string; // Override base URL
  headers?: Record<string, string>;
  auth?: OpenAPIAuth;
  disabled?: boolean;
}

export type OpenAPIAuth =
  | { type: 'bearer'; token: string }
  | { type: 'apiKey'; name: string; in: 'header' | 'query'; value: string }
  | { type: 'basic'; username: string; password: string }
  | { type: 'oauth2'; token: string };

export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers?: Array<{
    url: string;
    description?: string;
  }>;
  paths: {
    [path: string]: {
      [method: string]: any;
    };
  };
  components?: any;
}

// ============================================================================
// GraphQL Types
// ============================================================================

export interface GraphQLConfig {
  type: 'graphql';
  endpoint: string; // GraphQL endpoint URL
  auth?: GraphQLAuth;
  headers?: Record<string, string>;
  timeout?: number;
  disabled?: boolean;
}

export type GraphQLAuth =
  | { type: 'bearer'; token: string }
  | { type: 'apiKey'; name: string; in: 'header' | 'query'; value: string }
  | { type: 'basic'; username: string; password: string }
  | { type: 'oauth2'; token: string };

// ============================================================================
// Universal Types
// ============================================================================

export type SourceConfig = MCPServerConfig | OpenAPIConfig | GraphQLConfig;

export interface UniversalConfig {
  sources: {
    mcp?: { [name: string]: MCPServerConfig };
    openapi?: { [name: string]: OpenAPIConfig };
    graphql?: { [name: string]: GraphQLConfig };
    // Future: database, grpc, etc.
  };
  outputDir?: string;
  runtimePackage?: string;
}

export interface SourceInfo {
  name: string;
  type: string;
  config: SourceConfig;
}

export interface ToolDefinition {
  name: string;
  description?: string;
  inputSchema: any;
  outputSchema?: any;
}

export interface ServerToolInfo {
  serverName: string;
  tools: ToolDefinition[];
}

export interface GeneratedWrapper {
  serverName: string;
  toolName: string;
  filePath: string;
  hash: string;
}

export interface CodegenConfig {
  servers?: ServerMap;
  outputDir?: string;
  runtimePackage?: string;
}

export interface AgentReadyManifest {
  $schema?: string;
  specVersion: string;
  codeMode: boolean;
  name: string;
  description: string;
  version: string;
  generated: string;
  language: string;
  sources: {
    mcp?: string[];
    openapi?: string[];
    graphql?: string[];
    database?: string[];
    custom?: string[];
    total: number;
  };
  tools: {
    total: number;
    bySource: Record<string, number>;
  };
  paths: {
    runtime: string;
    wrappers: string;
    config: string;
  };
  capabilities: string[];
  auth?: {
    required: boolean;
    sources: Record<string, {
      types: string[];
      default?: string;
      required?: boolean;
      instructions?: string;
    }>;
  };
  tokenReduction?: {
    traditional: number;
    codeMode: number;
    reduction: number;
    savings: string;
  };
  metadata?: {
    generatedBy?: string;
    checksum?: string;
    homepage?: string;
    repository?: string;
    license?: string;
  };
}

export interface BenchmarkData {
  rawToolsTokens: number;
  codeModeTokens: number;
  reductionPercentage: number;
  estimationMethod: string;
  timestamp: string;
}

export interface GenerationResult {
  wrappers: GeneratedWrapper[];
  serverMap: ServerMap;
  manifest: AgentReadyManifest;
  benchmark: BenchmarkData;
}
