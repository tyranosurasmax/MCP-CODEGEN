# Setup Guide for Claude Code Integration

## Installation

### Option 1: Install from GitHub (Current)
```bash
git clone https://github.com/tyranosurasmax/MCP-CODEGEN.git
cd MCP-CODEGEN
npm install
npm run build
npm link  # Makes 'mcp-codegen' available globally
```

### Option 2: Install from npm (When Published)
```bash
npm install -g mcp-codegen
```

## Quick Start

### 1. Create Your Project Directory
```bash
mkdir my-ai-project
cd my-ai-project
```

### 2. Initialize Universal Code Mode
```bash
mcp-codegen quickstart
```

This creates:
- `codegen/` - Type-safe wrappers
- `codegen/runtime/` - Universal runtime
- `.agent-ready.json` - Discovery signal for AI agents
- `codegen.config.json` - Your configuration

### 3. Customize Your Configuration

Edit `codegen.config.json` to add your API sources:

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
mcp-codegen quickstart  # Regenerates with your config
```

## Using with Claude Code

### Discovery
Claude Code will automatically discover your API wrappers through `.agent-ready.json`:

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

### Usage in Your Code

```typescript
import { call } from "./codegen/runtime";

// Claude Code can now use these functions directly:

// Read local file via MCP
const data = await call("filesystem__read_file", {
  path: "/tmp/data.json"
});

// Fetch from GitHub API
const repos = await call("github__list_repos", {
  path: { username: "anthropics" }
});

// Write results back
await call("filesystem__write_file", {
  path: "/tmp/repos.json",
  content: JSON.stringify(repos, null, 2)
});
```

## Real-World Example

### Scenario: Automated Repo Analysis

1. **Configure Sources**
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

2. **Generate Wrappers**
```bash
export GITHUB_TOKEN="your_token_here"
mcp-codegen quickstart
```

3. **Use in Claude Code**
```typescript
// Claude Code can now:
// 1. Fetch repos from GitHub
// 2. Analyze code structure
// 3. Save reports to local filesystem
// All with 99%+ token reduction!

import { call } from "./codegen/runtime";

async function analyzeOrg(org: string) {
  // Fetch all repos
  const repos = await call("github__list_repos", {
    path: { org }
  });

  // Analyze each repo
  const analysis = await Promise.all(
    repos.map(async (repo) => {
      const readme = await call("github__get_readme", {
        path: { owner: org, repo: repo.name }
      });

      return {
        name: repo.name,
        stars: repo.stargazers_count,
        hasReadme: !!readme
      };
    })
  );

  // Save results
  await call("filesystem__write_file", {
    path: `/tmp/${org}-analysis.json`,
    content: JSON.stringify(analysis, null, 2)
  });

  return analysis;
}
```

## Verification

### Check Installation
```bash
mcp-codegen --version
# Should output: 1.1.0
```

### Check Generated Files
```bash
ls codegen/
# Should see: mcp/, openapi/, runtime/, example.ts, BENCHMARK.md

cat .agent-ready.json
# Should see discovery manifest with your sources
```

### Test Generated Code
```bash
# Install TypeScript execution
npm install -g tsx

# Run the example
tsx codegen/example.ts
```

## Token Reduction Benefits

### Without Code Mode
Claude Code receives:
```json
{
  "tools": [
    {
      "name": "github__list_repos",
      "description": "...",
      "inputSchema": { /* 500+ lines */ },
      "outputSchema": { /* 800+ lines */ }
    },
    // ... 1,107 more tools ...
  ]
}
```
**Total: ~205,000 tokens per request**

### With Code Mode
Claude Code receives:
```typescript
import { call } from "./codegen/runtime";
// Available tools in .agent-ready.json
```
**Total: ~139 tokens per request**

**Savings: 99.93% = $0.62 per session**

## Troubleshooting

### MCP Server Connection Issues
If you see "Failed to discover tools from [server]":
1. Check the MCP server is installed: `npx -y @modelcontextprotocol/server-filesystem /tmp`
2. Verify permissions for the directory
3. Check logs in the console output

### OpenAPI Spec Loading Issues
If REST API generation fails:
1. Verify the spec URL is accessible
2. Check auth credentials are set (use `${ENV_VAR}` format)
3. Try downloading the spec locally first

### Generated Code Not Working
1. Ensure `npm install` was run in the project
2. Verify `codegen/runtime/index.ts` exists
3. Check TypeScript is installed: `npm install -D typescript`

## Next Steps

1. **Add More Sources**: Edit `codegen.config.json`
2. **Regenerate**: Run `mcp-codegen quickstart`
3. **Use with Claude Code**: Open your project in Claude Code
4. **Monitor Savings**: Check `codegen/BENCHMARK.md`

## Advanced Configuration

### Custom Output Directory
```json
{
  "outputDir": "./generated-api",
  "runtimePackage": "generated-api/runtime"
}
```

### Multiple REST APIs
```json
{
  "sources": {
    "openapi": {
      "github": { "type": "openapi", "spec": "..." },
      "stripe": { "type": "openapi", "spec": "..." },
      "twilio": { "type": "openapi", "spec": "..." }
    }
  }
}
```

### Environment-Specific Config
```bash
# Development
mcp-codegen quickstart --config codegen.dev.json

# Production
mcp-codegen quickstart --config codegen.prod.json
```

## Support

- **Issues**: https://github.com/tyranosurasmax/MCP-CODEGEN/issues
- **Discussions**: https://github.com/tyranosurasmax/MCP-CODEGEN/discussions
- **Examples**: See `examples/` directory
