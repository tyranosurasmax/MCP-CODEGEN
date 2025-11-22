# Contributing to MCP-CODEGEN

Thank you for your interest in contributing! This project is racing to become the standard Code Mode implementation for MCP, so we move fast.

## Development Setup

```bash
# Clone the repo
git clone https://github.com/tyranosurasmax/MCP-CODEGEN.git
cd MCP-CODEGEN

# Install dependencies
npm install

# Build the project
npm run build

# Link for local testing
npm link
```

## Project Structure

```
MCP-CODEGEN/
├── src/
│   ├── cli.ts              # Command-line interface
│   ├── orchestrator.ts     # Main coordination logic
│   ├── discovery/          # Server discovery
│   ├── codegen/            # Code generation
│   ├── runtime/            # MCP runtime
│   └── types/              # TypeScript types
├── runtime-package/        # Standalone runtime package
├── README.md               # Main documentation
└── package.json
```

## Making Changes

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/your-feature`
3. **Make your changes**
4. **Build and test**: `npm run build`
5. **Commit**: Use clear, descriptive commit messages
6. **Push**: `git push origin feature/your-feature`
7. **Open a PR**: Describe your changes and why they're needed

## Coding Standards

- Use TypeScript strict mode
- Follow existing code style
- Add JSDoc comments for public APIs
- Keep functions focused and small
- Prefer composition over inheritance

## Testing

```bash
# Manual testing
mcp-codegen list
mcp-codegen sync
```

(Automated tests coming soon)

## Priority Areas

We need help with:

1. **Security**: Sandboxing, credential management
2. **Streaming**: Replace buffered responses with streaming
3. **Testing**: Unit tests, integration tests
4. **Documentation**: Examples, guides, tutorials
5. **Multi-language**: Python wrapper generation

## Code Review Process

- All PRs require review
- Address feedback promptly
- Keep PRs focused and small
- Update docs if adding features

## Questions?

Open an issue or start a discussion. We're friendly!

## License

By contributing, you agree your code will be licensed under MIT.
