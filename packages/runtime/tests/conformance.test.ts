/**
 * Runtime Contract Conformance Tests
 * 
 * These tests validate that the runtime follows the contract defined in RUNTIME_CONTRACT.md
 * Use these as a reference if you're building generators that target @mcp-codegen/runtime
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { call, callTyped, registerAdapter, getAdapter } from '../src/universal-runtime';
import type { SourceAdapter } from '../src/adapter';
import { RuntimeError } from '../src/errors';

// Mock adapter for testing
class MockAdapter implements SourceAdapter {
  private shouldFail = false;
  private failureMode: 'throw' | 'timeout' | 'network' | 'auth' | 'validation' = 'throw';
  private returnValue: any = { success: true };

  async executeTool(toolName: string, params?: any): Promise<any> {
    if (this.shouldFail) {
      switch (this.failureMode) {
        case 'throw':
          throw new Error('Tool execution failed');
        case 'auth':
          const authError: any = new Error('Authentication failed');
          authError.statusCode = 401;
          throw authError;
        case 'validation':
          const validationError: any = new Error('Invalid parameters');
          validationError.statusCode = 400;
          throw validationError;
        case 'network':
          throw new Error('ECONNREFUSED');
        case 'timeout':
          await new Promise(resolve => setTimeout(resolve, 100000));
          break;
      }
    }
    return this.returnValue;
  }

  setReturnValue(value: any) {
    this.returnValue = value;
  }

  setShouldFail(mode: 'throw' | 'timeout' | 'network' | 'auth' | 'validation') {
    this.shouldFail = true;
    this.failureMode = mode;
  }

  reset() {
    this.shouldFail = false;
    this.returnValue = { success: true };
  }

  getType(): string {
    return 'mock';
  }

  async dispose(): Promise<void> {
    // Cleanup
  }
}

describe('Runtime Contract Conformance', () => {
  let mockAdapter: MockAdapter;

  beforeEach(() => {
    mockAdapter = new MockAdapter();
    registerAdapter('test', mockAdapter);
  });

  afterEach(() => {
    mockAdapter.reset();
  });

  describe('Core API: call()', () => {
    it('accepts toolId in format {source}__{tool}', async () => {
      const result = await call('test__some_tool');
      expect(result).toEqual({ success: true });
    });

    it('accepts optional params', async () => {
      mockAdapter.setReturnValue({ data: 'result' });
      const result = await call('test__tool', { param: 'value' });
      expect(result).toEqual({ data: 'result' });
    });

    it('returns raw tool result', async () => {
      mockAdapter.setReturnValue({ raw: 'data', nested: { value: 123 } });
      const result = await call('test__tool');
      expect(result).toEqual({ raw: 'data', nested: { value: 123 } });
    });

    it('throws RuntimeError on failure', async () => {
      mockAdapter.setShouldFail('throw');
      await expect(call('test__tool')).rejects.toThrow(RuntimeError);
    });

    it('throws ADAPTER_NOT_FOUND for unknown source', async () => {
      try {
        await call('unknown__tool');
        fail('Should have thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(RuntimeError);
        expect(error.code).toBe('ADAPTER_NOT_FOUND');
      }
    });
  });

  describe('Core API: callTyped()', () => {
    it('provides type safety at compile time', async () => {
      interface Params { value: string }
      interface Result { data: string }
      
      mockAdapter.setReturnValue({ data: 'result' });
      const result = await callTyped<Params, Result>('test__tool', { value: 'test' });
      
      // TypeScript should allow this
      expect(result.data).toBe('result');
    });

    it('has identical runtime behavior to call()', async () => {
      mockAdapter.setReturnValue({ value: 42 });
      
      const result1 = await call('test__tool', { param: 'value' });
      const result2 = await callTyped('test__tool', { param: 'value' });
      
      expect(result1).toEqual(result2);
    });

    it('throws same errors as call()', async () => {
      mockAdapter.setShouldFail('throw');
      
      await expect(call('test__tool')).rejects.toThrow(RuntimeError);
      await expect(callTyped('test__tool', {})).rejects.toThrow(RuntimeError);
    });
  });

  describe('Core API: registerAdapter()', () => {
    it('registers adapter for source name', () => {
      const newAdapter = new MockAdapter();
      registerAdapter('new-source', newAdapter);
      
      const retrieved = getAdapter('new-source');
      expect(retrieved).toBe(newAdapter);
    });

    it('is idempotent (last registration wins)', () => {
      const adapter1 = new MockAdapter();
      const adapter2 = new MockAdapter();
      
      registerAdapter('source', adapter1);
      registerAdapter('source', adapter2);
      
      const retrieved = getAdapter('source');
      expect(retrieved).toBe(adapter2);
    });
  });

  describe('Core API: getAdapter()', () => {
    it('returns registered adapter', () => {
      const adapter = getAdapter('test');
      expect(adapter).toBe(mockAdapter);
    });

    it('returns undefined for unregistered source', () => {
      const adapter = getAdapter('nonexistent');
      expect(adapter).toBeUndefined();
    });
  });

  describe('Error Contract: Error Codes', () => {
    it('throws ADAPTER_NOT_FOUND for missing adapter', async () => {
      try {
        await call('missing__tool');
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.code).toBe('ADAPTER_NOT_FOUND');
        expect(error.toolId).toBe('missing__tool');
      }
    });

    it('throws TOOL_EXECUTION_FAILED for adapter errors', async () => {
      mockAdapter.setShouldFail('throw');
      try {
        await call('test__tool');
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.code).toBe('TOOL_EXECUTION_FAILED');
        expect(error.toolId).toBe('test__tool');
      }
    });

    it('throws AUTH_ERROR for 401/403 status codes', async () => {
      mockAdapter.setShouldFail('auth');
      try {
        await call('test__tool');
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.code).toBe('AUTH_ERROR');
        expect(error.statusCode).toBe(401);
      }
    });

    it('throws VALIDATION_ERROR for 400 status codes', async () => {
      mockAdapter.setShouldFail('validation');
      try {
        await call('test__tool');
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.code).toBe('VALIDATION_ERROR');
        expect(error.statusCode).toBe(400);
      }
    });

    it('throws NETWORK_ERROR for connection failures', async () => {
      mockAdapter.setShouldFail('network');
      try {
        await call('test__tool');
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.code).toBe('NETWORK_ERROR');
      }
    });
  });

  describe('Error Contract: RuntimeError Structure', () => {
    it('includes required properties', async () => {
      mockAdapter.setShouldFail('throw');
      try {
        await call('test__tool');
        fail('Should have thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(RuntimeError);
        expect(typeof error.code).toBe('string');
        expect(typeof error.message).toBe('string');
        expect(error.toolId).toBe('test__tool');
      }
    });

    it('includes statusCode for HTTP errors', async () => {
      mockAdapter.setShouldFail('auth');
      try {
        await call('test__tool');
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.statusCode).toBe(401);
      }
    });

    it('includes cause for wrapped errors', async () => {
      mockAdapter.setShouldFail('throw');
      try {
        await call('test__tool');
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.cause).toBeInstanceOf(Error);
        expect(error.cause.message).toContain('Tool execution failed');
      }
    });
  });

  describe('SourceAdapter Interface', () => {
    it('requires executeTool method', () => {
      expect(typeof mockAdapter.executeTool).toBe('function');
    });

    it('executeTool returns Promise', async () => {
      const result = mockAdapter.executeTool('tool');
      expect(result).toBeInstanceOf(Promise);
      await result;
    });

    it('supports optional getType method', () => {
      expect(mockAdapter.getType?.()).toBe('mock');
    });

    it('supports optional dispose method', async () => {
      expect(typeof mockAdapter.dispose).toBe('function');
      await expect(mockAdapter.dispose?.()).resolves.toBeUndefined();
    });

    it('adapter can throw errors', async () => {
      mockAdapter.setShouldFail('throw');
      await expect(mockAdapter.executeTool('tool')).rejects.toThrow();
    });
  });

  describe('Behavioral Requirements', () => {
    it('resolves adapter from toolId source prefix', async () => {
      const result = await call('test__tool');
      expect(result).toBeDefined();
    });

    it('calls adapter executeTool with correct params', async () => {
      let capturedTool: string | undefined;
      let capturedParams: any;

      const spyAdapter: SourceAdapter = {
        async executeTool(toolName: string, params?: any) {
          capturedTool = toolName;
          capturedParams = params;
          return { success: true };
        }
      };

      registerAdapter('spy', spyAdapter);
      await call('spy__my_tool', { param: 'value' });

      expect(capturedTool).toBe('my_tool');
      expect(capturedParams).toEqual({ param: 'value' });
    });

    it('returns adapter result unchanged', async () => {
      const complexResult = {
        data: [1, 2, 3],
        nested: { value: 'test' },
        array: [{ id: 1 }, { id: 2 }]
      };
      mockAdapter.setReturnValue(complexResult);
      
      const result = await call('test__tool');
      expect(result).toEqual(complexResult);
    });
  });
});

describe('Generator Conformance', () => {
  it('generated code can import from runtime', () => {
    // This test validates the import works
    expect(typeof call).toBe('function');
    expect(typeof callTyped).toBe('function');
    expect(typeof registerAdapter).toBe('function');
    expect(typeof getAdapter).toBe('function');
  });

  it('generated wrappers can call runtime functions', async () => {
    // Simulates generated wrapper code
    const mockAdapter = new MockAdapter();
    mockAdapter.setReturnValue({ id: 123, name: 'test' });
    registerAdapter('api', mockAdapter);

    // This is what generated code looks like
    async function generatedWrapper(params: any): Promise<any> {
      return callTyped('api__get_user', params);
    }

    const result = await generatedWrapper({ userId: 123 });
    expect(result).toEqual({ id: 123, name: 'test' });
  });

  it('generated code can catch RuntimeError', async () => {
    const mockAdapter = new MockAdapter();
    mockAdapter.setShouldFail('auth');
    registerAdapter('api', mockAdapter);

    // Generated error handling
    try {
      await call('api__protected_resource');
      fail('Should have thrown');
    } catch (error: any) {
      if (error.code === 'AUTH_ERROR') {
        expect(error.statusCode).toBe(401);
      } else {
        throw error;
      }
    }
  });
});
