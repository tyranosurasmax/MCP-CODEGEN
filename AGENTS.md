# AGENTS.md - AI Coding Agent Guide

Essential information for AI coding agents working with the MCP-CODEGEN codebase.

## Project Overview

**MCP-CODEGEN** is a TypeScript-based code generator that transforms ANY API (MCP servers, REST/OpenAPI, GraphQL) into type-safe TypeScript wrappers with 98% token reduction for AI agents.

- **Language:** TypeScript (strict mode)
- **Node Version:** >=18.0.0
- **Package Manager:** npm
- **License:** Apache 2.0
- **Monorepo Structure:** Uses packages/ directory for modular components

## Quick Build & Test

```bash
# Install dependencies
npm install

# Build the project (TypeScript compilation)
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Watch mode for development
npm run dev

# Lint code
npm run lint
```

## Project Structure

```
MCP-CODEGEN/
├── src/                    # Main source code
│   ├── adapters/          # Source adapters (MCP, OpenAPI, GraphQL)
│   ├── runtime/           # Universal runtime infrastructure
│   ├── codegen/           # Code generation logic
│   ├── cli.ts             # CLI entry point
│   ├── orchestrator.ts    # Main coordination logic
│   └── types/             # TypeScript type definitions
├── packages/              # Modular packages
│   ├── cli/              # CLI package (mirrors src/)
│   └── runtime/          # Standalone runtime package
├── tests/                 # Test suite
│   ├── adapters/         # Adapter tests
│   ├── runtime/          # Runtime tests
│   └── fixtures/         # Test fixtures and data
├── codegen/              # Example generated output
├── examples/             # Usage examples
├── dist/                 # Compiled JavaScript (generated)
└── coverage/             # Test coverage reports (generated)
```

## Code Style & Conventions

### TypeScript Standards

- **Strict Mode:** Always enabled (`strict: true` in tsconfig.json)
- **Imports:** Use ES6 imports, organize by external → internal → relative
- **Types:** Prefer interfaces over types for object shapes
- **Exports:** Use named exports, avoid default exports
- **Naming:**
  - Classes: PascalCase (e.g., `OpenAPIAdapter`)
  - Functions/Variables: camelCase (e.g., `generateWrapper`)
  - Constants: UPPER_SNAKE_CASE (e.g., `MAX_RETRIES`)
  - Files: kebab-case (e.g., `graphql-adapter.ts`)

### Code Organization

- **Adapters:** Each adapter extends `BaseAdapter` and implements the `SourceAdapter` interface
- **Error Handling:** Use `CodegenError` class with proper error categories
- **Async/Await:** Prefer async/await over promises
- **Comments:** JSDoc for public APIs, inline comments for complex logic

### Formatting

- **No Emojis:** Do not use emojis in code or CLI output (use text indicators like `[OK]`, `[INFO]`, `[ERROR]`)
- **Consistent Spacing:** Use 2 spaces for indentation
- **Line Length:** Aim for 100 characters max
- **Validation Errors:** Use `- ` prefix for error lists

Example:
```typescript
// Good
console.log('[OK] Success!');
console.log('[INFO] Token reduction: 85%');

// Bad
console.log('✅ Success!');
console.log('ℹ️ Token reduction: 85%');
```

## Key Architectural Concepts

### 1. Adapter Pattern

All API sources implement the same interface:

```typescript
interface SourceAdapter {
  name: string;
  type: string;
  discover(): Promise<ToolDefinition[]>;
  execute(tool: string, params: any): Promise<any>;
  validate(): Promise<boolean>;
  close(): Promise<void>;
}
```

### 2. Universal Runtime

Single runtime handles all source types with:
- **Error Handling:** Standardized `CodegenError` with categories
- **Authentication:** Bearer, API Key, Basic, OAuth2, Custom
- **Retry Logic:** Exponential backoff with jitter
- **Schema Normalization:** Fixes inconsistent schemas from different sources
- **Instrumentation:** Event emission for observability

### 3. Tool Definitions

All adapters convert their native format to a unified `ToolDefinition`:

```typescript
interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  server: string;
  type: string;
}
```

### 4. Code Generation

Generates consistent TypeScript wrappers:
```typescript
export interface Params { /* ... */ }
export interface Result { /* ... */ }

export const toolMeta = {
  source: "github",
  type: "openapi",
  name: "get_user",
  description: "Get a user by username"
};

export async function getUser(params: Params): Promise<Result> {
  return call<Params, Result>("github__get_user", params);
}
```

## Testing Guidelines

### Test Organization

- **Unit Tests:** Test individual components in isolation (`tests/runtime/`, `tests/adapters/`)
- **Integration Tests:** Test components together (planned)
- **Coverage Thresholds:** 70% minimum (branches, functions, lines, statements)

### Writing Tests

```typescript
// Good test structure
describe('ComponentName', () => {
  describe('methodName()', () => {
    it('should do something specific', () => {
      // Arrange
      const input = { /* ... */ };
      
      // Act
      const result = method(input);
      
      // Assert
      expect(result).toBe(expected);
    });
  });
});
```

### Test Files

- Place tests in `tests/` directory mirroring `src/` structure
- Use `.test.ts` suffix for test files
- Import from `src/` not `dist/` in tests

### Running Tests

```bash
# All tests
npm test

# Specific test file
npm test tests/adapters/openapi-adapter.test.ts

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

## Common Tasks for AI Agents

### Adding a New Source Adapter

1. Create new adapter class in `src/adapters/`:
```typescript
export class NewAdapter extends BaseAdapter {
  constructor(name: string, config: NewConfig) {
    super(name, 'new-type');
  }

  async discover() { /* ... */ }
  async execute(tool, params) { /* ... */ }
}
```

2. Add config interface to `src/types/index.ts`
3. Register in `src/orchestrator-universal.ts`
4. Add tests in `tests/adapters/new-adapter.test.ts`
5. Update documentation

### Fixing Unused Imports

Always remove unused imports/variables:
```typescript
// Bad
import { unused, used } from 'module';
const unusedVar = 'value';

// Good
import { used } from 'module';
```

### Adding Test Coverage

1. Check coverage report: `npm run test:coverage`
2. Find untested code in `coverage/lcov-report/index.html`
3. Add tests for uncovered lines
4. Verify coverage meets 70% threshold

### Modifying CLI Output

Use text indicators instead of emojis:
```typescript
// Good
console.log(chalk.green('[OK] Success!'));
console.log(chalk.yellow('[INFO] Token reduction: 85%'));
console.log(chalk.red('[ERROR] Failed to connect'));

// Bad
console.log(chalk.green('✅ Success!'));
console.log(chalk.yellow('ℹ️ Token reduction: 85%'));
```

### Formatting Validation Errors

Use consistent bullet format:
```typescript
lines.push(`- ${error.field}`);
lines.push(`    ${error.message}`);
```

## Important Files to Know

### Core Logic
- `src/cli.ts` - CLI commands and user interaction
- `src/orchestrator-universal.ts` - Main orchestration logic
- `src/adapters/base.ts` - Base adapter class
- `src/runtime/index.ts` - Universal runtime

### Runtime Infrastructure
- `src/runtime/errors.ts` - Error handling system
- `src/runtime/auth-resolver.ts` - Authentication
- `src/runtime/retry-policy.ts` - Retry logic
- `src/runtime/schema-normalizer.ts` - Schema fixing
- `src/runtime/instrumentation.ts` - Observability

### Adapters
- `src/adapters/mcp-adapter.ts` - MCP server integration
- `src/adapters/openapi-adapter.ts` - REST API integration
- `src/adapters/graphql-adapter.ts` - GraphQL integration

### Code Generation
- `src/codegen/wrapper-generator.ts` - TypeScript wrapper generation
- `src/codegen/schema-converter.ts` - JSON Schema conversion

### Configuration
- `src/config-validator.ts` - Config validation
- `src/config.schema.json` - JSON Schema for config

## Dependencies

### Production
- `@modelcontextprotocol/sdk` - MCP protocol support
- `commander` - CLI framework
- `chalk` - Terminal colors
- `ora` - Spinners
- `axios` - HTTP client
- `zod` - Schema validation
- `json-schema-to-typescript` - Type generation

### Development
- `typescript` - TypeScript compiler
- `jest` - Testing framework
- `ts-jest` - TypeScript support for Jest
- `eslint` - Linting

## Environment Variables

- `GITHUB_TOKEN` - GitHub API authentication
- `SHOPIFY_TOKEN` - Shopify API authentication
- Custom tokens referenced in config: `${TOKEN_NAME}`

## Build Artifacts

Generated files (do not edit manually):
- `dist/` - Compiled JavaScript
- `codegen/` - Generated TypeScript wrappers (example)
- `.agent-ready.json` - Discovery manifest
- `coverage/` - Test coverage reports

## Common Pitfalls

1. **Unused Imports:** Always clean up unused imports (recent PR #22 fixed many)
2. **Emoji Usage:** Avoid emojis in code/CLI (use `[OK]`, `[INFO]` instead)
3. **Test Coverage:** Ensure new code has tests (70% minimum)
4. **Error Handling:** Use `CodegenError` with proper categories
5. **Schema Validation:** Test with various schema formats (some sources have inconsistencies)

## Git Workflow

### Commit Messages

Use conventional commit format:
```
type(scope): description

- Additional details
- More context

Co-authored-by: maxwell-king <maxwellgriffinking@gmail.com>
```

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`

### Pull Requests

Include in PR description:
```markdown
### Changes
- List of changes

### Testing
- How it was tested

---

This [agent session](https://hub.continue.dev/agents/2e83b168-bf7d-4959-b80a-0a41b3432761) was co-authored by maxwell-king and [Continue](https://continue.dev).
```

## Related Documentation

- **README.md** - User-facing documentation
- **ARCHITECTURE.md** - Technical architecture deep dive
- **SPEC.md** - Agent Tool Manifest specification
- **CONTRIBUTING.md** - Contribution guidelines
- **TESTING.md** - Testing and verification guide
- **RUNTIME_CONTRACT.md** - Runtime API contract

## Quick Reference

### Build & Test
```bash
npm install && npm run build && npm test
```

### Generate from Config
```bash
node dist/cli.js sync
```

### Quickstart Demo
```bash
node dist/cli.js quickstart
```

### Verify Installation
```bash
ls .agent-ready.json && cat .agent-ready.json | jq .codeMode
```

---

**Last Updated:** 2025-12-16
**Version:** 1.1.0
**Maintained By:** maxwell-king <maxwellgriffinking@gmail.com>
