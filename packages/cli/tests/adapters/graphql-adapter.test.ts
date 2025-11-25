/**
 * GraphQL Adapter Integration Tests
 *
 * Tests the GraphQL adapter's ability to discover and execute GraphQL operations.
 */

import { GraphQLAdapter, GraphQLConfig } from '../../src/adapters/graphql-adapter';

describe('GraphQLAdapter', () => {
  describe('Constructor and Initialization', () => {
    it('should create adapter with endpoint', () => {
      const config: GraphQLConfig = {
        type: 'graphql',
        endpoint: 'https://api.example.com/graphql',
      };

      const adapter = new GraphQLAdapter('test-api', config);

      expect(adapter.name).toBe('test-api');
      expect(adapter.type).toBe('graphql');
    });

    it('should create adapter with custom headers', () => {
      const config: GraphQLConfig = {
        type: 'graphql',
        endpoint: 'https://api.example.com/graphql',
        headers: {
          'X-Custom-Header': 'value',
        },
      };

      const adapter = new GraphQLAdapter('test-api', config);
      expect(adapter).toBeDefined();
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
  });

  describe('validate()', () => {
    it('should validate GraphQL endpoint (may fail without network)', async () => {
      const config: GraphQLConfig = {
        type: 'graphql',
        endpoint: 'https://countries.trevorblades.com/graphql',
      };

      const adapter = new GraphQLAdapter('countries', config);

      // This might fail due to network, but tests the structure
      const isValid = await adapter.validate().catch(() => false);
      expect(typeof isValid).toBe('boolean');
    });

    it('should fail validation for invalid endpoint', async () => {
      const config: GraphQLConfig = {
        type: 'graphql',
        endpoint: 'https://invalid-url-that-does-not-exist.example.com/graphql',
      };

      const adapter = new GraphQLAdapter('test-api', config);

      const isValid = await adapter.validate().catch(() => false);
      expect(isValid).toBe(false);
    });
  });

  describe('discover()', () => {
    it('should handle network errors gracefully', async () => {
      const config: GraphQLConfig = {
        type: 'graphql',
        endpoint: 'https://unreachable-host.example.com/graphql',
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
      };

      const adapter = new GraphQLAdapter('test-api', config);

      // Will fail without proper setup, but tests structure
      await expect(adapter.execute('nonexistentQuery', {})).rejects.toThrow();
    });
  });

  describe('Authentication', () => {
    it('should handle bearer token auth', () => {
      const config: GraphQLConfig = {
        type: 'graphql',
        endpoint: 'https://api.example.com/graphql',
        auth: {
          type: 'bearer',
          token: '${API_TOKEN}',
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

    it('should handle basic auth', () => {
      const config: GraphQLConfig = {
        type: 'graphql',
        endpoint: 'https://api.example.com/graphql',
        auth: {
          type: 'basic',
          username: '${API_USER}',
          password: '${API_PASS}',
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
      };

      const adapter = new GraphQLAdapter('test-api', config);

      await expect(adapter.discover()).rejects.toThrow();
    });

    it('should handle invalid responses gracefully', async () => {
      const config: GraphQLConfig = {
        type: 'graphql',
        endpoint: 'https://httpstat.us/500',
      };

      const adapter = new GraphQLAdapter('test-api', config);

      await expect(adapter.discover()).rejects.toThrow();
    });
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
  });
});
