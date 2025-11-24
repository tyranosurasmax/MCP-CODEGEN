# @mcp-codegen/runtime

Universal runtime for MCP-CODEGEN - handles execution of tools from any source (MCP, REST, GraphQL, databases).

## Installation

```bash
npm install @mcp-codegen/runtime
```

## Quick Start

```typescript
import { call } from "@mcp-codegen/runtime";

// Call any tool by name
const repos = await call("github__list_repos", {
  path: { username: "anthropics" }
});
```

## Features

- **Universal Execution** - One runtime for MCP, REST, GraphQL, databases
- **Standardized Errors** - Consistent error handling across all sources
- **Automatic Retries** - Exponential backoff with jitter
- **Authentication** - Bearer, API Key, Basic, OAuth2, Custom
- **Schema Validation** - Runtime parameter validation
- **Instrumentation** - Events, metrics, logging

## Core API

### `call(toolName, params, options?)`

Execute any tool with runtime type checking:

```typescript
const result = await call("github__list_repos", {
  path: { username: "anthropics" },
  query: { sort: "stars", per_page: 10 }
});
```

### `callTyped<TParams, TResult>(toolName, params, options?)`

Execute with compile-time type safety:

```typescript
interface ListReposParams {
  path: { username: string };
  query?: { sort?: string; per_page?: number };
}

interface Repository {
  name: string;
  stargazers_count: number;
}

const repos = await callTyped<ListReposParams, Repository[]>(
  "github__list_repos",
  { path: { username: "anthropics" } }
);

// TypeScript knows repos is Repository[]
console.log(repos[0].stargazers_count);
```

## Error Handling

All errors are `CodegenError` instances with standardized shapes:

```typescript
import { call, CodegenError, ErrorCategory } from "@mcp-codegen/runtime";

try {
  const result = await call("github__list_repos", params);
} catch (error) {
  if (error instanceof CodegenError) {
    switch (error.category) {
      case ErrorCategory.VALIDATION:
        console.error("Invalid params:", error.context);
        break;
      case ErrorCategory.RATE_LIMIT:
        await sleep(error.context?.retryAfter || 60000);
        break;
      case ErrorCategory.AUTH:
        await refreshAuth();
        break;
    }
  }
}
```

## Authentication

Supports multiple auth types with automatic resolution:

```typescript
import { registerAuthResolver } from "@mcp-codegen/runtime/auth";

// Custom auth resolver
registerAuthResolver({
  name: "myAuth",
  async resolve(context) {
    const token = await fetchTokenFromVault(context.source);
    return {
      headers: { Authorization: `Bearer ${token}` },
      expires: new Date(Date.now() + 3600000)
    };
  }
});
```

## Retry Policy

Configure retry behavior globally or per-call:

```typescript
import { setRetryPolicy, RetryPresets } from "@mcp-codegen/runtime/retry";

// Global policy
setRetryPolicy(RetryPresets.AGGRESSIVE);

// Per-call override
await call("github__list_repos", params, {
  retry: { maxAttempts: 1 }  // No retries
});
```

## Instrumentation

Monitor runtime behavior with events:

```typescript
import { onRuntimeEvent } from "@mcp-codegen/runtime/instrumentation";

onRuntimeEvent("call:error", (event) => {
  console.error("Call failed:", event.data.toolName, event.data.error);
  sendToSentry(event.data.error);
});

onRuntimeEvent("*", (event) => {
  sendToDatadog(event);
});
```

## Schema Validation

Validate parameters at runtime:

```typescript
import { normalizeSchema, validateSchema } from "@mcp-codegen/runtime/schema";

const schema = normalizeSchema(rawSchema);
validateSchema(schema, params);  // Throws if invalid
```

## Documentation

- [Runtime Contract](./RUNTIME_CONTRACT.md) - Complete specification
- [Examples](../examples) - Usage examples
- [Architecture](../ARCHITECTURE.md) - Design decisions

## License

Apache-2.0 - See [LICENSE](../LICENSE)
