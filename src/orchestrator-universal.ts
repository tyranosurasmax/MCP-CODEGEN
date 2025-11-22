/**
 * Universal Orchestrator
 * Coordinates discovery, codegen, and manifest generation for all source types
 */

import * as fs from 'fs';
import * as path from 'path';
import { ServerDiscovery, saveServerMap } from './discovery';
import { WrapperGenerator } from './codegen/wrapper-generator';
import { UniversalRuntime } from './runtime/universal-runtime';
import { MCPAdapter } from './adapters/mcp-adapter';
import { OpenAPIAdapter } from './adapters/openapi-adapter';
import {
  UniversalConfig,
  GenerationResult,
  AgentReadyManifest,
  BenchmarkData,
  GeneratedWrapper,
  ToolDefinition,
} from './types';

export interface UniversalOrchestratorOptions {
  outputDir?: string;
  runtimePackage?: string;
  configFile?: string;
}

/**
 * Universal Orchestrator - handles all source types
 */
export class UniversalOrchestrator {
  private outputDir: string;
  private runtimePackage: string;
  private generator: WrapperGenerator;

  constructor(options: UniversalOrchestratorOptions = {}) {
    this.outputDir = options.outputDir || './codegen';
    this.runtimePackage = options.runtimePackage || 'codegen/runtime';
    this.generator = new WrapperGenerator();
  }

  /**
   * Run full sync: discover all sources, generate wrappers, create manifest
   */
  async sync(configPath?: string): Promise<GenerationResult> {
    // Load universal config
    const config = this.loadUniversalConfig(configPath);

    // Create adapters
    const adapters = await this.createAdapters(config);

    // Generate wrappers for all sources
    const wrappers: GeneratedWrapper[] = [];
    for (const adapter of adapters) {
      try {
        const sourceWrappers = await this.generateWrappersForSource(adapter);
        wrappers.push(...sourceWrappers);
      } catch (error) {
        console.error(`Failed to generate wrappers for ${adapter.name}:`, error);
      }
    }

    // Save config
    const configSavePath = path.join(this.outputDir, 'config.json');
    this.ensureDir(path.dirname(configSavePath));
    fs.writeFileSync(configSavePath, JSON.stringify(config, null, 2), 'utf-8');

    // Generate universal runtime
    await this.generateUniversalRuntime();

    // Generate manifest
    const manifest = this.generateManifest();

    // Generate benchmarks
    const benchmark = await this.generateBenchmark(adapters);

    // Cleanup
    for (const adapter of adapters) {
      await adapter.close();
    }

    return {
      wrappers,
      serverMap: {}, // Legacy field
      manifest,
      benchmark,
    };
  }

  /**
   * Load universal configuration
   */
  private loadUniversalConfig(configPath?: string): UniversalConfig {
    // Try provided path first
    if (configPath && fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(content);
    }

    // Try default locations
    const defaultPaths = [
      'codegen.config.json',
      '.codegenrc',
      'mcp-codegen.json', // Legacy
    ];

    for (const defaultPath of defaultPaths) {
      if (fs.existsSync(defaultPath)) {
        const content = fs.readFileSync(defaultPath, 'utf-8');
        const config = JSON.parse(content);

        // Convert legacy format to universal format
        if (config.servers && !config.sources) {
          return {
            sources: {
              mcp: config.servers,
            },
            outputDir: config.outputDir,
            runtimePackage: config.runtimePackage,
          };
        }

        return config;
      }
    }

    // No config found - try legacy discovery
    console.warn('No universal config found, falling back to MCP discovery...');
    return {
      sources: {
        mcp: {}, // Will be populated by discovery
      },
    };
  }

  /**
   * Create adapters from config
   */
  private async createAdapters(config: UniversalConfig): Promise<Array<MCPAdapter | OpenAPIAdapter>> {
    const adapters: Array<MCPAdapter | OpenAPIAdapter> = [];

    // Create MCP adapters
    if (config.sources.mcp) {
      for (const [name, mcpConfig] of Object.entries(config.sources.mcp)) {
        if (!mcpConfig.disabled) {
          adapters.push(new MCPAdapter(name, mcpConfig));
        }
      }
    }

    // Create OpenAPI adapters
    if (config.sources.openapi) {
      for (const [name, apiConfig] of Object.entries(config.sources.openapi)) {
        if (!apiConfig.disabled) {
          adapters.push(new OpenAPIAdapter(name, apiConfig));
        }
      }
    }

    return adapters;
  }

  /**
   * Generate wrappers for a source
   */
  private async generateWrappersForSource(adapter: MCPAdapter | OpenAPIAdapter): Promise<GeneratedWrapper[]> {
    const wrappers: GeneratedWrapper[] = [];

    try {
      const tools = await adapter.discover();

      // Generate wrapper for each tool
      const toolNames: string[] = [];
      for (const tool of tools) {
        const toolDef: ToolDefinition = {
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          outputSchema: tool.outputSchema,
        };

        const filePath = await this.generator.generateWrapper({
          serverName: adapter.name,
          tool: toolDef,
          outputDir: path.join(this.outputDir, adapter.type),
          runtimePackage: this.runtimePackage,
        });

        wrappers.push({
          serverName: adapter.name,
          toolName: tool.name,
          filePath,
          hash: this.getFileHash(filePath),
        });

        toolNames.push(tool.name);
      }

      // Generate source index
      if (tools.length > 0) {
        this.generator.generateServerIndex(
          adapter.name,
          toolNames,
          path.join(this.outputDir, adapter.type)
        );
      }

      return wrappers;
    } catch (error) {
      console.error(`Error generating wrappers for ${adapter.name}:`, error);
      return [];
    }
  }

  /**
   * Generate universal runtime file
   */
  private async generateUniversalRuntime(): Promise<void> {
    const runtimeDir = path.join(this.outputDir, 'runtime');
    this.ensureDir(runtimeDir);

    const runtimeContent = `// Universal Runtime re-export
// This allows wrappers to use a local import path

export {
  call,
  callTyped,
  getAdapter,
  discoverAll,
  UniversalRuntime,
  getRuntime,
  // Legacy MCP API
  callMCPTool,
  callMCPToolTyped,
  getClient
} from 'codegen/runtime/universal-runtime';
`;

    fs.writeFileSync(
      path.join(runtimeDir, 'index.ts'),
      runtimeContent,
      'utf-8'
    );
  }

  /**
   * Generate .agent-ready.json manifest
   */
  private generateManifest(): AgentReadyManifest {
    const manifest: AgentReadyManifest = {
      codeMode: true,
      language: 'typescript',
      wrapperRoot: `./${path.relative(process.cwd(), this.outputDir)}`,
      runtimePackage: this.runtimePackage,
      version: '1.1.0',
    };

    fs.writeFileSync(
      path.join(process.cwd(), '.agent-ready.json'),
      JSON.stringify(manifest, null, 2),
      'utf-8'
    );

    return manifest;
  }

  /**
   * Generate benchmark data
   */
  private async generateBenchmark(adapters: Array<MCPAdapter | OpenAPIAdapter>): Promise<BenchmarkData> {
    // Estimate tokens for raw specs
    let rawSpecsJson = '';
    for (const adapter of adapters) {
      try {
        const tools = await adapter.discover();
        rawSpecsJson += JSON.stringify(tools, null, 2);
      } catch (error) {
        console.warn(`Failed to fetch tools from ${adapter.name}:`, error);
      }
    }
    const rawToolsTokens = this.estimateTokens(rawSpecsJson);

    // Estimate tokens for generated wrappers
    const wrapperFiles = this.getAllWrapperFiles();
    let wrapperContent = '';
    for (const file of wrapperFiles) {
      wrapperContent += fs.readFileSync(file, 'utf-8');
    }
    const wrapperTokens = this.estimateTokens(wrapperContent);

    const reductionPercentage = rawToolsTokens > 0
      ? ((rawToolsTokens - wrapperTokens) / rawToolsTokens) * 100
      : 0;

    const benchmark: BenchmarkData = {
      rawToolsTokens,
      wrapperTokens,
      reductionPercentage: Math.round(reductionPercentage * 100) / 100,
      estimationMethod: 'chars/4',
      timestamp: new Date().toISOString(),
    };

    // Save JSON
    this.ensureDir(this.outputDir);
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

  private getAllWrapperFiles(): string[] {
    if (!fs.existsSync(this.outputDir)) return [];

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

    walk(this.outputDir);
    return files;
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private generateBenchmarkMarkdown(benchmark: BenchmarkData): string {
    return `# Universal CODEGEN Token Usage Benchmark

Generated: ${benchmark.timestamp}

## Results

| Metric | Value |
|--------|-------|
| Raw API Specs (JSON) | ${benchmark.rawToolsTokens.toLocaleString()} tokens |
| Generated Wrappers (TypeScript) | ${benchmark.wrapperTokens.toLocaleString()} tokens |
| **Reduction** | **${benchmark.reductionPercentage}%** |

## Analysis

By converting API specifications into TypeScript wrappers, we achieved a **${benchmark.reductionPercentage}% reduction** in token usage.

This means:
- Agents can work with ${Math.round(benchmark.rawToolsTokens / Math.max(benchmark.wrapperTokens, 1))}x more tools in the same context window
- Faster processing and lower API costs
- Cleaner, more maintainable code
- Type-safe integration with any API

## Sources Supported

- ✅ MCP Servers
- ✅ REST APIs (OpenAPI)
- 🔜 GraphQL APIs
- 🔜 Databases

## Estimation Method

${benchmark.estimationMethod}

---

*Generated by universal codegen v1.1.0*
`;
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
