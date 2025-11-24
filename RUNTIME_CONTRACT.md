# Runtime Contract

**Version:** 1.0.0
**Package:** `@mcp-codegen/runtime`
**Stability:** This contract follows semantic versioning and is considered stable.

---

## Purpose

This document defines the stable contract between code generators and the MCP-CODEGEN runtime. If you're building:
- A custom wrapper generator
- An alternative codegen tool
- A tool that targets `@mcp-codegen/runtime`

You can rely on this contract remaining stable across minor versions.

---

## Core API

### `call(toolId: string, params?: any, options?: CallOptions): Promise<any>`

**Contract:**
- `toolId`: Format `{source}__{tool}` (e.g., `"github__get_user"`)
- `params`: Tool-specific parameters (optional)
- `options`: Runtime options (optional, see CallOptions below)
- Returns: Raw tool result (any type)
- Throws: `RuntimeError` on failure (see Error Contract)

**Behavior:**
1. Resolves adapter for `source` from `toolId`
2. Calls adapter's `executeTool(tool, params)` method
3. Returns adapter's raw result
4. Wraps all errors in `RuntimeError` with context

**Example:**
```typescript
const result = await call("github__get_user", {
  path: { username: "anthropics" }
});
```

---

### `callTyped<TParams, TResult>(toolId: string, params: TParams, options?: CallOptions): Promise<TResult>`

**Contract:**
- Same behavior as `call()` but with TypeScript type safety
- `TParams`: Input parameter type
- `TResult`: Expected result type
- No runtime type validation (types are compile-time only)

**Behavior:**
1. Identical to `call()` at runtime
2. Provides TypeScript type checking at compile time
3. Generated wrappers use this for IDE autocomplete

**Example:**
```typescript
interface Params {
  path: { username: string };
}
interface Result {
  login: string;
  name: string;
}

const user = await callTyped<Params, Result>("github__get_user", {
  path: { username: "anthropics" }
});
// user.name is typed as string
```

---

### `registerAdapter(sourceName: string, adapter: SourceAdapter): void`

**Contract:**
- `sourceName`: Unique identifier for this source (e.g., `"github"`)
- `adapter`: Object implementing `SourceAdapter` interface
- Idempotent: Registering same source twice is safe (last wins)
- Must be called before `call()` for that source

**Behavior:**
1. Stores adapter in global registry
2. Overwrites existing adapter if `sourceName` already registered
3. No validation of adapter interface (assumes correct implementation)

**Example:**
```typescript
import { registerAdapter } from "@mcp-codegen/runtime";
import { GitHubAdapter } from "./adapters/github";

registerAdapter("github", new GitHubAdapter());
```

---

### `getAdapter(sourceName: string): SourceAdapter | undefined`

**Contract:**
- `sourceName`: Source identifier to lookup
- Returns: Adapter if registered, `undefined` if not found
- Read-only: Does not modify registry

**Example:**
```typescript
const adapter = getAdapter("github");
if (!adapter) {
  throw new Error("GitHub adapter not registered");
}
```

---

## CallOptions

```typescript
interface CallOptions {
  timeout?: number;        // Request timeout in ms (default: 30000)
  retries?: number;        // Retry attempts (default: 3)
  signal?: AbortSignal;    // Abort signal for cancellation
}
```

**Behavior:**
- `timeout`: Applies to individual tool calls, not total time across retries
- `retries`: Uses exponential backoff (2s, 4s, 8s, etc.)
- `signal`: Cancels in-flight requests when aborted

---

## SourceAdapter Interface

**Contract:** Any adapter targeting the runtime must implement this interface.

```typescript
interface SourceAdapter {
  /**
   * Execute a tool with given parameters
   *
   * @param toolName - Tool identifier (without source prefix)
   * @param params - Tool-specific parameters
   * @returns Tool execution result
   * @throws Error on failure (runtime wraps in RuntimeError)
   */
  executeTool(toolName: string, params?: any): Promise<any>;

  /**
   * Optional: Get source type identifier
   */
  getType?(): string;

  /**
   * Optional: Cleanup resources
   */
  dispose?(): Promise<void>;
}
```

**Required Methods:**
- `executeTool(toolName, params)`: Execute tool, return result or throw

**Optional Methods:**
- `getType()`: Return source type (e.g., `"mcp"`, `"openapi"`)
- `dispose()`: Cleanup connections, close servers

**Behavioral Requirements:**
1. `executeTool` must be async (return Promise)
2. Throw errors for failures (don't return error objects)
3. Return raw API results (no wrapping required)
4. Handle own connection pooling/lifecycle

---

## Error Contract

### RuntimeError

All runtime errors are wrapped in `RuntimeError`:

```typescript
class RuntimeError extends Error {
  code: string;           // Error code (see codes below)
  toolId?: string;        // Tool that failed (if applicable)
  statusCode?: number;    // HTTP status code (REST APIs)
  cause?: Error;          // Original error
}
```

### Error Codes

**Guaranteed error codes:**

| Code | Meaning | When Thrown |
|------|---------|-------------|
| `ADAPTER_NOT_FOUND` | Source adapter not registered | `call()` with unknown source |
| `TOOL_EXECUTION_FAILED` | Tool execution threw error | Adapter's `executeTool()` threw |
| `TIMEOUT` | Operation exceeded timeout | Request took longer than `options.timeout` |
| `NETWORK_ERROR` | Network/connection failure | HTTP requests, MCP server connection |
| `VALIDATION_ERROR` | Invalid parameters | Bad params passed to tool |
| `AUTH_ERROR` | Authentication failed | 401/403 responses, auth token invalid |

### HTTP Status Code Mapping

For REST APIs, `statusCode` maps to HTTP status:

| HTTP Status | Error Code | `statusCode` |
|-------------|------------|--------------|
| 400-499 | `VALIDATION_ERROR` | Original status |
| 401, 403 | `AUTH_ERROR` | Original status |
| 500-599 | `TOOL_EXECUTION_FAILED` | Original status |
| Timeout | `TIMEOUT` | undefined |
| Network | `NETWORK_ERROR` | undefined |

### MCP Error Mapping

For MCP servers, errors map as:

| MCP Error | Error Code | Notes |
|-----------|------------|-------|
| Tool not found | `TOOL_EXECUTION_FAILED` | MCP server doesn't have tool |
| Invalid params | `VALIDATION_ERROR` | Schema validation failed |
| Server crash | `TOOL_EXECUTION_FAILED` | MCP server process died |
| Connection lost | `NETWORK_ERROR` | Can't reach MCP server |

### Error Example

```typescript
try {
  await call("github__get_user", { path: { username: "..." } });
} catch (error) {
  if (error.code === "AUTH_ERROR") {
    console.error("GitHub token invalid or missing");
  } else if (error.statusCode === 404) {
    console.error("User not found");
  } else {
    console.error("Unexpected error:", error.message);
  }
}
```

---

## Logging Contract

The runtime provides optional logging via `setLogger()` and `setLogLevel()`:

### Log Levels

```typescript
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}
```

### Logger Interface

```typescript
interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}
```

### Default Behavior

- **Default logger**: `console` object
- **Default level**: `LogLevel.WARN`
- **Log messages include**: timestamp, level, tool ID, duration

### Guaranteed Log Events

| Event | Level | When |
|-------|-------|------|
| Tool call start | DEBUG | Before `executeTool()` |
| Tool call success | DEBUG | After successful execution |
| Tool call failure | ERROR | After failed execution |
| Retry attempt | WARN | Before retry |
| Timeout | ERROR | When timeout exceeded |
| Adapter registration | DEBUG | When `registerAdapter()` called |

---

## Versioning Policy

This contract follows semantic versioning:

- **MAJOR**: Breaking changes to API signatures, error codes, or behavior
- **MINOR**: New features, new error codes (non-breaking additions)
- **PATCH**: Bug fixes, performance improvements

### Guarantees

**Will NOT break across minor versions:**
- `call()` and `callTyped()` signatures
- `SourceAdapter` interface required methods
- Error codes in "Guaranteed error codes" table
- HTTP/MCP error mapping behavior

**MAY change across minor versions:**
- New optional methods on `SourceAdapter`
- New error codes (additions)
- New log events
- Internal retry/timeout logic (as long as external behavior matches)

**MAY change across patch versions:**
- Error messages (text)
- Log message format
- Performance characteristics
- Internal implementation

---

## Conformance Testing

To ensure your generator produces runtime-compatible code:

1. **Import test**: Generated code imports from `@mcp-codegen/runtime`
2. **Call test**: Can call tools via `call()` or `callTyped()`
3. **Error test**: Catches `RuntimeError` with correct `code`
4. **Type test**: TypeScript types are valid (if using TypeScript)

See `packages/runtime/tests/conformance.test.ts` for reference tests.

---

## Extension Points

While this contract is stable, you can extend the runtime:

### Custom Adapters

Implement `SourceAdapter` for new source types:

```typescript
class MyCustomAdapter implements SourceAdapter {
  async executeTool(toolName: string, params?: any): Promise<any> {
    // Your implementation
  }
}

registerAdapter("my-source", new MyCustomAdapter());
```

### Custom Error Handling

Wrap `call()` with your own error handling:

```typescript
async function safeCall(toolId: string, params?: any) {
  try {
    return await call(toolId, params);
  } catch (error) {
    // Your custom logging, retry, etc.
    throw error;
  }
}
```

### Custom Logging

Provide your own logger:

```typescript
import { setLogger, setLogLevel, LogLevel } from "@mcp-codegen/runtime";

setLogger({
  debug: (msg) => myLogger.debug(msg),
  info: (msg) => myLogger.info(msg),
  warn: (msg) => myLogger.warn(msg),
  error: (msg) => myLogger.error(msg),
});
setLogLevel(LogLevel.DEBUG);
```

---

## Questions?

If you're building a tool that targets this runtime:
- Open a GitHub issue if the contract is unclear
- PRs to clarify this document are welcome
- Breaking changes require MAJOR version bump

This contract is a living document but changes require community discussion.
