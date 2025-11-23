# Runtime Contract

This document defines the guaranteed behavior, interfaces, and expectations for the mcp-codegen universal runtime.

**Version:** 1.1.0
**Last Updated:** 2025-11-22

---

## Table of Contents

1. [Core API](#core-api)
2. [Error Shapes](#error-shapes)
3. [Transport Layers](#transport-layers)
4. [Authentication](#authentication)
5. [Retry & Rate Limiting](#retry--rate-limiting)
6. [Connection Management](#connection-management)
7. [Type Safety Guarantees](#type-safety-guarantees)
8. [LLM Usage Expectations](#llm-usage-expectations)
9. [Performance Characteristics](#performance-characteristics)
10. [Instrumentation & Logging](#instrumentation--logging)

---

## Core API

The runtime exposes three primary functions for tool execution:

### `call(toolName, params, options?)`

**Purpose:** Execute any tool by name with runtime type checking.

**Signature:**
```typescript
async function call(
  toolName: string,
  params: unknown,
  options?: CallOptions
): Promise<unknown>
```

**Parameters:**
- `toolName` (string): Tool identifier in format `{source}__{tool}` (e.g., `"github__list_repos"`)
- `params` (unknown): Input parameters (validated at runtime)
- `options` (CallOptions, optional): Execution options

**Returns:** Promise resolving to tool result (type: `unknown`)

**Throws:** `CodegenError` (see [Error Shapes](#error-shapes))

**Example:**
```typescript
const repos = await call("github__list_repos", {
  path: { username: "anthropics" },
  query: { sort: "stars", per_page: 10 }
});
```

**Guarantees:**
- Tool discovery happens automatically on first call
- Connection pooling is managed internally
- Retries are handled transparently (see [Retry Policy](#retry-policy))
- Authentication is resolved automatically (see [Authentication](#authentication))

---

### `callTyped<TParams, TResult>(toolName, params, options?)`

**Purpose:** Execute any tool with compile-time type safety.

**Signature:**
```typescript
async function callTyped<TParams = unknown, TResult = unknown>(
  toolName: string,
  params: TParams,
  options?: CallOptions
): Promise<TResult>
```

**Parameters:**
- `TParams`: TypeScript type for input parameters
- `TResult`: TypeScript type for expected result
- `toolName` (string): Tool identifier in format `{source}__{tool}`
- `params` (TParams): Typed input parameters
- `options` (CallOptions, optional): Execution options

**Returns:** Promise resolving to `TResult`

**Throws:** `CodegenError` (see [Error Shapes](#error-shapes))

**Example:**
```typescript
interface ListReposParams {
  path: { username: string };
  query?: { sort?: string; per_page?: number };
}

interface Repository {
  name: string;
  stargazers_count: number;
  description: string;
}

const repos = await callTyped<ListReposParams, Repository[]>(
  "github__list_repos",
  {
    path: { username: "anthropics" },
    query: { sort: "stars", per_page: 10 }
  }
);

// TypeScript knows repos is Repository[]
console.log(repos[0].stargazers_count);
```

**Guarantees:**
- All guarantees from `call()` apply
- TypeScript compiler enforces parameter types
- Return type is known at compile time
- No runtime type validation beyond what `call()` provides

---

### `callRaw(toolName, params, options?)`

**Purpose:** Low-level execution without middleware (no retries, no auth resolution).

**Signature:**
```typescript
async function callRaw(
  toolName: string,
  params: unknown,
  options?: RawCallOptions
): Promise<RawCallResult>
```

**Parameters:**
- `toolName` (string): Tool identifier
- `params` (unknown): Raw input parameters
- `options` (RawCallOptions, optional): Low-level options

**Returns:** Promise resolving to `RawCallResult`

**Result Type:**
```typescript
interface RawCallResult {
  success: boolean;
  data?: unknown;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  metadata: {
    duration: number;
    transport: string;
    source: string;
  };
}
```

**Use Cases:**
- Performance-critical paths where retries aren't wanted
- Custom error handling
- Debugging and instrumentation
- Building higher-level abstractions

**Example:**
```typescript
const result = await callRaw("github__list_repos", {
  path: { username: "anthropics" }
});

if (!result.success) {
  console.error("Raw error:", result.error);
  throw new Error("Custom handling");
}

console.log("Duration:", result.metadata.duration, "ms");
return result.data;
```

---

## Error Shapes

All runtime errors conform to a standard shape for consistent handling.

### `CodegenError`

**Base Class:**
```typescript
class CodegenError extends Error {
  readonly code: string;
  readonly category: ErrorCategory;
  readonly retryable: boolean;
  readonly originalError?: Error;
  readonly context?: Record<string, unknown>;

  constructor(options: {
    code: string;
    message: string;
    category: ErrorCategory;
    retryable?: boolean;
    originalError?: Error;
    context?: Record<string, unknown>;
  });
}
```

### Error Categories

```typescript
enum ErrorCategory {
  // Configuration errors (not retryable)
  CONFIG = "CONFIG",              // Invalid configuration
  VALIDATION = "VALIDATION",      // Parameter validation failed

  // Discovery errors (retryable with backoff)
  DISCOVERY = "DISCOVERY",        // Tool discovery failed
  CONNECTION = "CONNECTION",      // Connection to source failed

  // Execution errors (retryable based on code)
  EXECUTION = "EXECUTION",        // Tool execution failed
  TIMEOUT = "TIMEOUT",            // Request timed out

  // Transport errors (retryable)
  TRANSPORT = "TRANSPORT",        // Network/transport failure

  // Authentication errors (not retryable)
  AUTH = "AUTH",                  // Authentication failed

  // Rate limiting (retryable with delay)
  RATE_LIMIT = "RATE_LIMIT",      // Rate limit exceeded

  // Internal errors (not retryable)
  INTERNAL = "INTERNAL"           // Unexpected internal error
}
```

### Standard Error Codes

| Code | Category | Retryable | Description |
|------|----------|-----------|-------------|
| `TOOL_NOT_FOUND` | CONFIG | No | Tool name doesn't exist |
| `INVALID_PARAMS` | VALIDATION | No | Parameters don't match schema |
| `SOURCE_UNREACHABLE` | CONNECTION | Yes | Cannot connect to source |
| `EXECUTION_FAILED` | EXECUTION | Depends | Tool execution failed |
| `TIMEOUT` | TIMEOUT | Yes | Request exceeded timeout |
| `NETWORK_ERROR` | TRANSPORT | Yes | Network failure |
| `AUTH_FAILED` | AUTH | No | Authentication failed |
| `RATE_LIMITED` | RATE_LIMIT | Yes | Rate limit exceeded |
| `INTERNAL_ERROR` | INTERNAL | No | Unexpected error |
| `MCP_PROCESS_DIED` | CONNECTION | Yes | MCP subprocess crashed |
| `HTTP_ERROR_4XX` | EXECUTION | No | Client error (4xx) |
| `HTTP_ERROR_5XX` | EXECUTION | Yes | Server error (5xx) |

### Error Handling Example

```typescript
import { call, CodegenError, ErrorCategory } from "./codegen/runtime";

try {
  const result = await call("github__list_repos", params);
  return result;
} catch (error) {
  if (error instanceof CodegenError) {
    switch (error.category) {
      case ErrorCategory.VALIDATION:
        // Fix parameters and retry
        console.error("Invalid params:", error.context);
        break;

      case ErrorCategory.RATE_LIMIT:
        // Wait and retry
        await sleep(error.context?.retryAfter || 60000);
        return retry();

      case ErrorCategory.AUTH:
        // Refresh token and retry
        await refreshAuth();
        return retry();

      case ErrorCategory.TIMEOUT:
      case ErrorCategory.TRANSPORT:
        // Already retried, fail gracefully
        console.error("Network issue after retries:", error.message);
        break;

      default:
        // Unexpected error
        console.error("Unhandled error:", error);
    }
  }
  throw error;
}
```

---

## Transport Layers

The runtime supports multiple transport mechanisms through a unified interface.

### Transport Interface

```typescript
interface Transport {
  readonly name: string;
  readonly type: TransportType;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  execute(tool: string, params: unknown): Promise<unknown>;
  discover(): Promise<ToolDefinition[]>;

  // Health & status
  isConnected(): boolean;
  healthCheck(): Promise<boolean>;
}
```

### Supported Transports

#### 1. MCP Transport (Stdio)

**Type:** `TransportType.MCP_STDIO`

**Connection:**
- Spawns subprocess via Node.js `child_process`
- Communicates via newline-delimited JSON-RPC
- Manages process lifecycle (start, stop, restart)

**Protocol:**
- JSON-RPC 2.0
- Supports: `initialize`, `tools/list`, `tools/call`
- Auto-reconnect on process death

**Configuration:**
```typescript
{
  type: "mcp",
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
  env?: Record<string, string>
}
```

**Guarantees:**
- Process lifecycle managed automatically
- Auto-restart on crash (max 3 attempts)
- Clean shutdown on exit
- Timeout: 30s for discovery, 60s for execution

#### 2. HTTP Transport (REST)

**Type:** `TransportType.HTTP`

**Connection:**
- Uses axios HTTP client
- Supports connection pooling
- Persistent connections (keep-alive)

**Protocol:**
- HTTP/1.1 or HTTP/2
- Methods: GET, POST, PUT, PATCH, DELETE
- Content-Type: application/json (default)

**Configuration:**
```typescript
{
  type: "openapi",
  spec: "https://api.example.com/openapi.json",
  baseUrl: "https://api.example.com",
  auth?: AuthConfig
}
```

**Guarantees:**
- Connection pooling (max 50 connections)
- Request timeout: 30s (configurable)
- Response size limit: 100MB (configurable)
- Automatic content negotiation

#### 3. Future Transports

**gRPC Transport:** (Planned)
- Protocol Buffers
- Bidirectional streaming
- HTTP/2 multiplexing

**GraphQL Transport:** (Planned)
- Single endpoint
- Query batching
- Schema introspection

**WebSocket Transport:** (Planned)
- Real-time updates
- Bidirectional communication
- Reconnection logic

---

## Authentication

Authentication is resolved automatically based on configuration and runtime context.

### Auth Resolution Flow

```
1. Check CallOptions.auth (explicit override)
   ↓
2. Check environment variables (${VAR_NAME} substitution)
   ↓
3. Check config file auth section
   ↓
4. Check runtime auth resolver (custom logic)
   ↓
5. Execute without auth (if optional)
```

### Supported Auth Types

#### 1. Bearer Token

```typescript
{
  type: "bearer",
  token: "${GITHUB_TOKEN}"  // Resolved from env
}
```

**Runtime behavior:**
- Reads `process.env.GITHUB_TOKEN`
- Adds `Authorization: Bearer <token>` header
- Refreshes if token expires (if refresh logic provided)

#### 2. API Key

```typescript
{
  type: "apiKey",
  name: "X-API-Key",
  in: "header",
  value: "${API_KEY}"
}
```

**Runtime behavior:**
- Supports header, query, or cookie placement
- Resolved from environment variables
- No expiration handling

#### 3. Basic Auth

```typescript
{
  type: "basic",
  username: "${API_USER}",
  password: "${API_PASS}"
}
```

**Runtime behavior:**
- Base64 encodes `username:password`
- Adds `Authorization: Basic <encoded>` header

#### 4. OAuth2

```typescript
{
  type: "oauth2",
  flow: "clientCredentials",
  tokenUrl: "https://oauth.example.com/token",
  clientId: "${CLIENT_ID}",
  clientSecret: "${CLIENT_SECRET}",
  scopes: ["read", "write"]
}
```

**Runtime behavior:**
- Fetches token on first use
- Caches token until expiration
- Auto-refreshes using refresh token
- Handles token revocation

#### 5. Custom Auth

```typescript
{
  type: "custom",
  resolver: "myAuthResolver"
}
```

**Runtime behavior:**
- Calls registered auth resolver function
- Resolver returns headers/credentials
- Called on every request (or cached if resolver implements caching)

### Auth Resolver Interface

```typescript
interface AuthResolver {
  name: string;
  resolve(context: AuthContext): Promise<AuthResult>;
  refresh?(context: AuthContext): Promise<AuthResult>;
}

interface AuthContext {
  source: string;
  tool: string;
  config: AuthConfig;
  previousAttempt?: AuthResult;
}

interface AuthResult {
  headers?: Record<string, string>;
  query?: Record<string, string>;
  cookies?: Record<string, string>;
  expires?: Date;
}
```

### Register Custom Resolver

```typescript
import { registerAuthResolver } from "./codegen/runtime";

registerAuthResolver({
  name: "myAuthResolver",

  async resolve(context) {
    // Custom logic: fetch token from vault, etc.
    const token = await fetchTokenFromVault(context.source);

    return {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Custom-Header": "value"
      },
      expires: new Date(Date.now() + 3600000) // 1 hour
    };
  },

  async refresh(context) {
    // Refresh logic
    const newToken = await refreshToken(context.previousAttempt);
    return { headers: { Authorization: `Bearer ${newToken}` } };
  }
});
```

### Environment Variable Substitution

**Syntax:** `${VAR_NAME}` or `$VAR_NAME`

**Resolution:**
- Resolved at runtime (not generation time)
- Falls back to empty string if not found
- Supports `${VAR_NAME:-default}` for defaults

**Example:**
```typescript
{
  auth: {
    type: "bearer",
    token: "${GITHUB_TOKEN:-anonymous}"
  }
}
```

---

## Retry & Rate Limiting

The runtime implements automatic retry logic with exponential backoff.

### Retry Policy

**Default Behavior:**
```typescript
{
  maxAttempts: 3,
  initialDelay: 1000,      // 1 second
  maxDelay: 30000,         // 30 seconds
  backoffMultiplier: 2,    // Exponential: 1s, 2s, 4s, 8s...
  jitter: true             // Add randomness to prevent thundering herd
}
```

**Retry Decision:**
```typescript
function shouldRetry(error: CodegenError): boolean {
  // Retry on specific categories
  if (error.category === ErrorCategory.TRANSPORT) return true;
  if (error.category === ErrorCategory.TIMEOUT) return true;
  if (error.category === ErrorCategory.CONNECTION) return true;

  // Retry on specific HTTP codes
  if (error.code === "HTTP_ERROR_5XX") return true;
  if (error.code === "HTTP_ERROR_429") return true; // Rate limit

  // Don't retry on client errors
  if (error.category === ErrorCategory.VALIDATION) return false;
  if (error.category === ErrorCategory.AUTH) return false;
  if (error.code === "HTTP_ERROR_4XX") return false;

  return error.retryable;
}
```

**Delay Calculation:**
```typescript
function calculateDelay(attempt: number, policy: RetryPolicy): number {
  const baseDelay = policy.initialDelay * Math.pow(policy.backoffMultiplier, attempt - 1);
  const cappedDelay = Math.min(baseDelay, policy.maxDelay);

  if (policy.jitter) {
    // Add ±25% jitter
    const jitterAmount = cappedDelay * 0.25;
    return cappedDelay + (Math.random() - 0.5) * 2 * jitterAmount;
  }

  return cappedDelay;
}
```

### Custom Retry Policy

```typescript
import { call, setRetryPolicy } from "./codegen/runtime";

// Set global retry policy
setRetryPolicy({
  maxAttempts: 5,
  initialDelay: 500,
  maxDelay: 60000,
  backoffMultiplier: 3,
  jitter: true,
  shouldRetry: (error) => {
    // Custom logic
    return error.code === "CUSTOM_RETRYABLE_ERROR";
  }
});

// Or per-call override
await call("github__list_repos", params, {
  retry: {
    maxAttempts: 1  // No retries
  }
});
```

### Rate Limit Handling

**Automatic Detection:**
- HTTP 429 response
- `Retry-After` header parsing
- `X-RateLimit-*` headers

**Behavior:**
```typescript
// When rate limited:
if (response.status === 429) {
  const retryAfter = parseRetryAfter(response.headers["retry-after"]) || 60000;

  throw new CodegenError({
    code: "RATE_LIMITED",
    category: ErrorCategory.RATE_LIMIT,
    message: `Rate limited. Retry after ${retryAfter}ms`,
    retryable: true,
    context: { retryAfter }
  });
}
```

**Retry with delay:**
- Runtime waits for `retryAfter` duration
- Counts as one retry attempt
- Maximum wait: 5 minutes (configurable)

### Rate Limit Policy

```typescript
interface RateLimitPolicy {
  maxRequestsPerSecond?: number;
  maxConcurrent?: number;
  strategy: "sliding-window" | "token-bucket" | "fixed-window";
}

// Set per-source rate limits
setRateLimitPolicy("github", {
  maxRequestsPerSecond: 10,
  maxConcurrent: 5,
  strategy: "sliding-window"
});
```

---

## Connection Management

The runtime manages connections efficiently through pooling and lifecycle management.

### Connection Pooling (HTTP)

**Default Pool Settings:**
```typescript
{
  maxSockets: 50,           // Max concurrent connections
  maxFreeSockets: 10,       // Keep-alive pool size
  timeout: 30000,           // Socket timeout
  keepAlive: true,
  keepAliveMsecs: 1000
}
```

**Behavior:**
- Connections reused across requests
- Automatic cleanup of idle connections
- DNS caching for 5 minutes
- Socket timeout prevents hanging

### Process Management (MCP)

**Lifecycle:**
```
Initialize → Connect → Ready → [Executing] → Disconnect → Cleanup
                           ↓
                        Crashed
                           ↓
                        Restart (max 3x)
```

**Auto-restart logic:**
```typescript
async function ensureConnected(): Promise<MCPClient> {
  if (client.isConnected()) return client;

  if (retries < MAX_RETRIES) {
    retries++;
    await wait(calculateDelay(retries));
    await client.connect();
    return client;
  }

  throw new CodegenError({
    code: "MCP_PROCESS_DIED",
    category: ErrorCategory.CONNECTION,
    message: "MCP server failed to restart",
    retryable: false
  });
}
```

**Graceful Shutdown:**
- SIGTERM sent to subprocess
- Wait up to 5 seconds for clean exit
- SIGKILL if still running
- Cleanup stdio streams

### Connection State

```typescript
enum ConnectionState {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  RECONNECTING = "reconnecting",
  FAILED = "failed"
}

interface ConnectionInfo {
  state: ConnectionState;
  connectedAt?: Date;
  lastError?: CodegenError;
  retries: number;
  metrics: {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    avgDuration: number;
  };
}
```

---

## Type Safety Guarantees

### What TypeScript Knows

**Compile-time:**
- Tool names are strings (no enum generation)
- Parameter types when using `callTyped<TParams, TResult>`
- Return types when using `callTyped`
- Error types (`CodegenError`)

**Runtime:**
- Parameters validated against JSON Schema (if provided)
- Transport-level validation (HTTP status, JSON parsing)
- Connection state validation

### What TypeScript Doesn't Know

**Limitations:**
- Tool name validity (not validated at compile time)
- Actual parameter schema (unless using generated wrappers)
- Actual return type (unless using generated wrappers)

**Solution:** Use generated wrappers for full type safety:

```typescript
// Generated wrapper: codegen/openapi/github/list_repos.ts
import { listRepos, ListReposParams, ListReposResult } from "./codegen/openapi/github/list_repos";

// Full type safety
const repos: ListReposResult = await listRepos({
  path: { username: "anthropics" },  // TypeScript validates
  query: { sort: "stars" }           // TypeScript validates
});

// repos is typed as Repository[]
console.log(repos[0].stargazers_count);  // No 'any'
```

### Runtime Validation

**Input validation:**
- Parameters validated against JSON Schema (if available)
- Type coercion for primitives (string → number, etc.)
- Required field checking
- Format validation (email, url, date-time, etc.)

**Output validation:**
- Response parsing (JSON, XML, etc.)
- Schema validation (if output schema provided)
- Type coercion on response

**Validation errors:**
```typescript
throw new CodegenError({
  code: "INVALID_PARAMS",
  category: ErrorCategory.VALIDATION,
  message: "Parameter validation failed",
  retryable: false,
  context: {
    field: "path.username",
    expected: "string",
    received: "undefined"
  }
});
```

---

## LLM Usage Expectations

This section defines how LLMs (like Claude Code) should interact with the runtime.

### Discovery Pattern

**Step 1: Detect Code Mode**
```typescript
// LLM reads .agent-ready.json in project root
const manifest = JSON.parse(await readFile(".agent-ready.json"));

if (manifest.codeMode === true) {
  // Code Mode active - use wrappers instead of raw tools
  console.log(`Found ${manifest.tools.total} tools`);
  console.log(`Token reduction: ${manifest.tokenReduction.savings}`);
}
```

**Step 2: Import Runtime**
```typescript
// LLM generates this code
import { call } from "./codegen/runtime";
```

**Step 3: Use Tools**
```typescript
// LLM generates tool calls as regular async functions
const result = await call("source__tool_name", { /* params */ });
```

### Naming Convention

**Tool names:** `{source}__{tool_name}`

**Examples:**
- `filesystem__read_file`
- `github__list_repos`
- `stripe__create_payment`

**Rule:** Double underscore (`__`) separates source from tool name.

### Parameter Structure

**MCP tools:**
```typescript
await call("filesystem__read_file", {
  path: "/tmp/file.txt"
});
```

**REST tools:**
```typescript
await call("github__list_repos", {
  path: { username: "anthropics" },    // Path parameters
  query: { sort: "stars" },            // Query parameters
  body: { /* ... */ }                  // Request body (POST/PUT)
});
```

**Structure:**
- `path`: URL path parameters (e.g., `/users/{username}`)
- `query`: URL query parameters (e.g., `?sort=stars`)
- `body`: Request body for POST/PUT/PATCH
- Flat object for MCP tools

### Error Handling for LLMs

**LLMs should:**
1. Wrap calls in try-catch
2. Check `error.category` for handling strategy
3. Use `error.retryable` to decide on retry
4. Log `error.context` for debugging

**Example LLM-generated code:**
```typescript
import { call, CodegenError, ErrorCategory } from "./codegen/runtime";

async function fetchRepos(username: string) {
  try {
    const repos = await call("github__list_repos", {
      path: { username },
      query: { sort: "stars", per_page: 10 }
    });
    return repos;

  } catch (error) {
    if (error instanceof CodegenError) {
      // Handle known errors
      if (error.category === ErrorCategory.VALIDATION) {
        console.error("Invalid username:", username);
        return [];
      }

      if (error.category === ErrorCategory.RATE_LIMIT) {
        console.log("Rate limited, waiting 60s...");
        await sleep(60000);
        return fetchRepos(username); // Retry
      }

      // Log and re-throw unexpected errors
      console.error("API error:", error.message);
      throw error;
    }

    // Unknown error
    throw error;
  }
}
```

### Performance Hints for LLMs

**Batch calls when possible:**
```typescript
// Good: Parallel execution
const [repos, user, issues] = await Promise.all([
  call("github__list_repos", { path: { username: "anthropics" } }),
  call("github__get_user", { path: { username: "anthropics" } }),
  call("github__list_issues", { path: { owner: "anthropics", repo: "mcp" } })
]);

// Bad: Sequential execution
const repos = await call("github__list_repos", { ... });
const user = await call("github__get_user", { ... });
const issues = await call("github__list_issues", { ... });
```

**Reuse runtime instance:**
```typescript
// Runtime is singleton - no need to create multiple instances
// Just import and use
import { call } from "./codegen/runtime";
```

**Avoid unnecessary retries:**
```typescript
// Use retry: { maxAttempts: 1 } for operations that shouldn't retry
await call("stripe__create_payment", params, {
  retry: { maxAttempts: 1 }  // Don't retry payments
});
```

### LLM-Friendly Comments in Generated Code

All generated wrappers include:

```typescript
/**
 * List repositories for a user
 *
 * @example
 * ```typescript
 * const repos = await listRepos({
 *   path: { username: "anthropics" },
 *   query: { sort: "stars", per_page: 10 }
 * });
 * ```
 *
 * @param params - Request parameters
 * @param params.path.username - GitHub username
 * @param params.query.sort - Sort order: created, updated, pushed, full_name
 * @param params.query.per_page - Results per page (max 100)
 * @returns Array of repositories
 *
 * @throws {CodegenError} INVALID_PARAMS - Invalid parameters
 * @throws {CodegenError} RATE_LIMITED - GitHub rate limit exceeded
 * @throws {CodegenError} HTTP_ERROR_404 - User not found
 */
export async function listRepos(params: ListReposParams): Promise<ListReposResult> {
  return callTyped<ListReposParams, ListReposResult>("github__list_repos", params);
}
```

---

## Performance Characteristics

### Expected Performance

| Operation | Expected Time | Notes |
|-----------|--------------|-------|
| Runtime initialization | <10ms | Singleton, happens once |
| MCP discovery | <5s | Per server, cached |
| REST discovery | 5-10s | Fetch + parse OpenAPI spec, cached |
| MCP tool call | 10-100ms | Plus subprocess overhead |
| REST tool call | 50-500ms | Network latency dominant |
| Connection pool lookup | <1ms | In-memory |
| Auth resolution | <5ms | Cached after first use |
| Retry with backoff | 1-30s | Based on retry policy |

### Memory Usage

| Component | Memory | Notes |
|-----------|--------|-------|
| Runtime core | ~5MB | Singleton overhead |
| MCP client | ~10MB | Per subprocess |
| HTTP client | ~2MB | Plus connection pool |
| OpenAPI spec | ~1-10MB | Parsed and cached |
| Generated wrappers | ~100KB | All 1,100 tools |

### Optimization Guidelines

**For high-throughput:**
- Increase connection pool size
- Reduce retry attempts
- Use `callRaw()` to skip middleware

**For low-latency:**
- Pre-initialize runtime: `await getRuntime().initialize()`
- Use generated wrappers (no runtime tool lookup)
- Batch requests when possible

**For low-memory:**
- Disable spec caching
- Use lazy loading for wrappers
- Limit connection pool size

---

## Instrumentation & Logging

### Event Hooks

```typescript
import { onRuntimeEvent } from "./codegen/runtime";

// Subscribe to all runtime events
onRuntimeEvent("*", (event) => {
  console.log("Event:", event.type, event.data);
});

// Subscribe to specific events
onRuntimeEvent("call:start", (event) => {
  console.log("Starting call:", event.data.toolName);
});

onRuntimeEvent("call:success", (event) => {
  console.log("Call succeeded:", event.data.toolName, "in", event.data.duration, "ms");
});

onRuntimeEvent("call:error", (event) => {
  console.error("Call failed:", event.data.toolName, event.data.error);
});
```

### Available Events

| Event | Data | When |
|-------|------|------|
| `runtime:init` | `{ version }` | Runtime initialized |
| `discovery:start` | `{ source }` | Starting tool discovery |
| `discovery:complete` | `{ source, toolCount }` | Discovery completed |
| `discovery:error` | `{ source, error }` | Discovery failed |
| `call:start` | `{ toolName, params }` | Tool call starting |
| `call:success` | `{ toolName, result, duration }` | Call succeeded |
| `call:error` | `{ toolName, error, duration }` | Call failed |
| `call:retry` | `{ toolName, attempt, delay }` | Retrying call |
| `auth:resolve` | `{ source, method }` | Auth resolved |
| `auth:refresh` | `{ source }` | Auth refreshed |
| `connection:open` | `{ source, transport }` | Connection opened |
| `connection:close` | `{ source, transport }` | Connection closed |
| `connection:error` | `{ source, error }` | Connection failed |

### Logging Levels

```typescript
import { setLogLevel } from "./codegen/runtime";

setLogLevel("debug");   // All events
setLogLevel("info");    // Important events
setLogLevel("warn");    // Warnings and errors
setLogLevel("error");   // Errors only
setLogLevel("silent");  // No logs
```

### Custom Logger

```typescript
import { setLogger } from "./codegen/runtime";

setLogger({
  debug: (message, context) => winston.debug(message, context),
  info: (message, context) => winston.info(message, context),
  warn: (message, context) => winston.warn(message, context),
  error: (message, context) => winston.error(message, context)
});
```

### Telemetry Example

```typescript
import { onRuntimeEvent } from "./codegen/runtime";

// Send metrics to monitoring service
onRuntimeEvent("call:success", ({ data }) => {
  metrics.histogram("codegen.call.duration", data.duration, {
    tool: data.toolName,
    source: data.source
  });
});

onRuntimeEvent("call:error", ({ data }) => {
  metrics.increment("codegen.call.errors", {
    tool: data.toolName,
    error: data.error.code
  });
});
```

---

## Contract Guarantees Summary

### The runtime WILL:
- ✅ Automatically discover tools on first use
- ✅ Retry transient failures (network, timeout, 5xx)
- ✅ Resolve authentication from config and environment
- ✅ Manage connection pooling and lifecycle
- ✅ Throw standardized `CodegenError` instances
- ✅ Respect timeout limits (30s default)
- ✅ Clean up resources on exit
- ✅ Emit events for instrumentation

### The runtime WILL NOT:
- ❌ Validate tool names at compile time
- ❌ Retry non-retryable errors (4xx, validation, auth)
- ❌ Store or cache API responses (caching is caller's responsibility)
- ❌ Modify parameters or results (pass-through semantics)
- ❌ Guarantee specific execution order for parallel calls
- ❌ Persist state across process restarts

### Breaking Changes Policy

**Semantic versioning:**
- Major version: Breaking changes to this contract
- Minor version: New features, backward compatible
- Patch version: Bug fixes, no API changes

**What's considered breaking:**
- Changing error shapes
- Removing/renaming core functions (`call`, `callTyped`, etc.)
- Changing retry behavior significantly
- Removing auth types

**What's NOT breaking:**
- Adding new error codes
- Adding new auth types
- Adding new transports
- Performance improvements
- Bug fixes in error handling

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.1.0 | 2025-11-22 | Initial runtime contract |

---

## Future Additions

The following are planned but not yet implemented:

- [ ] `callRaw()` implementation
- [ ] Custom auth resolver registration
- [ ] Rate limit policy API
- [ ] Connection state inspection API
- [ ] Instrumentation hooks implementation
- [ ] GraphQL transport
- [ ] gRPC transport
- [ ] Response caching layer
- [ ] Request deduplication
- [ ] Circuit breaker pattern
- [ ] Distributed tracing support

These will be added in minor version updates without breaking this contract.
