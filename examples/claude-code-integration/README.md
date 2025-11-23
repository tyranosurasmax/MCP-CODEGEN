# Claude Code Integration Example

This example shows how to set up mcp-codegen for use with Claude Code.

## What This Demonstrates

Claude Code can automatically discover and use your API wrappers through the `.agent-ready.json` discovery signal. This means Claude gets access to thousands of API endpoints with 98% fewer tokens.

## Setup

### 1. Install mcp-codegen

```bash
npm install -g mcp-codegen
```

### 2. Create Your Project

```bash
mkdir my-project
cd my-project
```

### 3. Create Configuration

Copy the `codegen.config.json` from this directory or create your own:

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
  },
  "outputDir": "./codegen"
}
```

### 4. Generate Wrappers

```bash
export GITHUB_TOKEN="your_github_token"
mcp-codegen quickstart
```

This creates:
- `codegen/` - Type-safe wrappers (1,100+ functions)
- `.agent-ready.json` - Discovery signal for Claude Code

### 5. Use with Claude Code

Open Claude Code in your project directory. Claude will automatically discover the `.agent-ready.json` file.

Now you can write code like:

```typescript
import { call } from "./codegen/runtime";

// Claude Code can now use these directly:

// Fetch GitHub repos
const repos = await call("github__list_repos", {
  path: { username: "anthropics" }
});

// Save to file
await call("filesystem__write_file", {
  path: "/tmp/repos.json",
  content: JSON.stringify(repos, null, 2)
});
```

## How Claude Code Uses This

### Traditional Approach (Without Code Mode)
```
User: "Fetch repos from GitHub and save to file"

Claude receives in every prompt:
- 1,108 tool definitions (205,658 tokens)
- Full JSON schemas for every endpoint
- Authentication details
- Request/response examples

Total: ~205KB of API specs per request
```

### With Code Mode (Using mcp-codegen)
```
User: "Fetch repos from GitHub and save to file"

Claude receives once:
- .agent-ready.json (139 tokens)
- Can explore codegen/ directory as needed
- Imports functions like normal TypeScript

Total: ~139 tokens per request
Reduction: 99.93%
```

## What Gets Generated

```
my-project/
├── .agent-ready.json         # Discovery signal (139 tokens)
├── codegen/
│   ├── runtime/              # Universal runtime
│   │   └── index.ts
│   ├── mcp/                  # MCP wrappers
│   │   └── filesystem/
│   │       ├── read_file.ts
│   │       ├── write_file.ts
│   │       └── ... 12 more
│   └── openapi/              # REST API wrappers
│       └── github/
│           ├── list_repos.ts
│           ├── get_user.ts
│           └── ... 1,106 more
└── codegen.config.json       # Your configuration
```

## Example Task for Claude Code

Try asking Claude Code:

> "Analyze the top 10 most starred repositories from the 'anthropics' GitHub organization and save a summary report to /tmp/anthropic-analysis.json"

Claude Code will:
1. Discover your API wrappers via `.agent-ready.json`
2. Import the runtime: `import { call } from "./codegen/runtime"`
3. Fetch repos: `call("github__list_repos", {...})`
4. Analyze the data
5. Save results: `call("filesystem__write_file", {...})`

All with 99.93% fewer tokens than traditional MCP tool usage.

## Verification

### Check Discovery Signal

```bash
cat .agent-ready.json
```

Should show:
```json
{
  "codeMode": true,
  "version": "1.1.0",
  "sources": {
    "mcp": ["filesystem"],
    "openapi": ["github"],
    "total": 2
  },
  "tools": {
    "total": 1122,
    "bySource": {
      "filesystem": 14,
      "github": 1108
    }
  },
  "tokenReduction": {
    "traditional": 207499,
    "codeMode": 139,
    "reduction": 0.9993,
    "savings": "99.93%"
  }
}
```

### Test Generated Code

```bash
npm install -D tsx typescript @types/node
tsx usage-example.ts
```

## Troubleshooting

### Claude Code Doesn't Discover Wrappers

1. Ensure `.agent-ready.json` exists in project root
2. Check file contains `"codeMode": true`
3. Verify `paths.runtime` points to correct location

### Generated Functions Don't Work

1. Install dependencies: `npm install`
2. Check TypeScript is installed: `npm install -D typescript`
3. Verify runtime exists: `ls codegen/runtime/index.ts`

### MCP Server Connection Fails

1. Test MCP server directly:
   ```bash
   npx -y @modelcontextprotocol/server-filesystem /tmp
   ```
2. Check server permissions for the directory
3. Verify `command` and `args` in config are correct

### REST API Calls Fail

1. Verify auth token is set: `echo $GITHUB_TOKEN`
2. Check API spec URL is accessible
3. Test with a simple curl request first

## Benefits

- **99.93% token reduction** - From 205K to 139 tokens
- **Type-safe** - Full TypeScript support with autocomplete
- **Universal** - Works with MCP, REST, GraphQL, databases
- **Production-ready** - Connection pooling, retries, timeouts
- **One runtime** - Same `call()` function for all sources

## Next Steps

1. Add more API sources to `codegen.config.json`
2. Regenerate: `mcp-codegen quickstart`
3. Use with Claude Code
4. Monitor savings: `cat codegen/BENCHMARK.md`

## Support

- Issues: https://github.com/tyranosurasmax/MCP-CODEGEN/issues
- Full docs: See main README.md and SETUP.md
