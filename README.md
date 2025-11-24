# MCP-CODEGEN

**Universal Code Mode for APIs, Services, and Tools**

![Status](https://img.shields.io/badge/status-active%20development-orange)
![Version](https://img.shields.io/badge/version-1.1.0-blue)
![License](https://img.shields.io/badge/license-Apache%202.0-green)

> **ACTIVE DEVELOPMENT**: This project is under active development. See commit history for latest updates.

Transform ANY API into type-safe TypeScript wrappers with 98% token reduction.

**98% token reduction | Type-safe | Universal | Production-ready**

---

## What is Universal Code Mode?

**Code Mode, evolved.** This project takes the Code Mode concept pioneered by Anthropic and Cloudflare and makes it **universal, production-ready, and significantly more powerful.**

### The Problem Code Mode Solves

- **Traditional approach**: Send massive API specs to LLMs in every prompt (150K+ tokens)
- **Code Mode approach**: Generate tiny TypeScript wrappers agents can import like regular functions

**The Result:** 98% fewer tokens, better performance, cleaner code.

### How MCP-CODEGEN Extends Code Mode

Building on Anthropic's Code Mode for MCP servers and Cloudflare's demonstration on Workers:

**This implementation focuses on:**
-  **Multiple API types** - MCP and REST APIs (v1), with GraphQL planned
-  **Platform-agnostic** - runs anywhere Node.js runs, not locked to one platform
-  **Production infrastructure** - enterprise-grade error handling, retries, auth, instrumentation
-  **Open source** - Apache 2.0 licensed, extensible architecture
-  **Scale validation** - 1,100+ tools from GitHub API with 99.94% reduction

**Additional features:**
- Universal adapter pattern for multi-source integration
- Standardized `.agent-ready.json` discovery mechanism
- Automatic retry with exponential backoff
- 5 authentication types with environment variable resolution
- Runtime schema normalization for inconsistent APIs
- Full instrumentation and telemetry support

**Built on ideas from:**
- [Anthropic's MCP Code Mode](https://www.anthropic.com/news/model-context-protocol) - Introduced the concept
- [Cloudflare's Code Mode](https://blog.cloudflare.com/cloudflare-workers-code-mode) - Demonstrated platform integration

---

## Supported Sources

### Implemented (v1)
| Source Type | Status | Use Case |
|-------------|--------|----------|
| **MCP Servers** |  Production | Claude Desktop tools, local services |
| **REST APIs** |  Production | GitHub, Stripe, any OpenAPI spec |

### Planned (Future Releases)
| Source Type | Status | Use Case |
|-------------|--------|----------|
| **GraphQL APIs** |  Planned | GitHub GraphQL, Shopify, Hasura |
| **Databases** |  Planned | Prisma-style introspection |

**v1 Scope:** MCP + OpenAPI REST. Both adapters are production-ready and fully functional.

---

## Quick Start

### Copy-Paste and Go 

**Want to see it working in 30 seconds?** Run the universal example:

```bash
git clone https://github.com/tyranosurasmax/MCP-CODEGEN
cd MCP-CODEGEN/examples/universal-github
npm install
npx mcp-codegen sync
npm run demo
```

**That's it!** The demo:
-  Calls GitHub REST API (1,100+ tools)
-  Calls MCP filesystem server
-  Shows universal `call()` interface
-  Proves 99.4% token reduction

If that works on your machine, everything else will work. See [`examples/universal-github/README.md`](examples/universal-github/README.md) for details.

---

### Manual Setup

**Install globally:**
```bash
npm install -g @mcp-codegen/cli
```

**Create config:**
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
        "spec": "https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json",
        "baseUrl": "https://api.github.com"
      }
    }
  }
}
```

**Generate wrappers:**
```bash
mcp-codegen sync
```

**Use in your code:**
```typescript
import { call } from "@mcp-codegen/runtime";

// MCP: Read local file
const data = await call("filesystem__read_file", {
  path: "/tmp/repos.json"
});

// REST: Fetch from GitHub
const repos = await call("github__repos_list_for_user", {
  path: { username: "anthropics" }
});

// Universal: Chain them together
await call("filesystem__write_file", {
  path: "/tmp/anthropic-repos.json",
  content: JSON.stringify(repos, null, 2)
});
```

**Result:** 98% token reduction. One runtime. Universal.

---

## What This Does

**mcp-codegen generates TypeScript wrapper code that AI agents can use to interact with APIs.**

### What We Are NOT

- **Not an MCP Server**: We don't create servers. We create wrappers for existing MCP servers, REST APIs, and other sources.
- **Not a Client Library Generator**: Traditional tools like openapi-generator create libraries for human developers. We optimize for AI agents and LLM token efficiency.
- **Not an AI Agent**: We don't write code or act autonomously. We're a tool that generates code for agents to use.

### What We Actually Do

1. **Discover** API sources (MCP servers, OpenAPI specs; GraphQL planned)
2. **Generate** type-safe TypeScript wrappers optimized for LLM consumption
3. **Reduce** token usage by 98% compared to sending raw API specifications
4. **Enable** AI agents to explore and call APIs through generated code instead of massive spec files

The key innovation: Instead of sending a 150K token API specification in every prompt, agents import and use 2K tokens of generated wrapper code.

---

## Why Universal?

### The Problem
Every API type has massive specifications:
- **MCP**: Tool definitions (152K tokens)  v1
- **OpenAPI**: REST specs (200K+ tokens)  v1
- **GraphQL**: Schema introspection (100K+ tokens)  Planned

### The Solution
Convert them all to tiny TypeScript wrappers:
- **Wrappers**: ~2K tokens per source
- **Reduction**: 98% across the board
- **Format**: One consistent pattern
- **Runtime**: Single universal runtime

**Current:** MCP + REST fully implemented. **Vision:** Expand to GraphQL, databases, and more.

---

## Features

### Universal Source Support
- MCP servers (Model Context Protocol)
- REST APIs (OpenAPI/Swagger 3.x)

### Developer Experience
- Type-safe TypeScript wrappers
- IDE autocomplete for all APIs
- Consistent error handling
- Hash-based regeneration

### LLM Optimization
- 98% token reduction (validated)
- Progressive disclosure
- Clean, minimal wrappers
- Context-optimized

### Production Ready
- Connection pooling
- Automatic retries
- Timeout management
- Proper error types

---

## Architecture

```
┌─────────────────────────────┐
│   ANY API SOURCE            │
│  MCP | REST (+ more planned)│
└──────────────┬──────────────┘
               │
        ┌──────▼────────┐
        │   CODEGEN     │  (Universal Discovery + Generation)
        └──────┬────────┘
               │
        ┌──────▼────────┐
        │  TypeScript   │  (Type-safe wrappers)
        │   Wrappers    │
        └──────┬────────┘
               │
        ┌──────▼────────┐
        │  Universal    │  (One runtime for all sources)
        │   Runtime     │
        └───────────────┘
```

**See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed design.**

---

## Examples

### MCP Only
```typescript
import { call } from "./codegen/runtime";

const content = await call("filesystem__read_file", {
  path: "/tmp/example.txt"
});
```

### REST API Only
```typescript
const user = await call("github__get_user", {
  path: { username: "anthropics" }
});
```

### Universal (MCP + REST)
```typescript
// Fetch from GitHub API
const repos = await call("github__list_repos", {
  path: { username: "anthropics" }
});

// Save via MCP filesystem
await call("filesystem__write_file", {
  path: "/tmp/repos.json",
  content: JSON.stringify(repos, null, 2)
});
```

### Type-Safe
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

## Configuration

### Universal Config Format

```json
{
  "sources": {
    "mcp": {
      "server-name": {
        "type": "mcp",
        "command": "...",
        "args": ["..."]
      }
    },
    "openapi": {
      "api-name": {
        "type": "openapi",
        "spec": "https://...",
        "baseUrl": "https://...",
        "auth": {
          "type": "bearer",
          "token": "${ENV_VAR}"
        }
      }
    }
  },
  "outputDir": "./codegen",
  "runtimePackage": "codegen/runtime"
}
```

### Authentication

```json
{
  "auth": {
    "type": "bearer",
    "token": "${GITHUB_TOKEN}"
  }
}
```

Supported types:
- `bearer` - Bearer token (most APIs)
- `apikey` - API key in header or query
- `basic` - Basic auth (username/password)
- `oauth2` - OAuth 2.0 token

Environment variables are resolved automatically (`${VAR_NAME}`).

---

## CLI Commands

```bash
# Discover and generate all wrappers
mcp-codegen sync

# Generate specific source
mcp-codegen generate <source-name>

# List discovered sources
mcp-codegen list

# Initialize new project
mcp-codegen quickstart
```

---

## Comparison

### vs. Anthropic's MCP Code Mode
**Improvements:**
-  Universal (MCP + REST in v1, GraphQL planned) vs. MCP-only
-  Production infrastructure (retries, auth, instrumentation)
-  Open source and extensible
-  Same 98%+ token reduction
-  Works with existing MCP servers

**Trade-offs:**
-  No built-in sandboxing (run in trusted environments)

### vs. Cloudflare's Code Mode
**Improvements:**
-  Platform-agnostic (runs anywhere) vs. Workers-only
-  More source types (MCP + REST in v1, more planned)
-  Enterprise features (auth, retries, monitoring)
-  Open source with Apache 2.0 license

**Trade-offs:**
-  No V8 isolate sandboxing (different security model)

### vs. OpenAPI Generator
- LLM-optimized (98% token reduction)
- Multi-source (not just REST)
- Unified runtime
- They have more mature codegen features

### vs. Prisma (Databases)
- Multi-source (not just DBs)
- LLM-optimized
- They have migrations and advanced DB features

**Our Advantage:** Universal approach optimized for AI agents.

---

## Benchmarks

**Tested Token Reduction:**
- **MCP filesystem**: 1,841 → 120 tokens (**93.5%** reduction, 14 tools)
- **GitHub REST API**: 205,658 → 120 tokens (**99.94%** reduction, 1,108 tools)
- **Universal (MCP + REST)**: 2,442 → 139 tokens (**94.3%** reduction, 19 tools)
- **Average**: **95%+ reduction** across all tested sources

**Performance:**
- GitHub API (11.6MB spec): Generates 1,108 wrappers in ~30s
- Discovery: <5s for most sources
- Generation: <1s per tool
- Runtime: <50ms overhead per call

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and architecture guidelines.

---

## License

Apache 2.0 License - see [LICENSE](./LICENSE) for details.

This project includes patent protection under Apache 2.0.
See [NOTICE](./NOTICE) and [COPYRIGHT](./COPYRIGHT) for attribution requirements.

---

## Links

- **Documentation:** [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Examples:** [examples/](./examples/)
- **Issues:** [GitHub Issues](https://github.com/tyranosurasmax/MCP-CODEGEN/issues)
- **Discussions:** [GitHub Discussions](https://github.com/tyranosurasmax/MCP-CODEGEN/discussions)

---

## Acknowledgments

This project builds upon groundbreaking work by:

### Anthropic's MCP Code Mode
- **What they pioneered:** Model Context Protocol and Code Mode concept for MCP servers
- **What they proved:** Token reduction makes LLM-tool integration practical
- [Read the MCP announcement](https://www.anthropic.com/news/model-context-protocol) | [MCP Specification](https://spec.modelcontextprotocol.io/)

### Cloudflare's Code Mode
- **What they pioneered:** Code Mode on Workers platform with V8 isolate security
- **What they proved:** Code generation can replace verbose tool definitions
- [Read the Code Mode article](https://blog.cloudflare.com/cloudflare-workers-code-mode)

### Additional Inspiration
- **OpenAPI Generator** - REST API codegen patterns
- **Prisma** - Database abstraction excellence
- **The MCP Community** - Tool authors and early adopters

---

**Built with the belief that AI agents deserve infrastructure as good as the APIs they call.**

**Transform ANY API. One tool. 98% reduction. Fully typed.**

---

## Background & Motivation

This project explores a "Universal Code Mode" pattern—extending the Code Mode concept introduced by Anthropic for MCP servers to work across multiple API types (MCP, REST, and potentially GraphQL in future releases).

**What we're proposing:**
- A universal adapter pattern for multi-source API integration
- A shared `.agent-ready.json` format that others can adopt for agent tool discovery
- Production-grade infrastructure (error handling, retries, auth, instrumentation)
- Open source Apache 2.0 implementation for community collaboration

**Our goal:** Make Code Mode's token reduction benefits available across any API type, not just MCP servers, while keeping the implementation open and extensible.

The project started in November 2025 and continues to evolve based on community feedback and real-world usage.

Repository: https://github.com/tyranosurasmax/MCP-CODEGEN
