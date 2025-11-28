# MCP-CODEGEN

**Universal Tool Discovery for AI Agents**

![Status](https://img.shields.io/badge/status-active%20development-orange)
![Version](https://img.shields.io/badge/version-1.1.0-blue)
![ATM Spec](https://img.shields.io/badge/ATM_Spec-1.0.0--draft-purple)
![License](https://img.shields.io/badge/license-Apache%202.0-green)

> **Reference implementation of the Agent Tool Manifest (ATM) Specification.**
> Transform ANY API into type-safe TypeScript wrappers with 98% token reduction.

---

## What is This?

**MCP-CODEGEN** generates TypeScript wrapper code that AI agents use to interact with APIs — with 98% fewer tokens than sending raw API specifications.

Instead of sending a 150K token API specification in every prompt, agents import and use ~2K tokens of generated wrapper code.

### The Token Problem

| Source Type | Raw Spec Size | With MCP-CODEGEN | Reduction |
|-------------|--------------|------------------|-----------|
| MCP Server | ~150K tokens | ~2K tokens | **98.7%** |
| REST/OpenAPI | ~200K tokens | ~3K tokens | **98.5%** |
| GraphQL | ~100K tokens | ~1.5K tokens | **98.5%** |

### The Solution

```
Any API Source              Agent Tool Manifest           Any AI Agent
───────────────             ───────────────────           ────────────

MCP Server      ─┐                                    ┌─► Claude
                 │       .agent-ready.json            │
REST/OpenAPI   ──┼────►   + TypeScript wrappers  ────┼─► GPT
                 │                                    │
GraphQL        ──┘                                    └─► Any Agent
```

One format. Any source. Universal discovery.

---

## Supported Sources

| Source Type | Status | Adapter |
|-------------|--------|---------|
| **MCP Servers** | ✅ Production | `MCPAdapter` |
| **REST/OpenAPI** | ✅ Production | `OpenAPIAdapter` |
| **GraphQL** | ✅ Available | `GraphQLAdapter` |
| **Databases** | 📋 Planned | `DatabaseAdapter` |

---

## Quick Start

```bash
# Install
npm install -g mcp-codegen

# Initialize a new project
mcp-codegen quickstart

# Or create a config manually
cat > codegen.config.json << 'EOF'
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
        "spec": "https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json",
        "baseUrl": "https://api.github.com"
      }
    }
  }
}
EOF

# Generate wrappers
mcp-codegen sync
```

**Use the generated wrappers:**

```typescript
import { call } from "./codegen/runtime";

// MCP: Read local file
const data = await call("filesystem__read_file", {
  path: "/tmp/repos.json"
});

// REST: Fetch from GitHub
const repos = await call("github__list_repos", {
  path: { username: "anthropics" }
});

// Chain them together
await call("filesystem__write_file", {
  path: "/tmp/anthropic-repos.json",
  content: JSON.stringify(repos, null, 2)
});
```

**Result:** 98% token reduction. One runtime. Universal.

---

## The ATM Specification

MCP-CODEGEN implements the **Agent Tool Manifest (ATM) Specification** — a universal format for AI agent tool discovery.

📄 **[Read the full specification → SPEC.md](./SPEC.md)**

### Why a Specification?

- **Universal** — Works for MCP, REST, GraphQL, databases
- **Minimal** — Optimized for LLM token efficiency
- **Open** — Anyone can implement generators or consumers
- **Validatable** — JSON Schema for correctness

### The `.agent-ready.json` Manifest

Every project generates a manifest that agents can use for discovery:

```json
{
  "specVersion": "1.0.0",
  "codeMode": true,
  "name": "my-tools",
  "description": "MCP and REST API tools",
  "sources": {
    "mcp": ["filesystem"],
    "openapi": ["github"],
    "total": 2
  },
  "tools": {
    "total": 1122,
    "bySource": { "filesystem": 14, "github": 1108 }
  },
  "capabilities": ["type-safety", "mcp-servers", "rest-apis"],
  "tokenReduction": {
    "traditional": 207500,
    "codeMode": 2500,
    "savings": "98.8%"
  }
}
```

---

## Features

### Universal Source Support
- MCP servers (Model Context Protocol)
- REST APIs (OpenAPI/Swagger 3.x)
- GraphQL APIs (via introspection)

### Production Infrastructure
- Automatic retries with exponential backoff
- 5 authentication types with env var resolution
- Connection pooling
- Comprehensive error handling

### Developer Experience
- Type-safe TypeScript wrappers
- IDE autocomplete for all APIs
- Hash-based regeneration (only regenerate changed tools)
- Full instrumentation and telemetry

### LLM Optimization
- 98% token reduction (validated)
- Progressive disclosure
- Clean, minimal wrappers

---

## Configuration

### Multi-Source Config

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

### Authentication Types

| Type | Description |
|------|-------------|
| `bearer` | Bearer token in Authorization header |
| `apiKey` | API key in header or query |
| `basic` | HTTP Basic authentication |
| `oauth2` | OAuth 2.0 (multiple flows) |
| `custom` | Pluggable custom resolver |

Environment variables are resolved automatically: `${GITHUB_TOKEN}` → actual token value.

---

## CLI Commands

```bash
# Generate all wrappers from config
mcp-codegen sync

# Generate specific source only
mcp-codegen generate <source-name>

# List discovered sources and tools
mcp-codegen list

# Initialize new project interactively
mcp-codegen quickstart

# Validate manifest against ATM spec
mcp-codegen validate .agent-ready.json
```

---

## Architecture

```
┌─────────────────────────────┐
│   ANY API SOURCE            │
│  MCP | REST | GraphQL | DB  │
└──────────────┬──────────────┘
               │
        ┌──────▼────────┐
        │   Adapters    │  ← Source-specific discovery & execution
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
        │  Universal    │  ← One runtime for all sources
        │   Runtime     │
        └───────────────┘
```

**See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed design.**

---

## Examples

### MCP Server

```typescript
import { call } from "./codegen/runtime";

const content = await call("filesystem__read_file", {
  path: "/tmp/example.txt"
});
```

### REST API

```typescript
const user = await call("github__get_user", {
  path: { username: "anthropics" }
});
```

### GraphQL

```typescript
const products = await call("shopify__query_products", {
  first: 10,
  query: "tag:featured"
});
```

### Type-Safe Calls

```typescript
import { callTyped } from "./codegen/runtime";

interface GitHubUser {
  login: string;
  name: string;
  public_repos: number;
}

const user = await callTyped<{ path: { username: string } }, GitHubUser>(
  "github__get_user",
  { path: { username: "anthropics" } }
);

console.log(`${user.name} has ${user.public_repos} repos`);
```

---

## Benchmarks

**Validated Token Reduction:**

| Source | Before | After | Reduction | Tools |
|--------|--------|-------|-----------|-------|
| MCP filesystem | 1,841 | 120 | **93.5%** | 14 |
| GitHub REST | 205,658 | 120 | **99.94%** | 1,108 |
| Combined | 2,442 | 139 | **94.3%** | 19 |

**Performance:**
- GitHub API (11.6MB spec): Generates 1,108 wrappers in ~30s
- Discovery: <5s for most sources
- Generation: <1s per tool
- Runtime overhead: <50ms per call

---

## Project Structure

```
MCP-CODEGEN/
├── SPEC.md                 # ATM Specification
├── atm.schema.json         # JSON Schema for validation
├── ARCHITECTURE.md         # Technical architecture
├── src/
│   ├── adapters/           # Source adapters
│   │   ├── mcp-adapter.ts
│   │   ├── openapi-adapter.ts
│   │   └── graphql-adapter.ts
│   ├── runtime/            # Universal runtime
│   │   ├── auth-resolver.ts
│   │   ├── retry-policy.ts
│   │   └── errors.ts
│   ├── codegen/            # Code generation
│   └── cli.ts              # CLI commands
├── codegen/                # Generated output (example)
│   ├── mcp/
│   ├── openapi/
│   └── runtime/
└── .agent-ready.json       # Generated manifest
```

---

## Acknowledgments

This project extends concepts from:

- **[Anthropic's MCP](https://www.anthropic.com/news/model-context-protocol)** — The Model Context Protocol that enables AI-tool communication
- **[Cloudflare's Code Mode](https://blog.cloudflare.com/cloudflare-workers-code-mode)** — Demonstrated code generation for tool efficiency

MCP-CODEGEN extends these concepts to work **universally** across MCP, REST, GraphQL, and other API types through the ATM specification.

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for:
- Development setup
- Architecture guidelines
- How to add adapters
- Testing strategies

---

## License

Apache 2.0 License - see [LICENSE](./LICENSE) for details.

This project includes patent protection under Apache 2.0.
See [NOTICE](./NOTICE) and [COPYRIGHT](./COPYRIGHT) for attribution requirements.

---

## Links

- **Specification:** [SPEC.md](./SPEC.md)
- **Architecture:** [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Examples:** [examples/](./examples/)
- **Issues:** [GitHub Issues](https://github.com/tyranosurasmax/MCP-CODEGEN/issues)
- **Discussions:** [GitHub Discussions](https://github.com/tyranosurasmax/MCP-CODEGEN/discussions)

---

**Universal tool discovery for AI agents. One format. Any API. 98% token reduction.**
