# Testing Guide - Verify Installation

This guide helps you verify that mcp-codegen works correctly on your machine, especially with Claude Code.

## Prerequisites

- Node.js 18 or higher
- npm or yarn
- Git

## Quick Verification

### Step 1: Clone and Build

```bash
# Clone the repository
git clone https://github.com/tyranosurasmax/MCP-CODEGEN.git
cd MCP-CODEGEN

# Install dependencies
npm install

# Build the project
npm run build

# Verify build succeeded
ls dist/cli.js dist/index.js
```

### Step 2: Test Quickstart

```bash
# Clean any existing generated files
rm -rf .agent-ready.json codegen/

# Run quickstart
node dist/cli.js quickstart

# Verify files were created
ls .agent-ready.json
ls codegen/runtime/index.ts
ls codegen/mcp/filesystem/
ls codegen/openapi/demoapi/
```

**Expected Output:**
```
=== CODE MODE ACTIVATED ===

Sources Discovered:
  MCP Servers: filesystem
  REST APIs: demoapi
  Total: 2 sources

Tools Generated:
  19 TypeScript functions
    filesystem: 14 tools
    demoapi: 5 tools

Token Reduction:
  Traditional: 2,442 tokens
  Code Mode: 139 tokens
  Reduction: 94.3%
```

### Step 3: Verify Discovery Signal

```bash
cat .agent-ready.json
```

**Expected Output:**
```json
{
  "codeMode": true,
  "version": "1.1.0",
  "sources": {
    "mcp": ["filesystem"],
    "openapi": ["demoapi"],
    "total": 2
  },
  "tools": {
    "total": 19,
    "bySource": {
      "filesystem": 14,
      "demoapi": 5
    }
  },
  "tokenReduction": {
    "traditional": 2442,
    "codeMode": 139,
    "reduction": 0.9431,
    "savings": "94.3%"
  }
}
```

### Step 4: Verify Generated Wrappers

```bash
# Check MCP filesystem wrapper
cat codegen/mcp/filesystem/read_file.ts

# Check REST API wrapper
cat codegen/openapi/demoapi/getUser.ts

# Check runtime
cat codegen/runtime/index.ts
```

Each wrapper should have:
- TypeScript interfaces for params and results
- `toolMeta` object with server, name, description
- Typed function that calls the runtime

### Step 5: Test with Real GitHub API (Optional)

```bash
# Create test config with real GitHub API
cat > test-github.json << 'EOF'
{
  "sources": {
    "openapi": {
      "github": {
        "type": "openapi",
        "spec": "https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json",
        "baseUrl": "https://api.github.com"
      }
    }
  },
  "outputDir": "./test-codegen"
}
EOF

# Generate wrappers
rm -rf test-codegen
node dist/cli.js quickstart --config test-github.json

# Check results
ls test-codegen/openapi/github/ | wc -l
# Should show ~1,100 files
```

**Expected:** ~1,108 tools generated, 99.94% token reduction

## Claude Code Integration Test

### Step 1: Install Globally (Optional)

```bash
# Make mcp-codegen available globally
npm link

# Verify global installation
which mcp-codegen
mcp-codegen --version
```

### Step 2: Create Test Project

```bash
# Create new directory
mkdir ~/mcp-test-project
cd ~/mcp-test-project

# Copy example config
cp /path/to/MCP-CODEGEN/examples/claude-code-integration/codegen.config.json .

# Generate wrappers
mcp-codegen quickstart

# Verify discovery signal
cat .agent-ready.json
```

### Step 3: Test with Claude Code

1. Open Claude Code (web or desktop)
2. Open your test project: `~/mcp-test-project`
3. Claude Code should automatically detect `.agent-ready.json`
4. Ask Claude Code: "Can you see the API wrappers?"
5. Ask Claude Code: "Create a script that lists files in /tmp using the filesystem wrapper"

**Expected:** Claude Code should be able to import and use the wrappers.

### Step 4: Verify Claude Code Can Use Wrappers

Ask Claude Code to create this file:

```typescript
import { call } from "./codegen/runtime";

async function test() {
  // List files in /tmp
  const files = await call("filesystem__list_directory", {
    path: "/tmp"
  });
  console.log("Files:", files);
}

test().catch(console.error);
```

Then ask Claude Code to run it:
```bash
npx tsx test.ts
```

**Expected:** Should list files in /tmp directory.

## Common Issues

### Issue: "Cannot find module 'codegen/runtime'"

**Solution:**
```bash
# Ensure runtime was generated
ls codegen/runtime/index.ts

# If missing, regenerate
node dist/cli.js quickstart
```

### Issue: "MCP server connection failed"

**Solution:**
```bash
# Test MCP server directly
npx -y @modelcontextprotocol/server-filesystem /tmp

# Should output JSON-RPC messages
# Press Ctrl+C to stop

# If it fails, check Node.js version
node --version  # Should be 18+
```

### Issue: "0 tools generated"

**Cause:** MCP server not responding or REST API spec unreachable

**Solution:**
```bash
# Check MCP server
npx -y @modelcontextprotocol/server-filesystem /tmp

# Check REST API spec
curl -I https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json

# Check logs for specific errors
node dist/cli.js quickstart 2>&1 | grep -i error
```

### Issue: Claude Code doesn't see wrappers

**Solution:**
1. Verify `.agent-ready.json` exists in project root
2. Check file contains `"codeMode": true`
3. Ensure `paths.runtime` points to correct location
4. Restart Claude Code

## Success Criteria

You've successfully verified mcp-codegen if:

✅ Build completes without errors
✅ Quickstart generates files
✅ `.agent-ready.json` shows correct token reduction
✅ Generated wrappers have proper TypeScript types
✅ Claude Code can discover and use the wrappers
✅ Runtime can execute tool calls

## Performance Benchmarks

Expected performance on modern hardware:

| Operation | Expected Time |
|-----------|--------------|
| Build | <10s |
| MCP Discovery | <5s |
| GitHub API Discovery | 5-10s |
| Generate 19 tools | <5s |
| Generate 1,108 tools | 20-40s |

If significantly slower, check:
- Network connection (for OpenAPI specs)
- Disk speed (for file generation)
- CPU usage (other processes)

## Next Steps

After successful verification:

1. Read `SETUP.md` for detailed usage instructions
2. Check `examples/claude-code-integration/` for practical examples
3. Read `ARCHITECTURE.md` to understand the design
4. Add your own API sources to `codegen.config.json`

## Getting Help

If tests fail:

1. Check this guide's Common Issues section
2. Review logs: `node dist/cli.js quickstart 2>&1 | tee debug.log`
3. File an issue: https://github.com/tyranosurasmax/MCP-CODEGEN/issues
4. Include:
   - Output from `node --version` and `npm --version`
   - Contents of `.agent-ready.json`
   - Full error logs

## Clean Up Test Files

```bash
# Remove test files
rm -rf test-codegen test-github.json
cd ~/mcp-test-project && rm -rf codegen .agent-ready.json

# Unlink global installation (if you ran npm link)
npm unlink mcp-codegen
```
