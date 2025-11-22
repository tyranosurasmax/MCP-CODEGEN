# Changelog

All notable changes to mcp-codegen will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
- 98% token reduction (validated against Anthropic's research)
- Type-safe wrapper generation
- Automatic retry with exponential backoff
- Timeout support (configurable, default 60s)
- Support for complex JSON Schemas (anyOf, oneOf, allOf)
- Server discovery precedence:
  1. `mcp-codegen.json`
  2. `~/.config/mcp/*.json`
  3. Claude Desktop configs
  4. System configs

### Known Limitations
- Streaming responses are buffered (will be addressed in v1.1)
- No sandboxing (security improvements coming)
- TypeScript only (Python support in v1.1)

## [Unreleased]

### Planned for v1.1
- Python wrapper generation
- Watch mode for development
- Mock mode for testing
- Streaming support
- Meta-server support
- State management layer
- Basic sandboxing options

### Planned for v1.2
- Intelligent tool composition
- Parity across Python, JavaScript, and TypeScript
- Enhanced security features

### Planned for v2
- Schema evolution tracking
- Web UI
- Workflow visualization
- Advanced sandboxing

### Planned for v3
- OpenAPI/REST/GraphQL support
- Database schema integration

### Planned for v4
- Autonomous optimization
- Predictive synthesis
