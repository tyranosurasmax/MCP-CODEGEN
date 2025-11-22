# MCP-CODEGEN

**"Activate Code Mode. Automatically."**

Transform any collection of MCP servers into a TypeScript tool filesystem with a shared runtime. This allows LLM agents to operate in Code Mode instead of relying on prompt-based tool calling.

**🚀 98% token reduction** | **🔒 Type-safe** | **⚡ Fast** | **🛠️ Production-ready**

---

## What is Code Mode?

Code Mode is a paradigm shift in how AI agents interact with tools:

- **Traditional approach**: Send all tool definitions to the LLM in every prompt (thousands of tokens)
- **Code Mode**: Generate TypeScript wrappers that agents can import and use like regular functions

**Benefits:**
- 98% reduction in token usage (same as Anthropic's implementation)
- Familiar programming patterns (loops, conditionals, error handling)
- Type safety and IDE autocomplete
- Cleaner, more maintainable agent workflows

---

## Quick Start

```bash
# Install
npm install -g mcp-codegen

# Initialize project with your MCP servers
npx mcp-codegen quickstart

# Use in your code
import { callMCPTool } from "./mcp/runtime";

const result = await callMCPTool("server-name__tool-name", { param: "value" });
```

---

## Table of Contents
- [Installation](#installation)
- [Usage](#usage)
- [Architecture](#architecture)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Roadmap](#roadmap)
- [Contributing](#contributing)

---

## Installation

```bash
npm install -g mcp-codegen
```

Or use npx:

```bash
npx mcp-codegen quickstart
```

---

## Usage

### 1. Discover and Generate

```bash
# Discover all MCP servers and generate wrappers
mcp-codegen sync

# Generate wrappers for specific server
mcp-codegen generate <server-name>

# List discovered servers
mcp-codegen list
```

### 2. Use Generated Wrappers

The generated code can be used in two ways:

**Option A: Direct runtime calls**
```typescript
import { callMCPTool } from "./mcp/runtime";

const result = await callMCPTool("filesystem__read-file", {
  path: "/path/to/file.txt"
});
```

**Option B: Typed wrapper imports** (coming soon)
```typescript
import { filesystem } from "./mcp/servers/filesystem";

const result = await filesystem.readFile({
  path: "/path/to/file.txt"
});
```

### 3. Agent Integration

Agents can check for Code Mode support:

```typescript
import * as fs from 'fs';

const manifest = JSON.parse(fs.readFileSync('.agent-ready.json', 'utf-8'));

if (manifest.codeMode) {
  // Use Code Mode!
  // Import from manifest.wrapperRoot
}
```

---

## Architecture

### Overview

```
┌─────────────────┐
│  MCP Servers    │  (Your existing servers)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Discovery      │  (Auto-detect from configs)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Code Generator │  (JSON Schema → TypeScript)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Runtime        │  (Connection pooling, error handling)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Agent/App      │  (Your code)
└─────────────────┘
```

---

# Directory Structure

After running `mcp-codegen sync` or `quickstart`, the project will contain:

```
mcp/
  runtime/
    index.ts
  servers/
    <server-name>/
      <tool-name>.ts
      index.ts
  BENCHMARK.md
  benchmark.json
mcp/server-map.json
.agent-ready.json
tsconfig.json
example.ts
agent-harness.example.ts
```

Each wrapper is typed, deterministic, stable, and minimal.

---

# Server Discovery

Discovery sources are checked in the following priority order:

1. `mcp-codegen.json`
2. User MCP configs located at `~/.config/mcp/*.json`
3. Claude Desktop configurations
4. System or global configurations (platform dependent)

You can override detection manually using:

```
mcp-codegen sync --server path/to/config.json
```

All discovered servers are written to `server-map.json`.

---

# JSON Schema to TypeScript Rules

Supported features:

- Primitive types such as string, number, integer, boolean, and null
- Union types
- Arrays
- Objects with required or optional fields
- Enumerations
- `anyOf`, `oneOf`, and `allOf` (best effort)

Fallback rules:

- If a tool has no parameter schema, it becomes `Record<string, unknown>`
- If a tool has no return schema, it becomes `unknown`
- If a schema is too complex to map safely, it becomes `unknown` and a warning is logged

The rules are designed so that generation always succeeds.

---

# Runtime

## Public API
```ts
export async function callMCPTool(toolName: string, params?: any): Promise<any>;
export async function callMCPToolTyped<P, R>(toolName: string, params: P): Promise<R>;
export async function getClient(serverName?: string): Promise<MCPClient>;
```

## Responsibilities
The runtime is responsible for:

- Loading `server-map.json`
- Maintaining one persistent child process per MCP server
- Restarting failed servers with two retry attempts
- Enforcing timeouts (default is 60 seconds)
- Normalizing all errors
- Routing messages according to the MCP protocol

Streaming responses are buffered in this MVP version.

## Error Types
- `MCPConnectionError`
- `MCPValidationError`
- `MCPToolError`
- `MCPTimeoutError`

---

# Wrapper Generation

Every generated wrapper follows this structure:

```ts
// AUTO-GENERATED BY mcp-codegen v1.0.1
// DO NOT EDIT BELOW THIS LINE
// hash: <tool-spec-hash>

import { callMCPToolTyped } from "@mcp-codegen/runtime";

export interface Params { ... }
export interface Result { ... }

export const toolMeta = {
  server: "<server-name>",
  name: "<tool-name>",
  description: "<description>"
};

export async function <toolName>(params: Params): Promise<Result> {
  return callMCPToolTyped<Params, Result>("<server-name>__<tool-name>", params);
}

// END AUTO-GENERATED

/* USER-EDITABLE AREA BELOW */
```

Regeneration behavior:

- Only the auto-generated section is replaced if the hash changes
- Everything after `END AUTO-GENERATED` is preserved

Per-server index files follow this pattern:

```
export * as getDocument from "./getDocument";
```

---

# Manifest (.agent-ready.json)

Generated manifest:

```json
{
  "codeMode": true,
  "language": "typescript",
  "wrapperRoot": "./mcp",
  "runtimePackage": "@mcp-codegen/runtime",
  "version": "1.0.1"
}
```

This defines the contract that agent hosts rely on in order to activate Code Mode.

---

# Benchmarks

`mcp/benchmark.json` contains raw token savings data:

```json
{
  "rawToolsTokens": 152880,
  "wrapperTokens": 1980,
  "reductionPercentage": 98.70,
  "estimationMethod": "chars/4",
  "timestamp": "..."
}
```

`mcp/BENCHMARK.md` provides a human-readable explanation.

---

# Commands

```
mcp-codegen sync
mcp-codegen generate <server>
mcp-codegen list
npx mcp-codegen quickstart
```

`quickstart` generates the following:

- All tool wrappers
- Runtime files
- Server map
- Manifest
- TypeScript config
- Benchmark files
- Example files

---

# Roadmap

## v1.1
- Python wrapper generation
- Watch mode
- Mock mode
- Meta-server support
- Composition helper utilities

## v1.2
- Intelligent tool composition
- Parity across Python, JavaScript, and TypeScript

## v2
- Schema evolution tracking
- Web user interface
- Workflow graph visualization

## v3
- OpenAPI, REST, and GraphQL to Code Mode
- Database schema integration

## v4
- Autonomous optimization
- Predictive synthesis
