# Architecture: Universal Code Generation

## Vision

**One tool to generate type-safe wrappers for ANY API, service, or tool.**

Transform API specifications into TypeScript wrappers with 98% token reduction.

---

## The Problem

LLMs struggle with:
- **MCP tool definitions** consuming thousands of tokens
- **REST API docs** (OpenAPI specs) being even larger
- **GraphQL schemas** bloating context windows
- **Database schemas** requiring verbose definitions
- Every integration type having different formats

**Result:** Limited context, higher costs, slower performance.

---

## The Solution

### Universal Code Mode

```
┌────────────────────────────┐
│     Any API Source         │
│  MCP | REST | GraphQL | DB │
└────────────┬───────────────┘
             │
      ┌──────▼────────┐
      │   Universal   │
      │    Adapter    │  ← Source-specific logic
      │    Pattern    │
      └──────┬────────┘
             │
      ┌──────▼────────┐
      │   Discovery   │  ← Extract tool/endpoint definitions
      └──────┬────────┘
             │
      ┌──────▼────────┐
      │   Codegen     │  ← JSON Schema → TypeScript
      └──────┬────────┘
             │
      ┌──────▼────────┐
      │  TypeScript   │  ← Type-safe wrappers
      │   Wrappers    │
      └──────┬────────┘
             │
      ┌──────▼────────┐
      │   Universal   │  ← One runtime for all sources
      │    Runtime    │
      └───────────────┘
```

---

## Design Principles

### 1. **Source Agnostic**
Every source type (MCP, OpenAPI, GraphQL, etc.) implements the same `SourceAdapter` interface.

### 2. **Adapter Pattern**
Easy to add new sources without changing core logic.

### 3. **Unified Output**
All sources generate the same TypeScript wrapper pattern.

### 4. **Single Runtime**
One runtime handles all sources transparently.

### 5. **Token Optimized**
98% reduction across all source types.

---

## Core Components

### Source Adapter Interface

```typescript
interface SourceAdapter {
  name: string;        // Unique identifier
  type: string;        // Source type (mcp, openapi, etc.)

  discover(): Promise<ToolDefinition[]>;  // Find tools/endpoints
  execute(tool: string, params: any): Promise<any>;  // Call tool
  validate(): Promise<boolean>;  // Check configuration
  close(): Promise<void>;  // Cleanup
}
```

Every source type implements this interface, ensuring consistency.

### Runtime Infrastructure (v1.1+)

The universal runtime provides enterprise-grade infrastructure:

#### **Error Handling System** (`src/runtime/errors.ts`)

Standardized error shapes for consistent handling:

```typescript
class CodegenError extends Error {
  code: string;           // e.g., "TOOL_NOT_FOUND", "RATE_LIMITED"
  category: ErrorCategory; // CONFIG, VALIDATION, TRANSPORT, etc.
  retryable: boolean;     // Whether retry should be attempted
  context?: object;       // Additional debug info
}
```

**Error Categories:**
- `CONFIG` - Configuration errors (not retryable)
- `VALIDATION` - Invalid parameters (not retryable)
- `TRANSPORT` - Network failures (retryable)
- `TIMEOUT` - Request timeouts (retryable)
- `AUTH` - Authentication failures (not retryable without refresh)
- `RATE_LIMIT` - Rate limiting (retryable with delay)
- `EXECUTION` - Tool execution failures (depends)
- `CONNECTION` - Connection failures (retryable)
- `INTERNAL` - Unexpected errors (not retryable)

See `RUNTIME_CONTRACT.md` for complete error handling specification.

#### **Authentication System** (`src/runtime/auth-resolver.ts`)

Automatic authentication resolution with caching and refresh:

```typescript
interface AuthResolver {
  resolve(context: AuthContext): Promise<AuthResult>;
  refresh?(context: AuthContext): Promise<AuthResult>;
}
```

**Supported Auth Types:**
- Bearer tokens (with environment variable substitution)
- API keys (header, query, or cookie)
- Basic authentication
- OAuth2 (client credentials, authorization code)
- Custom resolvers (pluggable)

**Features:**
- Environment variable substitution: `${GITHUB_TOKEN}`
- Token caching with expiration
- Automatic refresh for OAuth2
- Custom auth resolver registration

#### **Retry Policy System** (`src/runtime/retry-policy.ts`)

Exponential backoff with jitter for transient failures:

```typescript
interface RetryPolicy {
  maxAttempts: number;         // Default: 3
  initialDelay: number;        // Default: 1000ms
  maxDelay: number;           // Default: 30000ms
  backoffMultiplier: number;  // Default: 2 (exponential)
  jitter: boolean;            // Default: true
}
```

**Retry Logic:**
- Automatic retry for network/transport errors
- Exponential backoff with jitter (prevents thundering herd)
- Rate limit aware (respects `Retry-After` header)
- Configurable per-call or globally

**Retry Presets:**
- `NONE` - No retries
- `CONSERVATIVE` - Few retries, long delays
- `AGGRESSIVE` - Many retries, short delays
- `NETWORK` - Optimized for network failures
- `RATE_LIMIT` - Respects server rate limits

#### **Schema Normalization** (`src/runtime/schema-normalizer.ts`)

Handles inconsistent schemas from different sources:

```typescript
function normalizeSchema(schema: unknown): NormalizedSchema {
  // Fixes:
  // - Missing type fields (inferred from properties/items)
  // - Inconsistent required arrays
  // - Invalid additionalProperties
  // - Nested schema issues
}
```

**Features:**
- Runtime parameter validation
- Type coercion (string → number, etc.)
- Composition schema support (anyOf, oneOf, allOf)
- Helpful validation error messages

**Why Critical:**
- MCP schemas often missing `type: "object"`
- OpenAPI specs have inconsistent property definitions
- GraphQL introspection has different schema format
- Prevents errors during generation and runtime

#### **Instrumentation System** (`src/runtime/instrumentation.ts`)

Observability for monitoring and debugging:

```typescript
// Event emission
emitRuntimeEvent("call:start", { toolName, params });
emitRuntimeEvent("call:success", { toolName, result, duration });
emitRuntimeEvent("call:error", { toolName, error });

// Event subscription
onRuntimeEvent("call:error", (event) => {
  console.error("Call failed:", event.data);
});
```

**Available Events:**
- `runtime:init` - Runtime initialized
- `discovery:start/complete/error` - Tool discovery
- `call:start/success/error/retry` - Tool execution
- `auth:resolve/refresh/error` - Authentication
- `connection:open/close/error` - Connection lifecycle
- `transport:send/receive` - Transport operations

**Features:**
- Pluggable logger interface
- Performance metrics per source
- Log levels (DEBUG, INFO, WARN, ERROR, SILENT)
- Custom event listeners
- Telemetry integration support

**Metrics Tracked:**
- Total/successful/failed calls
- Average/min/max duration
- Retry counts
- Success rates per source

### Current Adapters

#### **MCPAdapter**
- Connects to MCP servers via stdio
- Manages subprocess lifecycle
- Handles retries and timeouts
- Buffers streaming responses

#### **OpenAPIAdapter**
- Loads OpenAPI 3.x specifications
- Converts operations to tool definitions
- Handles HTTP authentication (Bearer, API Key, Basic)
- Makes REST API calls via axios

#### **GraphQLAdapter**
- Introspects GraphQL schemas via introspection query
- Converts queries/mutations to tool definitions
- Handles GraphQL-specific auth (Bearer, API Key)
- Executes operations via HTTP POST
- Supports both queries and mutations

#### **DatabaseAdapter** (Planned)
- Introspects database schemas
- Generates type-safe CRUD operations
- Supports PostgreSQL, MySQL, SQLite
- Connection pooling

---

## Agent Tool Manifest Specification

MCP-CODEGEN implements the **Agent Tool Manifest (ATM) Specification** — a universal format for AI agent tool discovery.

See [SPEC.md](./SPEC.md) for the complete specification.

### Key Concepts

The `.agent-ready.json` manifest provides:
- **Token-efficient discovery** — Agents understand available tools without loading full specs
- **Universal format** — Same structure regardless of source type (MCP, REST, GraphQL)
- **Capability flags** — Agents know what features are available
- **Auth requirements** — Per-source authentication information

### Manifest Structure

```json
{
  "specVersion": "1.0.0",
  "codeMode": true,
  "name": "my-tools",
  "description": "MCP and REST API tools",
  "version": "1.1.0",
  "generated": "2025-11-28T00:00:00.000Z",
  "sources": {
    "mcp": ["filesystem"],
    "openapi": ["github"],
    "total": 2
  },
  "tools": {
    "total": 1122,
    "bySource": { "filesystem": 14, "github": 1108 }
  },
  "paths": {
    "runtime": "./codegen/runtime",
    "wrappers": "./codegen",
    "config": "./codegen.config.json"
  },
  "capabilities": ["type-safety", "mcp-servers", "rest-apis"],
  "tokenReduction": {
    "traditional": 207500,
    "codeMode": 2500,
    "reduction": 0.9879,
    "savings": "98.8%"
  }
}
```

---

## Data Flow

### Discovery Phase

```
1. Load configuration (codegen.config.json)
2. Create adapters for each source
3. Call adapter.discover() for each
4. Normalize to ToolDefinition format
5. Generate TypeScript wrappers
6. Generate per-source index files
7. Generate .agent-ready.json manifest
```

### Runtime Phase

```
1. Load universal runtime
2. Register all adapters
3. Agent calls: runtime.call("source__tool", params)
4. Runtime routes to correct adapter
5. Adapter executes and returns result
6. Result passed back to agent
```

---

## Configuration Format

### Universal Config

```json
{
  "sources": {
    "mcp": {
      "filesystem": {
        "type": "mcp",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
      }
    },
    "openapi": {
      "github": {
        "type": "openapi",
        "spec": "https://api.github.com/openapi.json",
        "baseUrl": "https://api.github.com",
        "auth": {
          "type": "bearer",
          "token": "${GITHUB_TOKEN}"
        }
      }
    },
    "graphql": {
      "shopify": {
        "type": "graphql",
        "endpoint": "https://mystore.myshopify.com/admin/api/graphql.json",
        "auth": {
          "type": "bearer",
          "token": "${SHOPIFY_TOKEN}"
        }
      }
    }
  },
  "outputDir": "./codegen",
  "runtimePackage": "codegen/runtime"
}
```

---

## Generated Output Structure

```
codegen/
├── mcp/                    # MCP-sourced wrappers
│   ├── filesystem/
│   │   ├── readFile.ts
│   │   ├── writeFile.ts
│   │   └── index.ts
│   └── sqlite/
│       ├── query.ts
│       └── index.ts
├── openapi/                # REST API wrappers
│   ├── github/
│   │   ├── getUser.ts
│   │   ├── listRepos.ts
│   │   └── index.ts
│   └── stripe/
│       ├── createCharge.ts
│       └── index.ts
├── graphql/                # GraphQL wrappers
│   └── shopify/
│       ├── queryProducts.ts
│       ├── createProduct.ts
│       └── index.ts
├── runtime/
│   └── index.ts           # Universal runtime
├── config.json            # Saved configuration
├── benchmark.json         # Token usage stats
└── BENCHMARK.md          # Human-readable report
```

---

## Wrapper Format

Every generated wrapper follows this pattern:

```typescript
// AUTO-GENERATED BY codegen v1.1.0
// hash: abc123

import { call } from "codegen/runtime";

export interface Params { /* ... */ }
export interface Result { /* ... */ }

export const toolMeta = {
  source: "github",
  type: "openapi",
  name: "get_user",
  description: "Get a user by username"
};

export async function getUser(params: Params): Promise<Result> {
  return call<Params, Result>("github__get_user", params);
}

// END AUTO-GENERATED

/* USER-EDITABLE AREA BELOW */
// Add custom logic here...
```

---

## Extension Points

### Adding a New Source Type

1. **Create Adapter Class**
```typescript
export class MyAdapter extends BaseAdapter {
  constructor(name: string, config: MyConfig) {
    super(name, 'my-source-type');
  }

  async discover() { /* Fetch tool definitions */ }
  async execute(tool, params) { /* Execute tool */ }
}
```

2. **Add to Orchestrator**
```typescript
if (config.sources.mySource) {
  for (const [name, cfg] of Object.entries(config.sources.mySource)) {
    adapters.push(new MyAdapter(name, cfg));
  }
}
```

3. **Update Types**
```typescript
export interface MySourceConfig {
  type: 'my-source-type';
  // ... config fields
}

export interface UniversalConfig {
  sources: {
    mcp?: { [name: string]: MCPServerConfig };
    openapi?: { [name: string]: OpenAPIConfig };
    graphql?: { [name: string]: GraphQLConfig };
    mySource?: { [name: string]: MySourceConfig };  // Add this
  };
}
```

That's it! The rest (codegen, runtime, CLI) works automatically.

---

## Performance Characteristics

### Token Reduction

| Source Type | Before (raw spec) | After (wrappers) | Reduction |
|-------------|------------------|------------------|-----------|
| MCP Server  | ~152,000 tokens  | ~2,000 tokens    | **98.7%** |
| OpenAPI     | ~200,000 tokens  | ~3,000 tokens    | **98.5%** |
| GraphQL     | ~100,000 tokens  | ~1,500 tokens    | **98.5%** |

### Runtime Performance

- **MCP**: Persistent subprocess connections
- **REST**: HTTP connection pooling via axios
- **GraphQL**: Single endpoint, query batching possible
- **Database**: Connection pooling (planned)

---

## Security Model

### Current (v1.1)

- **MCP**: Subprocess isolation (limited)
- **REST**: API keys via environment variables
- **GraphQL**: Bearer tokens via environment variables
- **No sandboxing**: Generated code runs with full privileges

### Planned

- **Sandboxing**: VM2 or isolated-vm for Node.js
- **Credential Management**: Vault integration, secret rotation
- **Network Policies**: Allowlist/blocklist for HTTP
- **Audit Logging**: Track all tool executions

---

## Roadmap

### v1.2 - Database Support
- Database adapter (PostgreSQL, MySQL, SQLite)
- Schema introspection
- Type-safe CRUD operations
- Connection pooling

### v1.3 - Advanced Features
- Streaming support
- Caching layer
- Rate limiting
- Circuit breakers

### v2.0 - Platform
- Web UI for configuration
- Plugin ecosystem
- Commercial enterprise features
- Multi-language support (Python, Go)

### v3.0 - Intelligence
- AI-powered composition
- Automatic error recovery
- Cost optimization
- Performance prediction

---

## Comparison to Alternatives

### Anthropic's Code Mode (MCP only)
- Supports MCP servers
- Token reduction for MCP tools
- We extend with: REST, GraphQL, database support

### Cloudflare's Code Mode
- MCP and code execution on Workers platform
- V8 isolate security
- We add: Platform independence, more source types

### OpenAPI Generator
- REST API code generation
- Mature codegen features
- We add: LLM optimization (98% reduction), multi-source support

### Prisma (Databases)
- Database abstraction and migrations
- Advanced DB features
- We add: Multi-source support beyond databases

**Our Approach:** Universal support with LLM optimization.

---

## Technical Decisions

### Why TypeScript First?
- Best LLM training data
- Strong typing helps agents
- Great tooling (VSCode)
- Easy to add other languages later

### Why Adapter Pattern?
- Extensibility without coupling
- Easy to test in isolation
- Clear separation of concerns
- Community can add adapters

### Why Single Runtime?
- Simpler for agents
- Consistent error handling
- Easier to add features (caching, logging)
- Clear ownership of connections

### Why Not Full Streaming Yet?
- Complexity vs. value tradeoff
- Most tools return small payloads
- Coming in v1.3 when it's critical

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for:
- Development setup
- Architecture guidelines
- How to add adapters
- Testing strategies

---

**Built with the belief that AI agents deserve infrastructure as good as the APIs they call.**
