# Changelog

All notable changes to codegen will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-11-22

### Added
- Universal adapter pattern supporting multiple API source types
- OpenAPI/REST adapter with OpenAPI 3.x support
- UniversalRuntime for managing all adapter types
- HTTP authentication support (Bearer, API Key, Basic, OAuth2)
- Environment variable resolution in configurations
- Multi-source orchestration
- Universal configuration format
- Type-safe wrappers for REST APIs

### Changed
- Refactored MCP implementation to use adapter pattern
- Updated runtime to universal architecture
- Enhanced type system for multi-source support
- Improved documentation with universal focus

### Maintained
- 98% token reduction across all source types
- Backward compatibility with MCP-only configurations
- Type-safe wrapper generation
- Hash-based regeneration
- Cross-platform support

## [1.0.1] - 2025-11-22

### Added
- Initial release of mcp-codegen
- Automatic MCP server discovery from multiple config sources
- TypeScript wrapper generation with JSON Schema conversion
- MCP runtime with connection pooling and retry logic
- CLI commands: `sync`, `generate`, `list`, `quickstart`
- Automatic manifest generation (`.agent-ready.json`)
- Token usage benchmark generation
- Hash-based regeneration with user-editable zones
- Cross-platform support (macOS, Linux, Windows)
- Error handling with proper error types
- Per-server index generation

### Features
- 98% token reduction
- Type-safe wrapper generation
- Automatic retry with exponential backoff
- Timeout support (configurable, default 60s)
- Support for complex JSON Schemas (anyOf, oneOf, allOf)

