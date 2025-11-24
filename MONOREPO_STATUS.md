# Monorepo Refactoring Status

##  Completed

### Package Structure
- Created `packages/cli/` with @mcp-codegen/cli package
- Created `packages/runtime/` with @mcp-codegen/runtime package
- Set up npm workspaces in root package.json
- Copied source files to appropriate packages

### Runtime Package (@mcp-codegen/runtime)
-  Builds successfully
-  Exports universal runtime functions: `call`, `callTyped`, `registerAdapter`, `getAdapter`
-  Created `SourceAdapter` interface for adapter abstraction
-  Exports all error types, auth resolver, instrumentation, retry policy
-  No dependencies on CLI code

### Build Scripts
-  Root package.json has workspace build scripts
-  `npm run build:runtime` works
-  `npm run build:cli` - needs fixes (see below)

##  In Progress / Needs Completion

### CLI Package (@mcp-codegen/cli)
**Status:** TypeScript errors preventing build

**Remaining Issues:**
1. `src/cli.ts` imports removed `./orchestrator` (old MCP-only orchestrator)
2. `src/index.ts` has GraphQLConfig export ambiguity (exported from both ./types and ./adapters)
3. Old `Orchestrator` class removed/disabled - need to update CLI commands to use `UniversalOrchestrator`

**Files Needing Updates:**
- `src/cli.ts` - Remove orchestrator import, use UniversalOrchestrator
- `src/index.ts` - Fix GraphQLConfig export ambiguity
- CLI commands - Update to use universal orchestrator

### Wrapper Generator
**Status:** Not yet updated

**Needs:**
- Update generated code to import from `@mcp-codegen/runtime` instead of relative paths
- Ensure generated wrappers use `call()` and `callTyped()` from runtime package

### CI/CD
**Status:** Not yet updated

**Needs:**
- Update `.github/workflows/ci.yml` to build both packages
- Add matrix build for packages
- Update publish workflow for monorepo

### Documentation
**Status:** Not yet updated

**Needs:**
- Update README with new package structure
- Document installation: `npm install -g @mcp-codegen/cli`
- Document runtime usage: `import { call, callTyped } from "@mcp-codegen/runtime"`
- Update GETTING_STARTED.md
- Update ARCHITECTURE.md

## Package Dependencies

```
@mcp-codegen/runtime (standalone)
  ├── axios
  └── No internal dependencies

@mcp-codegen/cli
  ├── @mcp-codegen/runtime@^1.1.0
  ├── @modelcontextprotocol/sdk
  ├── commander
  ├── json-schema-to-typescript
  └── ... (other CLI deps)
```

## File Structure

```
/
├── packages/
│   ├── cli/
│   │   ├── src/
│   │   │   ├── adapters/       (MCP, OpenAPI, GraphQL adapters)
│   │   │   ├── codegen/        (wrapper generator, schema converter)
│   │   │   ├── discovery/      (source discovery)
│   │   │   ├── types/          (TypeScript types)
│   │   │   ├── cli.ts          (CLI entry point)  needs fix
│   │   │   ├── index.ts        (programmatic API)  needs fix
│   │   │   └── orchestrator-universal.ts (universal orchestrator)
│   │   ├── tests/
│   │   ├── package.json        (@mcp-codegen/cli)
│   │   └── tsconfig.json
│   │
│   └── runtime/
│       ├── src/
│       │   ├── adapter.ts          (SourceAdapter interface)
│       │   ├── universal-runtime.ts (call, callTyped, registerAdapter)
│       │   ├── errors.ts           (error types and utilities)
│       │   ├── auth-resolver.ts    (authentication)
│       │   ├── instrumentation.ts  (metrics, logging)
│       │   ├── retry-policy.ts     (retry logic)
│       │   ├── schema-normalizer.ts (schema utilities)
│       │   └── index.ts            (public exports) 
│       ├── package.json            (@mcp-codegen/runtime) 
│       └── tsconfig.json
│
├── package.json (workspace root) 
└── MONOREPO_STATUS.md (this file)
```

## Next Steps (Priority Order)

1. **Fix CLI TypeScript Errors**
   - Remove orchestrator.ts import from cli.ts
   - Fix GraphQLConfig export conflict
   - Update CLI commands to use UniversalOrchestrator

2. **Update Wrapper Generator**
   - Change generated imports to use `@mcp-codegen/runtime`
   - Test generated code

3. **Test Packages**
   - Build both packages successfully
   - Run tests
   - Verify CLI commands work

4. **Update CI/CD**
   - Monorepo build workflow
   - Package publishing

5. **Update Documentation**
   - README
   - Installation instructions
   - Usage examples

## Benefits of Monorepo Structure

 **Clear Separation of Concerns**
- CLI: Code generation, discovery, adapters
- Runtime: Tool execution, error handling, instrumentation

 **Independent Versioning**
- Can version CLI and runtime separately
- Runtime is stable, CLI can evolve

 **Better Developer Experience**
- `npm install -g @mcp-codegen/cli` - get the CLI
- Generated code imports `@mcp-codegen/runtime` - explicit dependency

 **Reduced Bundle Size**
- Generated projects only need runtime package
- Don't need CLI dependencies at runtime
