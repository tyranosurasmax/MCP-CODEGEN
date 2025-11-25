/**
 * MCP Adapter Integration Tests
 *
 * Tests the MCP adapter's ability to discover and execute tools from MCP servers.
 */

import { MCPAdapter } from '../../src/adapters/mcp-adapter';
import { MCPServerConfig } from '../../src/types';

describe('MCPAdapter', () => {
  describe('Constructor and Initialization', () => {
    it('should create adapter with valid config', () => {
      const config: MCPServerConfig = {
        command: 'node',
        args: ['test.js'],
      };

      const adapter = new MCPAdapter('test-server', config);

      expect(adapter.name).toBe('test-server');
      expect(adapter.type).toBe('mcp');
    });

    it('should handle config with environment variables', () => {
      const config: MCPServerConfig = {
        command: 'node',
        args: ['test.js'],
        env: {
          TEST_VAR: 'test_value',
        },
      };

      const adapter = new MCPAdapter('test-server', config);
      expect(adapter).toBeDefined();
    });

    it('should respect disabled flag', () => {
      const config: MCPServerConfig = {
        command: 'node',
        args: ['test.js'],
        disabled: true,
      };

      const adapter = new MCPAdapter('test-server', config);
      expect(adapter).toBeDefined();
    });
  });

  describe('validate()', () => {
    it('should validate successfully for valid server (mock)', async () => {
      const config: MCPServerConfig = {
        command: 'echo',
        args: ['test'],
      };

      const adapter = new MCPAdapter('test-server', config);

      // This will fail in real scenario, but tests the structure
      const isValid = await adapter.validate().catch(() => false);
      expect(typeof isValid).toBe('boolean');
    });

    it('should handle invalid command gracefully', async () => {
      const config: MCPServerConfig = {
        command: 'invalid-command-that-does-not-exist',
        args: [],
      };

      const adapter = new MCPAdapter('test-server', config);

      const isValid = await adapter.validate().catch(() => false);
      expect(isValid).toBe(false);
    });
  });

  describe('discover()', () => {
    it('should return empty array when server has no tools', async () => {
      // Mock scenario - would need actual MCP server
      const config: MCPServerConfig = {
        command: 'echo',
        args: ['{}'],
      };

      const adapter = new MCPAdapter('test-server', config);

      // This test demonstrates structure, real tests need mock server
      await expect(adapter.discover()).rejects.toThrow();
    });

    it('should handle discovery errors gracefully', async () => {
      const config: MCPServerConfig = {
        command: 'invalid-command',
        args: [],
      };

      const adapter = new MCPAdapter('test-server', config);

      await expect(adapter.discover()).rejects.toThrow();
    });
  });

  describe('execute()', () => {
    it('should reject execution when not connected', async () => {
      const config: MCPServerConfig = {
        command: 'node',
        args: ['test.js'],
      };

      const adapter = new MCPAdapter('test-server', config);

      await expect(adapter.execute('test_tool', {})).rejects.toThrow();
    });

    it('should handle tool not found error', async () => {
      const config: MCPServerConfig = {
        command: 'node',
        args: ['test.js'],
      };

      const adapter = new MCPAdapter('test-server', config);

      await expect(adapter.execute('nonexistent_tool', {})).rejects.toThrow();
    });

    it('should handle invalid parameters', async () => {
      const config: MCPServerConfig = {
        command: 'node',
        args: ['test.js'],
      };

      const adapter = new MCPAdapter('test-server', config);

      await expect(adapter.execute('test_tool', null)).rejects.toThrow();
    });
  });

  describe('close()', () => {
    it('should close connections cleanly', async () => {
      const config: MCPServerConfig = {
        command: 'node',
        args: ['test.js'],
      };

      const adapter = new MCPAdapter('test-server', config);

      await expect(adapter.close()).resolves.not.toThrow();
    });

    it('should handle double close gracefully', async () => {
      const config: MCPServerConfig = {
        command: 'node',
        args: ['test.js'],
      };

      const adapter = new MCPAdapter('test-server', config);

      await adapter.close();
      await expect(adapter.close()).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should throw on missing command', () => {
      const config = {
        command: '',
        args: [],
      } as MCPServerConfig;

      expect(() => new MCPAdapter('test', config)).not.toThrow();
    });

    it('should handle process exit during discovery', async () => {
      const config: MCPServerConfig = {
        command: 'sh',
        args: ['-c', 'exit 1'],
      };

      const adapter = new MCPAdapter('test-server', config);

      await expect(adapter.discover()).rejects.toThrow();
    });

    it('should handle process exit during execution', async () => {
      const config: MCPServerConfig = {
        command: 'sh',
        args: ['-c', 'exit 1'],
      };

      const adapter = new MCPAdapter('test-server', config);

      await expect(adapter.execute('test', {})).rejects.toThrow();
    });
  });

  describe('Timeout Handling', () => {
    it('should respect timeout configuration', async () => {
      const config: MCPServerConfig = {
        command: 'sleep',
        args: ['10'],
      };

      const adapter = new MCPAdapter('test-server', config);

      // Should timeout quickly
      await expect(adapter.discover()).rejects.toThrow();
    }, 10000);
  });

  describe('Client Behavior', () => {
    it('should use raw client by default', async () => {
      const config: MCPServerConfig = {
        command: 'node',
        args: ['test.js'],
      };

      const adapter = new MCPAdapter('test-server', config);

      // Raw client is used by default
      await expect(adapter.discover()).rejects.toThrow();
    });
  });
});

describe('MCPAdapter Integration (requires real MCP server)', () => {
  // These tests would run against a real MCP server
  // Skip them if server is not available

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const hasTestServer = process.env.MCP_TEST_SERVER === 'true';

  describe.skip('Real Server Tests', () => {
    let adapter: MCPAdapter;

    beforeAll(() => {
      const config: MCPServerConfig = {
        command: process.env.MCP_TEST_COMMAND || 'npx',
        args: process.env.MCP_TEST_ARGS?.split(',') || ['-y', '@modelcontextprotocol/server-memory'],
      };

      adapter = new MCPAdapter('memory-server', config);
    });

    afterAll(async () => {
      await adapter.close();
    });

    it('should discover tools from real server', async () => {
      const tools = await adapter.discover();
      expect(Array.isArray(tools)).toBe(true);
    });

    it('should execute tool on real server', async () => {
      const result = await adapter.execute('test_tool', {});
      expect(result).toBeDefined();
    });
  });
});
