# Contributing to MCP-CODEGEN

Thank you for your interest in contributing! This project provides universal code generation for API integrations, transforming any API into type-safe TypeScript wrappers with 98% token reduction.

## Development Setup

```bash
# Clone the repo
git clone https://github.com/tyranosurasmax/MCP-CODEGEN.git
cd MCP-CODEGEN

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Link for local testing
npm link
```

## Project Structure

```
MCP-CODEGEN/
├── src/
│   ├── cli.ts                    # Command-line interface
│   ├── orchestrator.ts           # MCP coordination logic
│   ├── orchestrator-universal.ts # Universal multi-source orchestration
│   ├── config-validator.ts       # Configuration validation
│   ├── adapters/                 # Source adapters
│   │   ├── base.ts               # Base adapter interface
│   │   ├── mcp-adapter.ts        # MCP server adapter
│   │   ├── openapi-adapter.ts    # REST API adapter
│   │   └── graphql-adapter.ts    # GraphQL adapter
│   ├── codegen/                  # Code generation
│   │   ├── wrapper-generator.ts  # TypeScript wrapper creation
│   │   └── schema-converter.ts   # JSON Schema → TypeScript
│   ├── runtime/                  # Universal runtime
│   │   ├── universal-runtime.ts  # Core execution engine
│   │   ├── errors.ts             # Standardized errors
│   │   ├── auth-resolver.ts      # Authentication
│   │   ├── retry-policy.ts       # Retry with backoff
│   │   ├── schema-normalizer.ts  # Schema normalization
│   │   └── instrumentation.ts    # Logging & events
│   ├── discovery/                # Source discovery
│   └── types/                    # TypeScript types
├── tests/                        # Test suites
├── runtime-package/              # Standalone runtime package
├── examples/                     # Integration examples
├── README.md                     # Main documentation
├── ARCHITECTURE.md               # System design
└── package.json
```

## Making Changes

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/your-feature`
3. **Make your changes**
4. **Run tests**: `npm test`
5. **Build**: `npm run build`
6. **Commit**: Use clear, descriptive commit messages
7. **Push**: `git push origin feature/your-feature`
8. **Open a PR**: Describe your changes and why they're needed

## Adding a New Source Adapter

To add support for a new API type:

1. **Create adapter class** in `src/adapters/`:
```typescript
export class MyAdapter extends BaseAdapter {
  constructor(name: string, config: MyConfig) {
    super(name, 'my-source-type');
  }

  async discover(): Promise<ToolDefinition[]> { /* ... */ }
  async execute(tool: string, params: any): Promise<any> { /* ... */ }
  async validate(): Promise<boolean> { /* ... */ }
  async close(): Promise<void> { /* ... */ }
}
```

2. **Add to orchestrator** in `src/orchestrator-universal.ts`
3. **Update types** in `src/types/index.ts`
4. **Add tests** in `tests/adapters/`

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed design patterns.

## Coding Standards

- Use TypeScript strict mode
- Follow existing code style
- Add JSDoc comments for public APIs
- Keep functions focused and small
- Prefer composition over inheritance
- Write tests for new functionality

## Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Watch mode
npm run test:watch

# Manual CLI testing
mcp-codegen list
mcp-codegen quickstart
```

## Priority Areas

We welcome contributions in these areas:

1. **New Adapters**: Database adapter, gRPC, WebSocket
2. **Security**: Sandboxing, credential management, audit logging
3. **Streaming**: Replace buffered responses with streaming
4. **Testing**: Unit tests, integration tests, E2E tests
5. **Documentation**: Examples, guides, tutorials
6. **Multi-language**: Python, Go wrapper generation

## Code Review Process

- All PRs require review
- Address feedback promptly
- Keep PRs focused and small
- Update docs if adding features
- Ensure tests pass

## Questions?

Open an issue or start a discussion. We're friendly!

## License

By contributing, you agree your code will be licensed under Apache 2.0.
See [LICENSE](./LICENSE) for details.
