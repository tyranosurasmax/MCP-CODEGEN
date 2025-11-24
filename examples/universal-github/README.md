# Universal Example: MCP + GitHub REST API

**Copy-paste and go** example showing MCP-CODEGEN's universal runtime in action.

## What This Demonstrates

This example shows how to use **both** MCP servers and REST APIs through a single unified interface:

- **MCP Server**: `@modelcontextprotocol/server-filesystem` (read/write files)
- **REST API**: GitHub API (1,100+ tools via OpenAPI)

All callable through: `call("source__tool", params)`

## Quick Start

```bash
# Clone the repo
git clone https://github.com/tyranosurasmax/MCP-CODEGEN
cd MCP-CODEGEN/examples/universal-github

# Install dependencies
npm install

# Generate type-safe wrappers (creates ./codegen/)
npx mcp-codegen sync

# Run the demo
npm run demo
```

**That's it!** If that works, you understand the entire system.

## What Just Happened?

1. **`npx mcp-codegen sync`**:
   - Read `codegen.config.json`
   - Connected to MCP filesystem server
   - Downloaded GitHub OpenAPI spec (200K+ tokens)
   - Generated ~2K token wrappers for 1,100+ tools
   - Created `./codegen/` with type-safe functions

2. **`npm run demo`**:
   - Imported runtime: `import { call } from "@mcp-codegen/runtime"`
   - Called GitHub API: `call("github__repos_list_for_user", { ... })`
   - Called MCP tool: `call("filesystem__write_file", { ... })`
   - All with TypeScript types and error handling

## Configuration

### `codegen.config.json`

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

### Optional: GitHub Token

For higher rate limits:

```bash
export GITHUB_TOKEN="your_github_token_here"
npm run demo
```

Without a token, you get 60 requests/hour (usually enough for demos).

## Generated Code Structure

```
codegen/
├── runtime/
│   └── index.ts          # Universal runtime (call, callTyped)
├── sources/
│   ├── filesystem/       # MCP filesystem wrappers
│   └── github/           # GitHub API wrappers (1,100+ tools)
├── index.ts              # Main entry point
└── .agent-ready.json     # Manifest for AI agents
```

## Usage in Your Code

```typescript
import { call, callTyped } from "@mcp-codegen/runtime";

// Untyped (dynamic)
const repos = await call("github__repos_list_for_user", {
  path: { username: "anthropics" }
});

// Typed (compile-time safety)
interface RepoParams {
  path: { username: string };
  query?: { per_page?: number };
}
interface Repo {
  name: string;
  stargazers_count: number;
  html_url: string;
}

const repos = await callTyped<RepoParams, Repo[]>(
  "github__repos_list_for_user",
  { path: { username: "anthropics" } }
);
```

## Adding More Sources

Edit `codegen.config.json`:

```json
{
  "sources": {
    "mcp": {
      "filesystem": { /* ... */ },
      "slack": {
        "type": "mcp",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-slack"]
      }
    },
    "openapi": {
      "github": { /* ... */ },
      "stripe": {
        "type": "openapi",
        "spec": "https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json",
        "baseUrl": "https://api.stripe.com"
      }
    }
  }
}
```

Then regenerate: `npx mcp-codegen sync`

## Token Reduction

**Before MCP-CODEGEN** (sending raw specs to LLM):
- GitHub OpenAPI: 200,000+ tokens
- MCP schema: 152,000+ tokens
- **Total:** 350,000+ tokens per prompt

**After MCP-CODEGEN** (importing generated wrappers):
- Generated wrappers: ~2,000 tokens
- **Reduction:** 99.4%

## What's Next?

- **Modify `scripts/demo.ts`** to call different tools
- **Add your own APIs** to `codegen.config.json`
- **Read the main README** for advanced features
- **Check `ARCHITECTURE.md`** to understand internals

## Troubleshooting

**"Command not found: mcp-codegen"**
```bash
npm install -g @mcp-codegen/cli
# Or use npx: npx @mcp-codegen/cli sync
```

**"Cannot find module '@mcp-codegen/runtime'"**
```bash
npm install
npx mcp-codegen sync  # Generates the runtime
```

**"GitHub API rate limit"**
```bash
export GITHUB_TOKEN="ghp_..."
npm run demo
```

**"MCP server connection failed"**
- The filesystem server is spawned automatically
- Check that Node.js 18+ is installed
- Try: `npx @modelcontextprotocol/server-filesystem /tmp` manually

## License

Apache 2.0 - Same as main project
