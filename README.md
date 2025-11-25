# MCP-CODEGEN

**Universal, Model-Agnostic Tool Compiler for LLM Agents**

![Status](https://img.shields.io/badge/status-active%20development-orange)
![Version](https://img.shields.io/badge/version-1.1.0-blue)
![License](https://img.shields.io/badge/license-Apache%202.0-green)

> **ACTIVE DEVELOPMENT**: This project is under active development. See commit history for latest updates.

---

## 🌐 Works With Any LLM Provider

**Generate once. Use with Claude, GPT-4, Gemini, Llama, Ollama, or any other model.**

Ahead-of-time compilation approach — no runtime API dependencies, no vendor lock-in.

**API Coverage:**
- ✅ **OpenAPI/REST** (Production - 1,100+ tools from GitHub API alone)
- ✅ **MCP Servers** (Production - Compatible with Anthropic's MCP ecosystem)
- 🔄 **GraphQL** (Planned - GitHub GraphQL, Shopify, Hasura)

---

## What is this?

**A universal tool compiler that generates type-safe TypeScript wrappers for ANY API that work with ANY LLM.**

Instead of sending massive API specifications (150K+ tokens) to your LLM in every prompt, compile them once into tiny wrapper code (2K tokens). The same generated wrappers work with Claude, GPT-4, Gemini, or local models.

**The approach:**
- **Ahead-of-time compilation** (like Prisma for databases)
- **Not runtime interpretation** (like Anthropic's Tool Search)
- **Model-agnostic** (works with any LLM provider)
- **Zero runtime overhead** (no API calls, no dependencies)

**The result:** 98% fewer tokens, works anywhere, full type safety.

---

## Who should use this?

### Ideal for:
- **Multi-model teams** using Claude + GPT-4 + Gemini + local models
- **Self-hosted AI** running Ollama, Llama, or other local models
- **Teams with OpenAPI specs** who want LLM-optimized wrappers
- **Avoiding vendor lock-in** - same wrappers work with any provider
- **Hitting token limits** or paying high costs to send specs repeatedly
- **Need deterministic builds** - compile once, version control, audit

### Not ideal for:
- **Claude-only workflows** using Anthropic's MCP exclusively → [Anthropic Tool Search](https://www.anthropic.com/engineering/advanced-tool-use) may be simpler
- **Just want a REST SDK** for human developers → use [OpenAPI Generator](https://openapi-generator.tech/)
- **Don't control agent code** → need runtime protocol integration instead
- **Only need one or two API calls** → overhead not worth it

---

## Quick Start

### 30-Second Demo

Want to see it working right now?

```bash
git clone https://github.com/tyranosurasmax/MCP-CODEGEN
cd MCP-CODEGEN/examples/universal-github
npm install
npx mcp-codegen sync
npm run demo
```

This demo:
- Calls GitHub REST API (1,100+ tools)
- Calls MCP filesystem server
- Shows universal `call()` interface
- Proves 99.94% token reduction

See [`examples/universal-github/README.md`](examples/universal-github/README.md) for details.

---

### Install and Use

**1. Install globally:**
```bash
npm install -g @mcp-codegen/cli
```

**2. Create config** (`codegen.config.json`):
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
  },
  "outputDir": "./codegen",
  "runtimePackage": "@mcp-codegen/runtime"
}
```

**3. Generate wrappers:**
```bash
mcp-codegen sync
```

**4. Use in your code:**
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

// Chain them together
await call("filesystem__write_file", {
  path: "/tmp/anthropic-repos.json",
  content: JSON.stringify(repos, null, 2)
});
```

**Result:** 98% token reduction. One runtime. Universal.

---

## Configuration

### Supported Sources

| Source Type | Status | Use Case |
|-------------|--------|----------|
| **MCP Servers** | Production | Claude Desktop tools, local services |
| **REST APIs** | Production | GitHub, Stripe, any OpenAPI spec |
| **GraphQL APIs** | Planned | GitHub GraphQL, Shopify, Hasura |
| **Databases** | Planned | Prisma-style introspection |

**v1 Scope:** MCP + OpenAPI REST. Both adapters are production-ready.

### Authentication

```json
{
  "sources": {
    "openapi": {
      "github": {
        "type": "openapi",
        "spec": "https://...",
        "baseUrl": "https://api.github.com",
        "auth": {
          "type": "bearer",
          "token": "${GITHUB_TOKEN}"
        }
      }
    }
  }
}
```

Supported auth types: `bearer`, `apikey`, `basic`, `oauth2`

Environment variables are resolved automatically (`${VAR_NAME}`).

---

## Features

- **Model-Agnostic**: Works with Claude, GPT-4, Gemini, Llama, Ollama, any LLM
- **Universal APIs**: OpenAPI/REST + MCP servers (GraphQL planned)
- **98% Token Reduction**: Validated across multiple API types ([benchmarks](docs/benchmarks.md))
- **Ahead-of-Time Compilation**: Generate once, use everywhere, zero runtime overhead
- **Type-Safe**: Full TypeScript support with IDE autocomplete
- **Production-Safe**: Sane defaults for retries, auth, and error handling
- **Self-Hosted Friendly**: No external API dependencies, works offline
- **Open Source**: Apache 2.0 licensed, extensible architecture

---

## Documentation

- **[Runtime Contract](./RUNTIME_CONTRACT.md)** - Stable API specification (semver-sensitive)
- **[Architecture](./ARCHITECTURE.md)** - System design and adapter patterns
- **[Benchmarks](docs/benchmarks.md)** - Token reduction validation and performance metrics
- **[Comparisons](docs/comparisons.md)** - vs. Anthropic, Cloudflare, OpenAPI Generator, Prisma
- **[Agent Discovery](docs/agent-discovery.md)** - `.agent-ready.json` format specification
- **[Contributing](./CONTRIBUTING.md)** - Development setup and guidelines
- **[Examples](./examples/)** - Working examples and demos

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

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and architecture guidelines.

---

## License

Apache 2.0 License - see [LICENSE](./LICENSE) for details.

This project includes patent protection under Apache 2.0.
See [NOTICE](./NOTICE) and [COPYRIGHT](./COPYRIGHT) for attribution requirements.

---

## Links

- **Repository:** https://github.com/tyranosurasmax/MCP-CODEGEN
- **Issues:** [GitHub Issues](https://github.com/tyranosurasmax/MCP-CODEGEN/issues)
- **Discussions:** [GitHub Discussions](https://github.com/tyranosurasmax/MCP-CODEGEN/discussions)

---

## Acknowledgments

This project builds upon groundbreaking work by:

### Anthropic's MCP Code Mode
- Pioneered Model Context Protocol and Code Mode concept for MCP servers
- Proved that token reduction makes LLM-tool integration practical
- [Read the announcement](https://www.anthropic.com/news/model-context-protocol) | [MCP Specification](https://spec.modelcontextprotocol.io/)

### Cloudflare's Code Mode
- Pioneered Code Mode on Workers platform with V8 isolate security
- Proved that code generation can replace verbose tool definitions
- [Read the article](https://blog.cloudflare.com/cloudflare-workers-code-mode)

### Additional Inspiration
- **OpenAPI Generator** - REST API codegen patterns
- **Prisma** - Database abstraction excellence
- **The MCP Community** - Tool authors and early adopters

---

## Background & Motivation

This project explores a "Universal Code Mode" pattern—extending the Code Mode concept introduced by Anthropic for MCP servers to work across multiple API types.

**What we're proposing:**
- A universal adapter pattern for multi-source API integration
- A shared `.agent-ready.json` format that others could adopt for agent tool discovery
- Production-safe defaults (error handling, retries, auth)
- Open source Apache 2.0 implementation for community collaboration

**Our goal:** Make Code Mode's token reduction benefits available across multiple API types, while keeping the implementation open and extensible.

Started November 2025, evolving based on community feedback and real-world usage.

---

**Built with the belief that AI agents deserve infrastructure as good as the APIs they call.**
