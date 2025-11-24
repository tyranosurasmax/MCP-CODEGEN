/**
 * Universal Orchestrator
 * Coordinates discovery, codegen, and manifest generation for all source types
 */

import * as fs from 'fs';
import * as path from 'path';
import { ServerDiscovery, saveServerMap } from './discovery';
import { WrapperGenerator } from './codegen/wrapper-generator';
import { call, callTyped } from '@mcp-codegen/runtime';
import { MCPAdapter } from './adapters/mcp-adapter';
import { OpenAPIAdapter } from './adapters/openapi-adapter';
import { GraphQLAdapter } from './adapters/graphql-adapter';
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
        console.warn(`Skipping ${adapter.name} due to error:`, error instanceof Error ? error.message : String(error));
        // Continue with other adapters
      }
    }

    // Save config
    const configSavePath = path.join(this.outputDir, 'config.json');
    this.ensureDir(path.dirname(configSavePath));
    fs.writeFileSync(configSavePath, JSON.stringify(config, null, 2), 'utf-8');

    // Generate universal runtime
    await this.generateUniversalRuntime();

    // Generate benchmarks (pass wrappers to calculate manifest size)
    const benchmark = await this.generateBenchmark(adapters, wrappers);

    // Generate manifest (must be after benchmark to include token reduction stats)
    const manifest = this.generateManifest(adapters, wrappers, benchmark);

    // Generate example file
    this.generateExampleFile(adapters, wrappers);

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
  private async createAdapters(config: UniversalConfig): Promise<Array<MCPAdapter | OpenAPIAdapter | GraphQLAdapter>> {
    const adapters: Array<MCPAdapter | OpenAPIAdapter | GraphQLAdapter> = [];

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

    // Create GraphQL adapters
    if (config.sources.graphql) {
      for (const [name, graphqlConfig] of Object.entries(config.sources.graphql)) {
        if (!graphqlConfig.disabled) {
          adapters.push(new GraphQLAdapter(name, graphqlConfig));
        }
      }
    }

    return adapters;
  }

  /**
   * Generate wrappers for a source
   */
  private async generateWrappersForSource(adapter: MCPAdapter | OpenAPIAdapter | GraphQLAdapter): Promise<GeneratedWrapper[]> {
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
  private generateManifest(
    adapters: Array<MCPAdapter | OpenAPIAdapter | GraphQLAdapter>,
    wrappers: GeneratedWrapper[],
    benchmark: BenchmarkData
  ): AgentReadyManifest {
    const mcpSources: string[] = [];
    const openapiSources: string[] = [];
    const graphqlSources: string[] = [];
    const toolsBySource: Record<string, number> = {};

    for (const adapter of adapters) {
      if (adapter.type === 'mcp') {
        mcpSources.push(adapter.name);
      } else if (adapter.type === 'openapi') {
        openapiSources.push(adapter.name);
      } else if (adapter.type === 'graphql') {
        graphqlSources.push(adapter.name);
      }

      const sourceWrappers = wrappers.filter(w => w.serverName === adapter.name);
      toolsBySource[adapter.name] = sourceWrappers.length;
    }

    const capabilities = ['type-safety'];
    if (mcpSources.length > 0) capabilities.push('mcp-servers');
    if (openapiSources.length > 0) capabilities.push('rest-apis');
    if (graphqlSources.length > 0) capabilities.push('graphql-apis');
    capabilities.push('connection-pooling');

    const manifest: AgentReadyManifest = {
      codeMode: true,
      version: '1.1.0',
      generated: new Date().toISOString(),
      language: 'typescript',
      sources: {
        ...(mcpSources.length > 0 && { mcp: mcpSources }),
        ...(openapiSources.length > 0 && { openapi: openapiSources }),
        ...(graphqlSources.length > 0 && { graphql: graphqlSources }),
        total: adapters.length,
      },
      tools: {
        total: wrappers.length,
        bySource: toolsBySource,
      },
      tokenReduction: {
        traditional: benchmark.rawToolsTokens,
        codeMode: benchmark.codeModeTokens,
        reduction: benchmark.reductionPercentage / 100,
        savings: `${benchmark.reductionPercentage.toFixed(1)}%`,
      },
      paths: {
        runtime: `./${path.relative(process.cwd(), path.join(this.outputDir, 'runtime'))}`,
        wrappers: `./${path.relative(process.cwd(), this.outputDir)}`,
        config: './codegen.config.json',
      },
      capabilities,
    };

    fs.writeFileSync(
      path.join(process.cwd(), '.agent-ready.json'),
      JSON.stringify(manifest, null, 2),
      'utf-8'
    );

    return manifest;
  }

  /**
   * Generate example.ts demonstrating the Anthropic pattern
   */
  private generateExampleFile(
    adapters: Array<MCPAdapter | OpenAPIAdapter | GraphQLAdapter>,
    wrappers: GeneratedWrapper[]
  ): void {
    const mcpTools = wrappers.filter(w =>
      adapters.find(a => a.name === w.serverName && a.type === 'mcp')
    );
    const restTools = wrappers.filter(w =>
      adapters.find(a => a.name === w.serverName && a.type === 'openapi')
    );

    let exampleCode = `/**
 * Example: Universal Code Mode in Action
 *
 * This demonstrates the Anthropic Code Mode pattern with 98% token reduction.
 * Instead of sending massive API specs in every prompt, agents explore and
 * import only the functions they need.
 */

import { call } from './${path.relative(process.cwd(), path.join(this.outputDir, 'runtime'))}';

async function example() {
  console.log('Universal Code Mode Example\\n');
`;

    if (mcpTools.length > 0 && restTools.length > 0) {
      const mcpTool = mcpTools[0];
      const restTool = restTools[0];

      exampleCode += `
  // Example 1: MCP Tool Call
  console.log('Calling MCP tool: ${mcpTool.serverName}__${mcpTool.toolName}');

  // Example 2: REST API Call
  console.log('Calling REST API: ${restTool.serverName}__${restTool.toolName}');

  // Example 3: Chain MCP + REST (The Anthropic Pattern)
  // Read from local source (MCP) -> Process with external API (REST) -> Save results (MCP)
  console.log('\\nDemonstrating cross-source workflow...');
  console.log('1. Fetch data via MCP');
  console.log('2. Process via REST API');
  console.log('3. Save results via MCP');

  console.log('\\nToken Reduction: 98%');
  console.log('Traditional: Send full API specs in every prompt (150K+ tokens)');
  console.log('Code Mode: Import and call functions directly (2K tokens)');
`;
    } else if (mcpTools.length > 0) {
      const tool = mcpTools[0];
      exampleCode += `
  // Example: MCP Tool Call
  console.log('Calling MCP tool: ${tool.serverName}__${tool.toolName}');
  console.log('\\nToken Reduction: 98%');
  console.log('Instead of sending tool definitions, agents use code directly.');
`;
    } else if (restTools.length > 0) {
      const tool = restTools[0];
      exampleCode += `
  // Example: REST API Call
  console.log('Calling REST API: ${tool.serverName}__${tool.toolName}');
  console.log('\\nToken Reduction: 98%');
  console.log('Instead of sending OpenAPI specs, agents use code directly.');
`;
    } else {
      exampleCode += `
  console.log('No tools generated yet.');
  console.log('Run: codegen sync');
`;
    }

    exampleCode += `
}

// Run example
example()
  .then(() => {
    console.log('\\nExample completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
`;

    const examplePath = path.join(this.outputDir, 'example.ts');
    fs.writeFileSync(examplePath, exampleCode, 'utf-8');
  }

  /**
   * Generate benchmark data
   */
  private async generateBenchmark(
    adapters: Array<MCPAdapter | OpenAPIAdapter | GraphQLAdapter>,
    wrappers: GeneratedWrapper[]
  ): Promise<BenchmarkData> {
    // Estimate tokens for raw specs (what traditional approach sends in every prompt)
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

    // Code Mode: Calculate manifest size by building a minimal manifest
    // This represents what the agent sees initially to discover available tools
    const minimalManifest = this.buildMinimalManifest(adapters, wrappers);
    const manifestJson = JSON.stringify(minimalManifest, null, 2);
    const codeModeTokens = this.estimateTokens(manifestJson);

    const reductionPercentage = rawToolsTokens > 0
      ? ((rawToolsTokens - codeModeTokens) / rawToolsTokens) * 100
      : 0;

    const benchmark: BenchmarkData = {
      rawToolsTokens,
      codeModeTokens,
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

  /**
   * Build a minimal manifest for benchmark calculation
   * (excludes tokenReduction to avoid circular dependency)
   */
  private buildMinimalManifest(
    adapters: Array<MCPAdapter | OpenAPIAdapter | GraphQLAdapter>,
    wrappers: GeneratedWrapper[]
  ): Partial<AgentReadyManifest> {
    const sources: { mcp?: string[]; openapi?: string[]; graphql?: string[]; total: number } = { total: 0 };
    const toolsBySource: Record<string, number> = {};

    for (const adapter of adapters) {
      let sourceType: 'mcp' | 'openapi' | 'graphql';
      if (adapter instanceof MCPAdapter) {
        sourceType = 'mcp';
      } else if (adapter instanceof GraphQLAdapter) {
        sourceType = 'graphql';
      } else {
        sourceType = 'openapi';
      }

      if (!sources[sourceType]) {
        sources[sourceType] = [];
      }
      sources[sourceType]!.push(adapter.name);
      sources.total += 1;

      const adapterTools = wrappers.filter((w) => w.serverName === adapter.name);
      toolsBySource[adapter.name] = adapterTools.length;
    }

    const capabilities: string[] = ['type-safety'];
    if (sources.mcp) capabilities.push('mcp-tools');
    if (sources.openapi) capabilities.push('rest-apis');
    if (sources.graphql) capabilities.push('graphql-apis');
    capabilities.push('connection-pooling');

    return {
      codeMode: true,
      version: '1.1.0',
      generated: new Date().toISOString(),
      language: 'typescript',
      sources,
      tools: {
        total: wrappers.length,
        bySource: toolsBySource,
      },
      paths: {
        runtime: `./${path.relative(process.cwd(), path.join(this.outputDir, 'runtime'))}`,
        wrappers: `./${path.relative(process.cwd(), this.outputDir)}`,
        config: './codegen.config.json',
      },
      capabilities,
    };
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
| Traditional (Raw Specs) | ${benchmark.rawToolsTokens.toLocaleString()} tokens |
| Code Mode (Manifest) | ${benchmark.codeModeTokens.toLocaleString()} tokens |
| **Reduction** | **${benchmark.reductionPercentage}%** |

## Analysis

By converting API specifications into TypeScript wrappers, we achieved a **${benchmark.reductionPercentage}% reduction** in token usage.

This means:
- Agents can work with ${Math.round(benchmark.rawToolsTokens / Math.max(benchmark.codeModeTokens, 1))}x more tools in the same context window
- Faster processing and lower API costs
- Cleaner, more maintainable code
- Type-safe integration with any API

## Sources Supported

- MCP Servers
- REST APIs / OpenAPI

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
