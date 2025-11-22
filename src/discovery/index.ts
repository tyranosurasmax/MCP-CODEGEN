/**
 * MCP Server Discovery
 * Discovers MCP servers from various configuration sources
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ServerMap, MCPServerConfig } from '../types';

export class ServerDiscovery {
  private sources: string[] = [];

  constructor(private cwd: string = process.cwd()) {
    this.initializeSources();
  }

  private initializeSources(): void {
    // Priority order as per spec
    this.sources = [
      path.join(this.cwd, 'mcp-codegen.json'),
      ...this.getUserMCPConfigs(),
      ...this.getClaudeDesktopConfigs(),
      ...this.getSystemConfigs(),
    ];
  }

  private getUserMCPConfigs(): string[] {
    const configDir = path.join(os.homedir(), '.config', 'mcp');
    if (!fs.existsSync(configDir)) return [];

    try {
      return fs
        .readdirSync(configDir)
        .filter(f => f.endsWith('.json'))
        .map(f => path.join(configDir, f));
    } catch {
      return [];
    }
  }

  private getClaudeDesktopConfigs(): string[] {
    const configs: string[] = [];

    if (process.platform === 'darwin') {
      configs.push(
        path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
      );
    } else if (process.platform === 'win32') {
      configs.push(
        path.join(os.homedir(), 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json')
      );
    } else {
      // Linux
      configs.push(
        path.join(os.homedir(), '.config', 'Claude', 'claude_desktop_config.json')
      );
    }

    return configs.filter(fs.existsSync);
  }

  private getSystemConfigs(): string[] {
    // Platform-specific system configs
    if (process.platform === 'win32') {
      return ['C:\\ProgramData\\mcp\\config.json'].filter(fs.existsSync);
    }
    return ['/etc/mcp/config.json'].filter(fs.existsSync);
  }

  /**
   * Discover all MCP servers from available sources
   */
  async discover(): Promise<ServerMap> {
    const serverMap: ServerMap = {};

    for (const source of this.sources) {
      if (!fs.existsSync(source)) continue;

      try {
        const config = this.loadConfig(source);
        Object.assign(serverMap, config);
      } catch (error) {
        console.warn(`Failed to load config from ${source}:`, error);
      }
    }

    return this.filterDisabled(serverMap);
  }

  private loadConfig(configPath: string): ServerMap {
    const content = fs.readFileSync(configPath, 'utf-8');
    const json = JSON.parse(content);

    // Handle different config formats
    if (json.mcpServers) {
      // Claude Desktop format
      return json.mcpServers;
    } else if (json.servers) {
      // mcp-codegen format
      return json.servers;
    } else {
      // Direct server map
      return json;
    }
  }

  private filterDisabled(serverMap: ServerMap): ServerMap {
    const filtered: ServerMap = {};

    for (const [name, config] of Object.entries(serverMap)) {
      if (!config.disabled) {
        filtered[name] = config;
      }
    }

    return filtered;
  }

  /**
   * Load server from specific config file
   */
  async loadFromFile(configPath: string): Promise<ServerMap> {
    if (!fs.existsSync(configPath)) {
      throw new Error(`Config file not found: ${configPath}`);
    }

    return this.loadConfig(configPath);
  }
}

/**
 * Save server map to file
 */
export function saveServerMap(serverMap: ServerMap, outputPath: string): void {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(
    outputPath,
    JSON.stringify(serverMap, null, 2),
    'utf-8'
  );
}
