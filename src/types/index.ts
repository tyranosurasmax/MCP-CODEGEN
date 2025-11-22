/**
 * Core type definitions for mcp-codegen
 */

export interface MCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  disabled?: boolean;
}

export interface ServerMap {
  [serverName: string]: MCPServerConfig;
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
  codeMode: boolean;
  language: string;
  wrapperRoot: string;
  runtimePackage: string;
  version: string;
}

export interface BenchmarkData {
  rawToolsTokens: number;
  wrapperTokens: number;
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
