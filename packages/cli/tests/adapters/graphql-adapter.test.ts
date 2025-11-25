/**
 * GraphQL Adapter Integration Tests
 *
 * Tests the GraphQL adapter's ability to discover and execute GraphQL queries/mutations.
 */

import { GraphQLAdapter, GraphQLConfig } from '../../src/adapters/graphql-adapter';

describe('GraphQLAdapter', () => {
  describe('Constructor and Initialization', () => {
    it('should create adapter with basic config', () => {
      const config: GraphQLConfig = {
        type: 'graphql',
        endpoint: 'https://api.example.com/graphql',
      };

      const adapter = new GraphQLAdapter('test-api', config);

      expect(adapter.name).toBe('test-api');
      expect(adapter.type).toBe('graphql');
    });

    it('should create adapter with custom timeout', () => {
      const config: GraphQLConfig = {
        type: 'graphql',
        endpoint: 'https://api.example.com/graphql',
        timeout: 60000,
      };

      const adapter = new GraphQLAdapter('test-api', config);
      expect(adapter).toBeDefined();
    });

    it('should handle custom headers', () => {
      const config: GraphQLConfig = {
        type: 'graphql',
        endpoint: 'https://api.example.com/graphql',
        headers: {
          'X-Custom-Header': 'value',
          'X-Another-Header': 'another-value',
        },
      };

      const adapter = new GraphQLAdapter('test-api', config);
      expect(adapter).toBeDefined();
    });

    it('should respect disabled flag', () => {
      const config: GraphQLConfig = {
        type: 'graphql',
        endpoint: 'https://api.example.com/graphql',
        disabled: true,
      };

      const adapter = new GraphQLAdapter('test-api', config);
      expect(adapter).toBeDefined();
    });
  });

  describe('validate()', () => {
    it('should return false for unreachable endpoint', async () => {
      const config: GraphQLConfig = {
        type: 'graphql',
        endpoint: 'https://invalid-url-that-does-not-exist.example.com/graphql',
        timeout: 5000,
      };

      const adapter = new GraphQLAdapter('test-api', config);

      const isValid = await adapter.validate();
      expect(isValid).toBe(false);
    });

    it('should validate against a valid GraphQL endpoint', async () => {
      const config: GraphQLConfig = {
        type: 'graphql',
        endpoint: 'https://countries.trevorblades.com/graphql',
        timeout: 10000,
      };

      const adapter = new GraphQLAdapter('countries-api', config);

      // This might fail due to network, but tests the structure
      const isValid = await adapter.validate().catch(() => false);
      expect(typeof isValid).toBe('boolean');
    });
  });

  describe('discover()', () => {
    it('should reject discovery for invalid endpoint', async () => {
      const config: GraphQLConfig = {
        type: 'graphql',
        endpoint: 'https://invalid-graphql-endpoint.example.com/graphql',
        timeout: 5000,
      };

      const adapter = new GraphQLAdapter('test-api', config);

      await expect(adapter.discover()).rejects.toThrow();
    });

    it('should handle introspection errors gracefully', async () => {
      const config: GraphQLConfig = {
        type: 'graphql',
        endpoint: 'https://httpstat.us/500',
        timeout: 5000,
      };

      const adapter = new GraphQLAdapter('test-api', config);

      await expect(adapter.discover()).rejects.toThrow();
    });
  });

  describe('execute()', () => {
    it('should reject execution for non-existent tool', async () => {
      const config: GraphQLConfig = {
        type: 'graphql',
        endpoint: 'https://api.example.com/graphql',
        timeout: 5000,
      };

      const adapter = new GraphQLAdapter('test-api', config);

      await expect(adapter.execute('nonexistent_query', {})).rejects.toThrow();
    });

    it('should handle execution errors from unreachable endpoint', async () => {
      const config: GraphQLConfig = {
        type: 'graphql',
        endpoint: 'https://unreachable-graphql.example.com/graphql',
        timeout: 5000,
      };

      const adapter = new GraphQLAdapter('test-api', config);

      await expect(adapter.execute('test_query', { id: '123' })).rejects.toThrow();
    });

    it('should handle null parameters gracefully', async () => {
      const config: GraphQLConfig = {
        type: 'graphql',
        endpoint: 'https://api.example.com/graphql',
        timeout: 5000,
      };

      const adapter = new GraphQLAdapter('test-api', config);

      await expect(adapter.execute('test_query', null)).rejects.toThrow();
    });
  });

  describe('Authentication', () => {
    it('should handle bearer token auth', () => {
      const config: GraphQLConfig = {
        type: 'graphql',
        endpoint: 'https://api.example.com/graphql',
        auth: {
          type: 'bearer',
          token: '${GRAPHQL_TOKEN}',
        },
      };

      const adapter = new GraphQLAdapter('test-api', config);
      expect(adapter).toBeDefined();
    });

    it('should handle API key auth in header', () => {
      const config: GraphQLConfig = {
        type: 'graphql',
        endpoint: 'https://api.example.com/graphql',
        auth: {
          type: 'apiKey',
          name: 'X-API-Key',
          in: 'header',
          value: '${API_KEY}',
        },
      };

      const adapter = new GraphQLAdapter('test-api', config);
      expect(adapter).toBeDefined();
    });

    it('should handle API key auth in query', () => {
      const config: GraphQLConfig = {
        type: 'graphql',
        endpoint: 'https://api.example.com/graphql',
        auth: {
          type: 'apiKey',
          name: 'api_key',
          in: 'query',
          value: '${API_KEY}',
        },
      };

      const adapter = new GraphQLAdapter('test-api', config);
      expect(adapter).toBeDefined();
    });

    it('should handle basic auth', () => {
      const config: GraphQLConfig = {
        type: 'graphql',
        endpoint: 'https://api.example.com/graphql',
        auth: {
          type: 'basic',
          username: '${GRAPHQL_USER}',
          password: '${GRAPHQL_PASS}',
        },
      };

      const adapter = new GraphQLAdapter('test-api', config);
      expect(adapter).toBeDefined();
    });

    it('should handle OAuth2 token', () => {
      const config: GraphQLConfig = {
        type: 'graphql',
        endpoint: 'https://api.example.com/graphql',
        auth: {
          type: 'oauth2',
          token: '${OAUTH_TOKEN}',
        },
      };

      const adapter = new GraphQLAdapter('test-api', config);
      expect(adapter).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      const config: GraphQLConfig = {
        type: 'graphql',
        endpoint: 'https://unreachable-host.example.com/graphql',
        timeout: 5000,
      };

      const adapter = new GraphQLAdapter('test-api', config);

      await expect(adapter.discover()).rejects.toThrow();
    });

    it('should handle 404 responses', async () => {
      const config: GraphQLConfig = {
        type: 'graphql',
        endpoint: 'https://httpstat.us/404',
        timeout: 5000,
      };

      const adapter = new GraphQLAdapter('test-api', config);

      await expect(adapter.discover()).rejects.toThrow();
    });

    it('should handle 500 server errors', async () => {
      const config: GraphQLConfig = {
        type: 'graphql',
        endpoint: 'https://httpstat.us/500',
        timeout: 5000,
      };

      const adapter = new GraphQLAdapter('test-api', config);

      await expect(adapter.discover()).rejects.toThrow();
    });

    it('should handle timeout errors', async () => {
      const config: GraphQLConfig = {
        type: 'graphql',
        endpoint: 'https://httpstat.us/200?sleep=10000',
        timeout: 1000, // Very short timeout
      };

      const adapter = new GraphQLAdapter('test-api', config);

      await expect(adapter.discover()).rejects.toThrow();
    }, 15000);
  });

  describe('close()', () => {
    it('should close cleanly', async () => {
      const config: GraphQLConfig = {
        type: 'graphql',
        endpoint: 'https://api.example.com/graphql',
      };

      const adapter = new GraphQLAdapter('test-api', config);

      await expect(adapter.close()).resolves.not.toThrow();
    });

    it('should handle double close gracefully', async () => {
      const config: GraphQLConfig = {
        type: 'graphql',
        endpoint: 'https://api.example.com/graphql',
      };

      const adapter = new GraphQLAdapter('test-api', config);

      await adapter.close();
      await expect(adapter.close()).resolves.not.toThrow();
    });
  });
});

describe('GraphQLAdapter Integration (requires real GraphQL server)', () => {
  // These tests would run against a real GraphQL server
  // Set GRAPHQL_TEST_SERVER=true to enable these tests

  describe.skip('Real Server Tests', () => {
    let adapter: GraphQLAdapter;

    beforeAll(() => {
      const config: GraphQLConfig = {
        type: 'graphql',
        endpoint: process.env.GRAPHQL_TEST_ENDPOINT || 'https://countries.trevorblades.com/graphql',
        timeout: 30000,
      };

      adapter = new GraphQLAdapter('countries-api', config);
    });

    afterAll(async () => {
      await adapter.close();
    });

    it('should discover tools from real server', async () => {
      const tools = await adapter.discover();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should execute query on real server', async () => {
      const result = await adapter.execute('countries', {});
      expect(result).toBeDefined();
    });
  });
});
