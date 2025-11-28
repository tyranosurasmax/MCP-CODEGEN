#!/usr/bin/env node

/**
 * MCP-CODEGEN CLI
 * Command-line interface for the mcp-codegen tool
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { Orchestrator } from './orchestrator';
import { UniversalOrchestrator } from './orchestrator-universal';
import { ServerDiscovery } from './discovery';
import * as fs from 'fs';
import * as path from 'path';

const program = new Command();

program
  .name('mcp-codegen')
  .description('Universal Code Mode - Transform ANY API into type-safe TypeScript wrappers with 98% token reduction')
  .version('1.1.0');

/**
 * Sync command: discover and generate all wrappers
 */
program
  .command('sync')
  .description('Discover all API sources (MCP, REST, GraphQL) and generate TypeScript wrappers')
  .option('-s, --server <path>', 'Path to specific server config file')
  .option('-f, --filter <name>', 'Filter servers by name')
  .option('-o, --output <dir>', 'Output directory (default: ./mcp)')
  .action(async (options) => {
    const spinner = ora('Discovering MCP servers...').start();

    try {
      const orchestrator = new Orchestrator({
        outputDir: options.output,
        configFile: options.server,
      });

      const result = await orchestrator.sync(options.filter);

      spinner.succeed(
        `Generated ${result.wrappers.length} wrappers for ${Object.keys(result.serverMap).length} servers`
      );

      console.log(chalk.green('\n✓ Success!'));
      console.log(chalk.dim(`  Server map: mcp/server-map.json`));
      console.log(chalk.dim(`  Wrappers: mcp/servers/`));
      console.log(chalk.dim(`  Manifest: .agent-ready.json`));
      console.log(
        chalk.yellow(`\n📊 Token reduction: ${result.benchmark.reductionPercentage}%`)
      );
      console.log(
        chalk.dim(
          `  ${result.benchmark.rawToolsTokens.toLocaleString()} → ${result.benchmark.codeModeTokens.toLocaleString()} tokens`
        )
      );
    } catch (error) {
      spinner.fail('Failed to sync');
      console.error(chalk.red('\n' + (error instanceof Error ? error.message : String(error))));
      process.exit(1);
    }
  });

/**
 * Generate command: generate wrappers for specific server
 */
program
  .command('generate <server>')
  .description('Generate wrappers for a specific API source')
  .option('-o, --output <dir>', 'Output directory (default: ./mcp)')
  .action(async (serverName, options) => {
    const spinner = ora(`Generating wrappers for ${serverName}...`).start();

    try {
      const orchestrator = new Orchestrator({
        outputDir: options.output,
      });

      const wrappers = await orchestrator.generateServer(serverName);

      spinner.succeed(`Generated ${wrappers.length} wrappers for ${serverName}`);

      console.log(chalk.green('\n✓ Success!'));
      for (const wrapper of wrappers) {
        console.log(chalk.dim(`  ${wrapper.toolName} → ${wrapper.filePath}`));
      }
    } catch (error) {
      spinner.fail('Failed to generate');
      console.error(chalk.red('\n' + (error instanceof Error ? error.message : String(error))));
      process.exit(1);
    }
  });

/**
 * List command: list all discovered servers
 */
program
  .command('list')
  .description('List all discovered API sources')
  .action(async () => {
    const spinner = ora('Discovering MCP servers...').start();

    try {
      const discovery = new ServerDiscovery();
      const serverMap = await discovery.discover();

      spinner.stop();

      const count = Object.keys(serverMap).length;
      console.log(chalk.bold(`\nFound ${count} MCP server${count === 1 ? '' : 's'}:\n`));

      for (const [name, config] of Object.entries(serverMap)) {
        console.log(chalk.cyan(`  • ${name}`));
        console.log(chalk.dim(`    Command: ${config.command} ${(config.args || []).join(' ')}`));
      }

      if (count === 0) {
        console.log(chalk.yellow('  No servers found. Check your MCP configuration.'));
      }
    } catch (error) {
      spinner.fail('Failed to list servers');
      console.error(chalk.red('\n' + (error instanceof Error ? error.message : String(error))));
      process.exit(1);
    }
  });

/**
 * Quickstart command: initialize new project with the WOW factor
 */
program
  .command('quickstart')
  .description('Initialize Universal Code Mode with 98% token reduction')
  .action(async () => {
    console.log(chalk.bold.cyan('\n=== CODEGEN QUICKSTART ===\n'));
    console.log('Activating Universal Code Mode...\n');

    const spinner = ora('Discovering API sources...').start();

    try {
      // Auto-detect configuration or use defaults
      let configPath = 'codegen.config.json';
      if (!fs.existsSync(configPath) && !fs.existsSync('mcp-codegen.json')) {
        spinner.warn('No configuration found. Please create codegen.config.json first.');
        console.log(chalk.yellow('\nExample configuration:'));
        console.log(chalk.dim(`{
  "sources": {
    "mcp": {
      "filesystem": {
        "type": "mcp",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
      }
    }
  }
}`));
        return;
      }

      // Use UniversalOrchestrator
      spinner.text = 'Generating type-safe wrappers...';
      const orchestrator = new UniversalOrchestrator();
      const result = await orchestrator.sync(configPath);

      spinner.succeed('Code generation complete!');

      // Display results
      console.log(chalk.bold.green('\n=== CODE MODE ACTIVATED ===\n'));

      console.log(chalk.bold('Sources Discovered:'));
      if (result.manifest.sources.mcp) {
        console.log(chalk.cyan(`  MCP Servers: ${result.manifest.sources.mcp.join(', ')}`));
      }
      if (result.manifest.sources.openapi) {
        console.log(chalk.cyan(`  REST APIs: ${result.manifest.sources.openapi.join(', ')}`));
      }
      console.log(chalk.dim(`  Total: ${result.manifest.sources.total} sources\n`));

      console.log(chalk.bold('Tools Generated:'));
      console.log(chalk.cyan(`  ${result.manifest.tools.total} TypeScript functions`));
      for (const [source, count] of Object.entries(result.manifest.tools.bySource)) {
        console.log(chalk.dim(`    ${source}: ${count} tools`));
      }

      console.log(chalk.bold('\nToken Reduction:'));
      console.log(chalk.red(`  Traditional: ${result.benchmark.rawToolsTokens.toLocaleString()} tokens`));
      console.log(chalk.green(`  Code Mode: ${result.benchmark.codeModeTokens.toLocaleString()} tokens`));
      console.log(chalk.bold.yellow(`  Reduction: ${result.benchmark.reductionPercentage.toFixed(1)}%\n`));

      const costSavings = ((result.benchmark.rawToolsTokens - result.benchmark.codeModeTokens) * 0.003 / 1000).toFixed(2);
      console.log(chalk.bold.green(`  Estimated savings: $${costSavings} per agent session\n`));

      spinner.succeed('Project initialized!');

      console.log(chalk.bold('Generated Files:'));
      console.log(chalk.dim('  • codegen/              - Type-safe wrappers'));
      console.log(chalk.dim('  • codegen/runtime/      - Universal runtime'));
      console.log(chalk.dim('  • codegen/example.ts    - Usage demonstration'));
      console.log(chalk.dim('  • codegen/BENCHMARK.md  - Token reduction proof'));
      console.log(chalk.dim('  • .agent-ready.json     - Agent discovery signal'));

      console.log(chalk.bold('\nNext Steps:'));
      console.log(chalk.cyan('  1. npx tsx codegen/example.ts    - Run the example'));
      console.log(chalk.cyan('  2. cat .agent-ready.json         - View manifest'));
      console.log(chalk.cyan('  3. cat codegen/BENCHMARK.md      - See full benchmark'));

      console.log(chalk.bold.green('\nCode Mode is active. Your agents can now use optimized wrappers!\n'));
    } catch (error) {
      spinner.fail('Quickstart failed');
      console.error(chalk.red('\n' + (error instanceof Error ? error.message : String(error))));
      process.exit(1);
    }
  });

// Parse and execute
program.parse();
