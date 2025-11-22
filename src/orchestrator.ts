/**
 * Orchestrator
 * Coordinates discovery, codegen, and manifest generation
 */

import * as fs from 'fs';
import * as path from 'path';
import { ServerDiscovery, saveServerMap } from './discovery';
import { WrapperGenerator } from './codegen/wrapper-generator';
import { MCPRuntime } from './runtime';
import {
  ServerMap,
  GenerationResult,
  AgentReadyManifest,
  BenchmarkData,
  GeneratedWrapper,
  ToolDefinition,
} from './types';

export interface OrchestratorOptions {
  outputDir?: string;
  runtimePackage?: string;
  configFile?: string;
}

export class Orchestrator {
  private outputDir: string;
  private runtimePackage: string;
  private discovery: ServerDiscovery;
  private generator: WrapperGenerator;

  constructor(options: OrchestratorOptions = {}) {
    this.outputDir = options.outputDir || './mcp';
    this.runtimePackage = options.runtimePackage || '@mcp-codegen/runtime';
    this.discovery = new ServerDiscovery();
    this.generator = new WrapperGenerator();
  }

  /**
   * Run full sync: discover servers, generate wrappers, create manifest
   */
  async sync(serverFilter?: string): Promise<GenerationResult> {
    // Discover servers
    const serverMap = await this.discovery.discover();

    // Filter if requested
    const filteredMap = serverFilter
      ? this.filterServers(serverMap, serverFilter)
      : serverMap;

    // Generate wrappers for all servers
    const wrappers = await this.generateAllWrappers(filteredMap);

    // Save server map
    const serverMapPath = path.join(this.outputDir, 'server-map.json');
    saveServerMap(filteredMap, serverMapPath);

    // Generate runtime
    await this.generateRuntime();

    // Generate manifest
    const manifest = this.generateManifest();

    // Generate benchmarks
    const benchmark = await this.generateBenchmark(filteredMap);

    return {
      wrappers,
      serverMap: filteredMap,
      manifest,
      benchmark,
    };
  }

  /**
   * Generate wrappers for a specific server
   */
  async generateServer(serverName: string, serverMap?: ServerMap): Promise<GeneratedWrapper[]> {
    const map = serverMap || await this.discovery.discover();
    const config = map[serverName];

    if (!config) {
      throw new Error(`Server not found: ${serverName}`);
    }

    return this.generateWrappersForServer(serverName, config);
  }

  /**
   * List all discovered servers
   */
  async listServers(): Promise<ServerMap> {
    return this.discovery.discover();
  }

  private async generateAllWrappers(serverMap: ServerMap): Promise<GeneratedWrapper[]> {
    const allWrappers: GeneratedWrapper[] = [];

    for (const [serverName, config] of Object.entries(serverMap)) {
      try {
        const wrappers = await this.generateWrappersForServer(serverName, config);
        allWrappers.push(...wrappers);
      } catch (error) {
        console.error(`Failed to generate wrappers for ${serverName}:`, error);
      }
    }

    return allWrappers;
  }

  private async generateWrappersForServer(
    serverName: string,
    config: any
  ): Promise<GeneratedWrapper[]> {
    const wrappers: GeneratedWrapper[] = [];

    // Save temporary server map file
    const tempMapPath = path.join(this.outputDir, '.temp-server-map.json');
    this.ensureDir(this.outputDir);
    fs.writeFileSync(tempMapPath, JSON.stringify({ [serverName]: config }), 'utf-8');

    // Create temporary runtime to fetch tools
    const runtime = new MCPRuntime(tempMapPath);

    try {
      const tools = await runtime.listTools(serverName);

      // Generate wrapper for each tool
      for (const tool of tools) {
        const toolDef: ToolDefinition = {
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          outputSchema: tool.outputSchema,
        };

        const filePath = await this.generator.generateWrapper({
          serverName,
          tool: toolDef,
          outputDir: path.join(this.outputDir, 'servers'),
          runtimePackage: this.runtimePackage,
        });

        wrappers.push({
          serverName,
          toolName: tool.name,
          filePath,
          hash: this.getFileHash(filePath),
        });
      }

      // Generate server index
      if (tools.length > 0) {
        this.generator.generateServerIndex(
          serverName,
          tools.map((t: any) => t.name),
          path.join(this.outputDir, 'servers')
        );
      }

      return wrappers;
    } finally {
      await runtime.closeAll();
      // Clean up temp file
      const tempMapPath = path.join(this.outputDir, '.temp-server-map.json');
      if (fs.existsSync(tempMapPath)) {
        fs.unlinkSync(tempMapPath);
      }
    }
  }

  private async generateRuntime(): Promise<void> {
    const runtimeDir = path.join(this.outputDir, 'runtime');
    this.ensureDir(runtimeDir);

    const runtimeContent = `// Runtime re-export
// This allows wrappers to use a local import path

export {
  callMCPTool,
  callMCPToolTyped,
  getClient,
  MCPRuntime,
  MCPConnectionError,
  MCPValidationError,
  MCPToolError,
  MCPTimeoutError
} from '@mcp-codegen/runtime';
`;

    fs.writeFileSync(
      path.join(runtimeDir, 'index.ts'),
      runtimeContent,
      'utf-8'
    );
  }

  private generateManifest(): AgentReadyManifest {
    const manifest: AgentReadyManifest = {
      codeMode: true,
      language: 'typescript',
      wrapperRoot: './mcp',
      runtimePackage: this.runtimePackage,
      version: '1.0.1',
    };

    fs.writeFileSync(
      path.join(process.cwd(), '.agent-ready.json'),
      JSON.stringify(manifest, null, 2),
      'utf-8'
    );

    return manifest;
  }

  private async generateBenchmark(serverMap: ServerMap): Promise<BenchmarkData> {
    // Estimate tokens for raw tool definitions
    const rawToolsJson = await this.getAllToolsJson(serverMap);
    const rawToolsTokens = this.estimateTokens(rawToolsJson);

    // Estimate tokens for generated wrappers
    const wrapperFiles = this.getAllWrapperFiles();
    let wrapperContent = '';
    for (const file of wrapperFiles) {
      wrapperContent += fs.readFileSync(file, 'utf-8');
    }
    const wrapperTokens = this.estimateTokens(wrapperContent);

    const reductionPercentage = ((rawToolsTokens - wrapperTokens) / rawToolsTokens) * 100;

    const benchmark: BenchmarkData = {
      rawToolsTokens,
      wrapperTokens,
      reductionPercentage: Math.round(reductionPercentage * 100) / 100,
      estimationMethod: 'chars/4',
      timestamp: new Date().toISOString(),
    };

    // Save JSON
    fs.writeFileSync(
      path.join(this.outputDir, 'benchmark.json'),
      JSON.stringify(benchmark, null, 2),
      'utf-8'
    );

    // Save markdown report
    const markdownReport = this.generateBenchmarkMarkdown(benchmark);
    fs.writeFileSync(
      path.join(this.outputDir, 'BENCHMARK.md'),
      markdownReport,
      'utf-8'
    );

    return benchmark;
  }

  private async getAllToolsJson(serverMap: ServerMap): Promise<string> {
    const allTools: any[] = [];

    // Save temporary server map file
    const tempMapPath = path.join(this.outputDir, '.temp-server-map.json');
    fs.writeFileSync(tempMapPath, JSON.stringify(serverMap), 'utf-8');

    const runtime = new MCPRuntime(tempMapPath);

    try {
      for (const serverName of Object.keys(serverMap)) {
        try {
          const tools = await runtime.listTools(serverName);
          allTools.push(...tools);
        } catch (error) {
          console.warn(`Failed to fetch tools from ${serverName}:`, error);
        }
      }
    } finally {
      await runtime.closeAll();
      // Clean up temp file
      if (fs.existsSync(tempMapPath)) {
        fs.unlinkSync(tempMapPath);
      }
    }

    return JSON.stringify(allTools, null, 2);
  }

  private getAllWrapperFiles(): string[] {
    const serversDir = path.join(this.outputDir, 'servers');
    if (!fs.existsSync(serversDir)) return [];

    const files: string[] = [];
    const walk = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.name.endsWith('.ts')) {
          files.push(fullPath);
        }
      }
    };

    walk(serversDir);
    return files;
  }

  private estimateTokens(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  private generateBenchmarkMarkdown(benchmark: BenchmarkData): string {
    return `# MCP-CODEGEN Token Usage Benchmark

Generated: ${benchmark.timestamp}

## Results

| Metric | Value |
|--------|-------|
| Raw MCP Tools (JSON) | ${benchmark.rawToolsTokens.toLocaleString()} tokens |
| Generated Wrappers (TypeScript) | ${benchmark.wrapperTokens.toLocaleString()} tokens |
| **Reduction** | **${benchmark.reductionPercentage}%** |

## Analysis

By converting MCP tool definitions into TypeScript wrappers, we achieved a **${benchmark.reductionPercentage}% reduction** in token usage.

This means:
- Agents can work with ${Math.round(benchmark.rawToolsTokens / benchmark.wrapperTokens)}x more tools in the same context window
- Faster processing and lower API costs
- Cleaner, more maintainable code

## Estimation Method

${benchmark.estimationMethod}

---

*Generated by mcp-codegen v1.0.1*
`;
  }

  private filterServers(serverMap: ServerMap, filter: string): ServerMap {
    const filtered: ServerMap = {};
    for (const [name, config] of Object.entries(serverMap)) {
      if (name.includes(filter)) {
        filtered[name] = config;
      }
    }
    return filtered;
  }

  private getFileHash(filePath: string): string {
    const content = fs.readFileSync(filePath, 'utf-8');
    const match = content.match(/\/\/ hash: ([a-f0-9]+)/);
    return match ? match[1] : '';
  }

  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
