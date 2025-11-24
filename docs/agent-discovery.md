# Agent Discovery with .agent-ready.json

## The Problem

When LLM agents need to discover what tools are available in a codebase, they face several challenges:
1. No standard way to list available tools
2. Must read entire directory structures
3. Can't determine tool schemas without reading implementation
4. No metadata about tool capabilities

## The Solution: .agent-ready.json

MCP-CODEGEN proposes a standardized discovery format that agents can read to understand available tools.

### Format Specification

```json
{
  "version": "1.0",
  "generated_at": "2025-11-24T12:00:00Z",
  "sources": {
    "total": 2,
    "mcp": 1,
    "openapi": 1
  },
  "tools": {
    "total": 1122,
    "by_source": {
      "filesystem": 14,
      "github": 1108
    }
  },
  "runtime": {
    "package": "@mcp-codegen/runtime",
    "version": "1.1.0",
    "functions": ["call", "callTyped"]
  },
  "manifest": {
    "tools": [
      {
        "name": "filesystem__read_file",
        "source": "filesystem",
        "type": "mcp",
        "description": "Read a file from the filesystem",
        "path": "./codegen/filesystem/read_file.ts"
      },
      {
        "name": "github__repos_list_for_user",
        "source": "github",
        "type": "openapi",
        "description": "List repositories for a user",
        "path": "./codegen/github/repos_list_for_user.ts"
      }
    ]
  }
}
```

### Benefits for Agents

1. **Fast Discovery**: Read one JSON file instead of scanning directories
2. **Tool Metadata**: Understand tool capabilities without reading implementations
3. **Source Information**: Know which API each tool comes from
4. **Type Information**: Access schemas and parameters
5. **Token Efficient**: Compact representation of all available tools

### How MCP-CODEGEN Generates It

After running `mcp-codegen sync`, the tool automatically generates `.agent-ready.json` in your output directory:

```bash
mcp-codegen sync
# Generates: ./codegen/.agent-ready.json
```

### Agent Usage Pattern

```typescript
// 1. Agent reads .agent-ready.json
const manifest = JSON.parse(
  await fs.readFile('./codegen/.agent-ready.json', 'utf-8')
);

// 2. Agent discovers available tools
console.log(`Found ${manifest.tools.total} tools from ${manifest.sources.total} sources`);

// 3. Agent can search for specific capabilities
const fileTools = manifest.manifest.tools.filter(t =>
  t.description.includes('file')
);

// 4. Agent imports and uses the tool
import { call } from "@mcp-codegen/runtime";
const result = await call("filesystem__read_file", { path: "/tmp/data.json" });
```

## Progressive Disclosure

The `.agent-ready.json` file enables a progressive disclosure pattern:

1. **Discovery**: Agent reads manifest (small, <100KB even for 1000+ tools)
2. **Selection**: Agent decides which tools are relevant
3. **Deep Dive**: Agent reads only the specific tool files it needs
4. **Execution**: Agent calls tools via runtime

This keeps token usage minimal while maintaining full type safety and discoverability.

## Adoption

This format is a proposal that others can adopt. It's not a standard (yet), but we're using it in production and it works well.

**If you're building similar tools**, feel free to:
- Generate compatible `.agent-ready.json` files
- Extend the format for your use case
- Propose improvements via GitHub issues

The goal is to make agent tool discovery easier across the ecosystem.

## Related Work

- **Anthropic MCP**: Uses JSON-RPC for tool listing (runtime protocol)
- **OpenAPI**: Uses OpenAPI specs for API documentation (human-focused)
- **Prisma**: Uses `schema.prisma` for database schema (database-specific)

`.agent-ready.json` is designed specifically for LLM agents to discover generated code.
