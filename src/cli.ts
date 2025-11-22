#!/usr/bin/env node

/**
 * MCP-CODEGEN CLI
 * Command-line interface for the mcp-codegen tool
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { Orchestrator } from './orchestrator';
import { ServerDiscovery } from './discovery';
import * as fs from 'fs';
import * as path from 'path';

const program = new Command();

program
  .name('mcp-codegen')
  .description('Transform MCP servers into TypeScript tool filesystems')
  .version('1.0.1');

/**
 * Sync command: discover and generate all wrappers
 */
program
  .command('sync')
  .description('Discover MCP servers and generate TypeScript wrappers')
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
          `  ${result.benchmark.rawToolsTokens.toLocaleString()} → ${result.benchmark.wrapperTokens.toLocaleString()} tokens`
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
  .description('Generate wrappers for a specific MCP server')
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
  .description('List all discovered MCP servers')
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
 * Quickstart command: initialize new project
 */
program
  .command('quickstart')
  .description('Initialize a new mcp-codegen project')
  .action(async () => {
    console.log(chalk.bold('\n🚀 MCP-CODEGEN Quickstart\n'));

    const spinner = ora('Setting up project...').start();

    try {
      // Create tsconfig if it doesn't exist
      if (!fs.existsSync('tsconfig.json')) {
        const tsconfig = {
          compilerOptions: {
            target: 'ES2022',
            module: 'commonjs',
            lib: ['ES2022'],
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
            moduleResolution: 'node',
            resolveJsonModule: true,
          },
          include: ['mcp/**/*', 'example.ts'],
        };

        fs.writeFileSync('tsconfig.json', JSON.stringify(tsconfig, null, 2));
        spinner.text = 'Created tsconfig.json';
      }

      // Run sync
      spinner.text = 'Discovering and generating wrappers...';
      const orchestrator = new Orchestrator();
      const result = await orchestrator.sync();

      // Create example file
      const exampleContent = `import { callMCPTool } from "./mcp/runtime";

async function main() {
  try {
    // Example: Call an MCP tool
    // const result = await callMCPTool("server-name__tool-name", { param: "value" });
    // console.log(result);

    console.log("MCP Code Mode ready!");
    console.log("Available servers:", ${Object.keys(result.serverMap).length});
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
`;

      fs.writeFileSync('example.ts', exampleContent);

      // Create agent harness example
      const harnessContent = `/**
 * Agent Harness Example
 * This demonstrates how an agent can use the generated wrappers
 */

import * as fs from 'fs';
import * as path from 'path';

async function agentHarness() {
  // 1. Read .agent-ready.json to confirm Code Mode is enabled
  const manifest = JSON.parse(fs.readFileSync('.agent-ready.json', 'utf-8'));

  if (!manifest.codeMode) {
    throw new Error('Code Mode not enabled');
  }

  console.log(\`Code Mode: \${manifest.language}\`);
  console.log(\`Wrapper Root: \${manifest.wrapperRoot}\`);

  // 2. Explore available servers
  const serversDir = path.join(manifest.wrapperRoot, 'servers');
  const servers = fs.readdirSync(serversDir);

  console.log(\`\\nAvailable servers: \${servers.join(', ')}\`);

  // 3. Import and use tools (example)
  // const { someServer } = await import('./mcp/servers/some-server');
  // const result = await someServer.someTool({ param: 'value' });
  // console.log(result);
}

agentHarness().catch(console.error);
`;

      fs.writeFileSync('agent-harness.example.ts', harnessContent);

      spinner.succeed('Project initialized!');

      console.log(chalk.green('\n✓ Quickstart complete!\n'));
      console.log(chalk.bold('Files created:'));
      console.log(chalk.dim('  • mcp/                  - Generated wrappers'));
      console.log(chalk.dim('  • mcp/server-map.json   - Server configuration'));
      console.log(chalk.dim('  • .agent-ready.json     - Code Mode manifest'));
      console.log(chalk.dim('  • tsconfig.json         - TypeScript configuration'));
      console.log(chalk.dim('  • example.ts            - Example usage'));
      console.log(chalk.dim('  • agent-harness.example.ts - Agent integration example'));

      console.log(chalk.yellow(`\n📊 Token reduction: ${result.benchmark.reductionPercentage}%\n`));

      console.log(chalk.bold('Next steps:'));
      console.log(chalk.dim('  1. npm install'));
      console.log(chalk.dim('  2. Edit example.ts to use your tools'));
      console.log(chalk.dim('  3. npx tsx example.ts'));
    } catch (error) {
      spinner.fail('Quickstart failed');
      console.error(chalk.red('\n' + (error instanceof Error ? error.message : String(error))));
      process.exit(1);
    }
  });

// Parse and execute
program.parse();
