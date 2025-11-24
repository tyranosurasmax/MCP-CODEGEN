# MCP-CODEGEN Examples

Complete, runnable examples demonstrating MCP-CODEGEN in action.

##  Available Examples

### [universal-github](./universal-github/) - **START HERE**

**Copy-paste and go** example showing MCP + REST API in one project.

```bash
cd examples/universal-github
npm install
npx mcp-codegen sync
npm run demo
```

**What it demonstrates:**
-  MCP server integration (filesystem)
-  REST API integration (GitHub - 1,100+ tools)
-  Universal `call()` interface
-  99.4% token reduction
-  TypeScript type safety
-  Error handling
-  Authentication (optional GitHub token)

**If this works, you understand the entire system.**

---

## Coming Soon

More examples will be added:

- **mcp-only** - Pure MCP server integration (no REST)
- **rest-multi** - Multiple REST APIs (Stripe + Slack + GitHub)
- **graphql-demo** - GraphQL API integration (when v1 ready)
- **agent-integration** - Using with Claude Code / OpenAI agents
- **custom-adapter** - Building your own source adapter

## Structure

Each example follows this pattern:

```
example-name/
├── codegen.config.json    # Source configuration
├── scripts/
│   └── demo.ts           # Runnable demo
├── package.json          # Dependencies & scripts
├── README.md             # Example-specific docs
└── .gitignore
```

## Running Examples

All examples use the same workflow:

```bash
cd examples/<example-name>
npm install              # Install dependencies
npx mcp-codegen sync    # Generate wrappers
npm run demo            # Run the demo
```

## Requirements

- **Node.js**: 18.0.0 or higher
- **npm**: 7.0.0 or higher
- **mcp-codegen**: Install globally with `npm install -g @mcp-codegen/cli`

## License

All examples are Apache 2.0 licensed (same as main project).
