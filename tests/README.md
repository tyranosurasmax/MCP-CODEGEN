# Test Suite

Comprehensive test suite for MCP-CODEGEN covering all components.

## Structure

```
tests/
├── runtime/              # Runtime infrastructure tests
│   ├── errors.test.ts
│   ├── auth-resolver.test.ts
│   ├── retry-policy.test.ts
│   ├── schema-normalizer.test.ts
│   └── instrumentation.test.ts
├── adapters/            # Source adapter tests
│   ├── mcp-adapter.test.ts
│   ├── openapi-adapter.test.ts
│   └── base-adapter.test.ts
├── codegen/             # Code generation tests
│   ├── typescript-generator.test.ts
│   ├── wrapper-generator.test.ts
│   └── manifest-generator.test.ts
├── integration/         # End-to-end integration tests
│   ├── quickstart.test.ts
│   ├── github-api.test.ts
│   └── universal-mode.test.ts
├── fixtures/            # Test data and fixtures
│   ├── openapi/
│   │   ├── github-api.json
│   │   └── simple-api.json
│   ├── mcp/
│   │   └── mock-server.ts
│   └── configs/
│       ├── valid-config.json
│       └── invalid-config.json
└── setup.ts             # Test setup and helpers
```

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test tests/runtime/errors.test.ts

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Test Categories

### Unit Tests

Test individual components in isolation:
- Runtime error handling
- Auth resolution
- Retry logic
- Schema normalization
- Instrumentation

### Integration Tests

Test components working together:
- Full quickstart flow
- Real API integration (GitHub)
- MCP server communication
- Universal mode (MCP + REST)

### Snapshot Tests

Verify generated code doesn't change unexpectedly:
- Generated wrapper structure
- TypeScript type definitions
- Manifest format

## Writing Tests

### Runtime Tests Example

```typescript
import { CodegenError, ErrorCategory } from "../../src/runtime/errors";

describe("CodegenError", () => {
  it("should create error with correct properties", () => {
    const error = new CodegenError({
      code: "TEST_ERROR",
      message: "Test error message",
      category: ErrorCategory.VALIDATION,
      context: { field: "test" }
    });

    expect(error.code).toBe("TEST_ERROR");
    expect(error.category).toBe(ErrorCategory.VALIDATION);
    expect(error.retryable).toBe(false);
    expect(error.context).toEqual({ field: "test" });
  });
});
```

### Adapter Tests Example

```typescript
import { OpenAPIAdapter } from "../../src/adapters/openapi-adapter";

describe("OpenAPIAdapter", () => {
  it("should discover tools from OpenAPI spec", async () => {
    const adapter = new OpenAPIAdapter("github", {
      type: "openapi",
      spec: "./tests/fixtures/openapi/simple-api.json",
      baseUrl: "https://api.example.com"
    });

    const tools = await adapter.discover();

    expect(tools.length).toBeGreaterThan(0);
    expect(tools[0]).toHaveProperty("name");
    expect(tools[0]).toHaveProperty("description");
    expect(tools[0]).toHaveProperty("inputSchema");
  });
});
```

### Integration Tests Example

```typescript
import { execSync } from "child_process";
import * as fs from "fs";

describe("Quickstart Integration", () => {
  beforeEach(() => {
    // Clean up
    if (fs.existsSync(".agent-ready.json")) {
      fs.unlinkSync(".agent-ready.json");
    }
  });

  it("should generate wrappers from quickstart", () => {
    execSync("node dist/cli.js quickstart", { encoding: "utf-8" });

    // Verify files created
    expect(fs.existsSync(".agent-ready.json")).toBe(true);
    expect(fs.existsSync("codegen/runtime/index.ts")).toBe(true);

    // Verify manifest
    const manifest = JSON.parse(fs.readFileSync(".agent-ready.json", "utf-8"));
    expect(manifest.codeMode).toBe(true);
    expect(manifest.tools.total).toBeGreaterThan(0);
  });
});
```

## Test Coverage Goals

- **Runtime**: 90%+ coverage
- **Adapters**: 80%+ coverage
- **Code Generation**: 85%+ coverage
- **Integration**: Key workflows covered

## Fixtures

Test fixtures provide consistent test data:

### OpenAPI Fixtures

- `simple-api.json` - Minimal API for unit tests
- `github-api.json` - Real GitHub API spec (subset)

### MCP Fixtures

- `mock-server.ts` - Mock MCP server for testing

### Config Fixtures

- `valid-config.json` - Valid configuration
- `invalid-config.json` - Invalid configuration (for validation tests)

## CI/CD Integration

Tests run automatically on:
- Every commit (via GitHub Actions)
- Pull requests
- Before publishing to npm

## Troubleshooting

### Tests Timing Out

Increase timeout for integration tests:
```typescript
it("should work", async () => {
  // ...
}, 30000); // 30 second timeout
```

### Flaky Tests

Use `retry` for network-dependent tests:
```typescript
jest.retryTimes(3);
```

### Mock Issues

Reset mocks between tests:
```typescript
afterEach(() => {
  jest.clearAllMocks();
});
```
