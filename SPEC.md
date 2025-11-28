# Agent Tool Manifest Specification

**Version:** 1.0.0-draft
**Status:** Draft
**Authors:** Max King
**Last Updated:** November 2025
**Repository:** https://github.com/tyranosurasmax/MCP-CODEGEN

---

## Abstract

The Agent Tool Manifest (ATM) specification defines a universal JSON format for describing API tools in a way optimized for AI agent consumption. It provides a source-agnostic method to discover, understand, and invoke tools regardless of their underlying protocol — whether MCP, REST, GraphQL, database, or custom implementations.

The primary goals are:

1. **Token efficiency** — Reduce context window consumption by 90%+ compared to raw API specifications
2. **Universality** — One format that represents tools from any source type
3. **Agent-first design** — Structured for LLM comprehension, not human documentation

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Terminology](#2-terminology)
3. [Design Goals](#3-design-goals)
4. [Non-Goals](#4-non-goals)
5. [File Convention](#5-file-convention)
6. [Manifest Structure](#6-manifest-structure)
7. [Field Definitions](#7-field-definitions)
8. [Tool Definition](#8-tool-definition)
9. [Authentication](#9-authentication)
10. [Metadata](#10-metadata)
11. [Extension Mechanism](#11-extension-mechanism)
12. [Versioning](#12-versioning)
13. [Examples](#13-examples)
14. [JSON Schema](#14-json-schema)
15. [Implementation Notes](#15-implementation-notes)
16. [Security Considerations](#16-security-considerations)
17. [Relationship to MCP-CODEGEN](#17-relationship-to-mcp-codegen)
18. [Acknowledgments](#18-acknowledgments)

---

## 1. Introduction

### 1.1 Problem Statement

AI agents increasingly interact with external APIs through tool-calling mechanisms. However, the specifications that describe these APIs are designed for human developers, not AI consumption:

| Source Type | Typical Spec Size | Token Count |
|-------------|-------------------|-------------|
| MCP Server | Tool definitions | 50K-150K tokens |
| OpenAPI/REST | Full specification | 100K-500K tokens |
| GraphQL | Schema introspection | 50K-200K tokens |
| Database | Schema + metadata | 20K-100K tokens |

Sending these specifications in every prompt is:

- **Expensive** — Token costs scale linearly
- **Inefficient** — Consumes context that could be used for reasoning
- **Inconsistent** — Each source type has different formats

### 1.2 Solution

The Agent Tool Manifest provides a **minimal, universal representation** of available tools that:

- Reduces token usage by 90-99%
- Works identically across all source types
- Contains only what agents need to discover and invoke tools
- Is machine-readable and validatable

### 1.3 Relationship to Existing Standards

ATM is **complementary** to existing specifications, not a replacement:

| Standard | Purpose | ATM Relationship |
|----------|---------|------------------|
| **MCP** | Protocol for AI-tool communication | ATM can represent MCP tools |
| **OpenAPI** | REST API documentation | ATM can be generated from OpenAPI |
| **GraphQL** | Query language specification | ATM can represent GraphQL operations |
| **JSON Schema** | Data validation | ATM uses JSON Schema for tool parameters |

ATM acts as a **universal translation layer** — any source can be represented in ATM format, and any agent can consume ATM manifests regardless of the underlying implementation.

---

## 2. Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119).

| Term | Definition |
|------|------------|
| **Manifest** | A JSON document conforming to this specification |
| **Tool** | A discrete operation that can be invoked by an agent |
| **Source** | The underlying API or service that provides tools |
| **Agent** | An AI system that discovers and invokes tools |
| **Generator** | Software that creates ATM manifests from sources |
| **Consumer** | Software that reads ATM manifests (typically agents or runtimes) |
| **Code Mode** | The pattern of generating code wrappers for token-efficient tool access |

---

## 3. Design Goals

### 3.1 Token Efficiency

The manifest format MUST be optimized for minimal token consumption. This means:

- No redundant information
- Concise field names where clarity is maintained
- Optional fields omitted when not applicable
- Descriptions limited to actionable information

**Target:** 90%+ reduction compared to source specifications.

### 3.2 Universality

The format MUST be capable of representing tools from:

- MCP servers
- REST APIs (OpenAPI 2.x and 3.x)
- GraphQL APIs
- Database schemas
- Custom/proprietary APIs

**Principle:** If a human can invoke it, ATM can represent it.

### 3.3 Self-Description

A manifest MUST contain everything an agent needs to:

1. Understand what tools are available
2. Determine what parameters each tool requires
3. Know what authentication is needed
4. Invoke the tool (via a runtime)

**Principle:** No external documentation required for basic usage.

### 3.4 Validatability

Manifests MUST be validatable against a JSON Schema. This enables:

- Automated validation in CI/CD
- Editor support and autocomplete
- Early detection of malformed manifests

### 3.5 Extensibility

The format MUST support custom extensions without breaking compatibility. This allows:

- Domain-specific metadata
- Experimental features
- Vendor extensions

---

## 4. Non-Goals

The following are explicitly **not** goals of this specification:

### 4.1 Execution Semantics

ATM defines **what** tools exist and **what** parameters they accept. It does NOT define:

- How tools are invoked (HTTP, stdio, IPC, etc.)
- Connection management
- Error handling behavior
- Retry policies

These are the responsibility of the **runtime** that consumes the manifest.

### 4.2 Replacement of Source Specifications

ATM does not replace MCP, OpenAPI, GraphQL schemas, or other specifications. Those remain the source of truth for:

- Full API documentation
- Human-readable guides
- Implementation details
- Versioning and deprecation policies

ATM is a **derived artifact** optimized for agent consumption.

### 4.3 Mandating Code Generation

While ATM is designed to work with code generation (see MCP-CODEGEN), the specification itself does not mandate any particular code output format. Manifests can be:

- Used directly by agents at runtime
- Used to generate TypeScript wrappers
- Used to generate Python clients
- Used for documentation

### 4.4 Authentication Implementation

ATM describes what authentication is **required**, not how to **perform** it. Token management, OAuth flows, and credential storage are runtime concerns.

---

## 5. File Convention

### 5.1 File Naming

ATM manifests SHOULD use one of the following naming conventions:

| Convention | Use Case |
|------------|----------|
| `.agent-ready.json` | Default, placed in project root |
| `{name}.agent-ready.json` | Multiple manifests in one directory |
| `agent-ready.json` | Alternative without leading dot |

### 5.2 Well-Known URL

For web-hosted APIs, manifests SHOULD be available at:

```
https://{api-domain}/.well-known/agent-ready.json
```

Example:
```
https://api.github.com/.well-known/agent-ready.json
```

### 5.3 Discovery

Generators and runtimes SHOULD check for manifests in this order:

1. Explicit path provided by user
2. `.agent-ready.json` in current directory
3. `agent-ready.json` in current directory
4. `.well-known/agent-ready.json` at API base URL

---

## 6. Manifest Structure

### 6.1 Top-Level Schema

```json
{
  "$schema": "https://mcp-codegen.dev/schemas/atm/v1.json",
  "specVersion": "1.0.0",
  "codeMode": true,
  "name": "string",
  "description": "string",
  "version": "string",
  "generated": "string",
  "language": "string",
  "sources": { },
  "tools": { },
  "paths": { },
  "capabilities": [ ],
  "auth": { },
  "tokenReduction": { },
  "metadata": { }
}
```

### 6.2 Required vs Optional Fields

| Field | Required | Description |
|-------|----------|-------------|
| `specVersion` | ✅ | Version of ATM spec |
| `codeMode` | ✅ | Always `true` for ATM manifests |
| `name` | ✅ | Unique identifier |
| `description` | ✅ | What this API collection does |
| `version` | ✅ | Generator version |
| `generated` | ✅ | ISO 8601 generation timestamp |
| `sources` | ✅ | Source information |
| `tools` | ✅ | Tool counts and definitions |
| `paths` | ✅ | File paths for wrappers and runtime |
| `capabilities` | ✅ | Feature flags |
| `language` | ❌ | Target language (default: typescript) |
| `auth` | ❌ | Authentication requirements |
| `tokenReduction` | ❌ | Token savings statistics |
| `metadata` | ❌ | Additional metadata |
| `$schema` | ❌ | JSON Schema reference for validation |

---

## 7. Field Definitions

### 7.1 `$schema`

**Type:** `string` (URI)
**Required:** No
**Purpose:** Enable JSON Schema validation and editor support

```json
{
  "$schema": "https://mcp-codegen.dev/schemas/atm/v1.json"
}
```

Consumers SHOULD ignore this field during processing. It exists solely for tooling support.

### 7.2 `specVersion`

**Type:** `string` (semver)
**Required:** Yes
**Format:** `MAJOR.MINOR.PATCH`

```json
{
  "specVersion": "1.0.0"
}
```

Consumers MUST check this field and handle version incompatibilities appropriately. See [Section 12: Versioning](#12-versioning) for compatibility rules.

### 7.3 `codeMode`

**Type:** `boolean`
**Required:** Yes
**Value:** Always `true`

```json
{
  "codeMode": true
}
```

This flag indicates the manifest is an ATM-compliant Code Mode manifest. Consumers can use this to quickly identify ATM manifests.

### 7.4 `name`

**Type:** `string`
**Required:** Yes
**Constraints:**
- Lowercase alphanumeric with hyphens
- 1-64 characters
- Pattern: `^[a-z][a-z0-9-]*$`

```json
{
  "name": "my-api-collection"
}
```

The name identifies this manifest and the collection of sources it represents.

### 7.5 `description`

**Type:** `string`
**Required:** Yes
**Constraints:**
- 1-500 characters
- SHOULD be a single sentence

```json
{
  "description": "Universal tool wrappers for filesystem and GitHub API"
}
```

### 7.6 `version`

**Type:** `string` (semver)
**Required:** Yes

```json
{
  "version": "1.1.0"
}
```

The version of the generator that created this manifest.

### 7.7 `generated`

**Type:** `string` (ISO 8601 datetime)
**Required:** Yes

```json
{
  "generated": "2025-11-22T08:33:05.918Z"
}
```

Timestamp of when the manifest was generated.

### 7.8 `language`

**Type:** `string`
**Required:** No
**Default:** `"typescript"`

```json
{
  "language": "typescript"
}
```

The target language for generated wrappers.

### 7.9 `sources`

**Type:** `object`
**Required:** Yes

Describes the API sources included in this manifest.

```json
{
  "sources": {
    "mcp": ["filesystem", "sqlite"],
    "openapi": ["github", "stripe"],
    "graphql": ["shopify"],
    "total": 5
  }
}
```

#### 7.9.1 Source Arrays

Each source type key contains an array of source names:

| Key | Type | Description |
|-----|------|-------------|
| `mcp` | `string[]` | MCP server names |
| `openapi` | `string[]` | OpenAPI/REST API names |
| `graphql` | `string[]` | GraphQL API names |
| `database` | `string[]` | Database source names |
| `custom` | `string[]` | Custom source names |
| `total` | `integer` | Total count of sources |

### 7.10 `tools`

**Type:** `object`
**Required:** Yes

Tool count information.

```json
{
  "tools": {
    "total": 1122,
    "bySource": {
      "filesystem": 14,
      "github": 1108
    }
  }
}
```

#### 7.10.1 Fields

| Field | Type | Description |
|-------|------|-------------|
| `total` | `integer` | Total tool count across all sources |
| `bySource` | `object` | Map of source name to tool count |

### 7.11 `paths`

**Type:** `object`
**Required:** Yes

File paths for generated code.

```json
{
  "paths": {
    "runtime": "./codegen/runtime",
    "wrappers": "./codegen",
    "config": "./codegen.config.json"
  }
}
```

#### 7.11.1 Fields

| Field | Type | Description |
|-------|------|-------------|
| `runtime` | `string` | Path to runtime module |
| `wrappers` | `string` | Root path for generated wrappers |
| `config` | `string` | Path to configuration file |

### 7.12 `capabilities`

**Type:** `string[]`
**Required:** Yes

Feature flags indicating what this manifest supports.

```json
{
  "capabilities": [
    "type-safety",
    "mcp-servers",
    "rest-apis",
    "graphql-apis",
    "connection-pooling",
    "retry-policy",
    "authentication"
  ]
}
```

#### 7.12.1 Standard Capabilities

| Capability | Description |
|------------|-------------|
| `type-safety` | Generated wrappers have TypeScript types |
| `mcp-servers` | Includes MCP server tools |
| `rest-apis` | Includes REST/OpenAPI tools |
| `graphql-apis` | Includes GraphQL tools |
| `database` | Includes database tools |
| `connection-pooling` | Runtime supports connection pooling |
| `retry-policy` | Runtime supports automatic retries |
| `authentication` | Runtime supports auth resolution |
| `instrumentation` | Runtime emits telemetry events |
| `streaming` | Supports streaming responses |

---

## 8. Tool Definition

While the manifest itself contains tool counts, **detailed tool definitions** live in the generated wrapper files. This keeps the manifest lightweight.

However, for consumers that need tool details without loading all wrappers, an optional `toolDefinitions` field MAY be included:

### 8.1 Optional Tool Definitions

```json
{
  "toolDefinitions": {
    "filesystem": [
      {
        "name": "read_file",
        "description": "Read the contents of a file",
        "inputSchema": {
          "type": "object",
          "properties": {
            "path": { "type": "string" }
          },
          "required": ["path"]
        }
      }
    ]
  }
}
```

### 8.2 Tool Definition Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | ✅ | Tool identifier (snake_case) |
| `description` | ✅ | What the tool does |
| `inputSchema` | ✅ | JSON Schema for parameters |
| `outputSchema` | ❌ | JSON Schema for return value |
| `metadata` | ❌ | Additional tool metadata |

### 8.3 Tool Metadata

```json
{
  "metadata": {
    "category": "files",
    "requiresAuth": false,
    "rateLimit": "1000/hour",
    "deprecated": false,
    "httpMethod": "GET",
    "httpPath": "/users/{username}"
  }
}
```

---

## 9. Authentication

### 9.1 Structure

```json
{
  "auth": {
    "required": true,
    "sources": {
      "github": {
        "types": ["bearer", "oauth2"],
        "default": "bearer",
        "instructions": "Create a token at github.com/settings/tokens"
      },
      "filesystem": {
        "types": ["none"],
        "required": false
      }
    }
  }
}
```

### 9.2 Top-Level Auth Fields

| Field | Type | Description |
|-------|------|-------------|
| `required` | `boolean` | Whether ANY source requires auth |
| `sources` | `object` | Per-source auth requirements |

### 9.3 Per-Source Auth Fields

| Field | Type | Description |
|-------|------|-------------|
| `types` | `string[]` | Supported auth types |
| `default` | `string` | Recommended auth type |
| `required` | `boolean` | Whether auth is required |
| `instructions` | `string` | How to obtain credentials |

### 9.4 Auth Types

| Type | Description |
|------|-------------|
| `none` | No authentication |
| `bearer` | Bearer token in Authorization header |
| `apiKey` | API key (header, query, or cookie) |
| `basic` | HTTP Basic authentication |
| `oauth2` | OAuth 2.0 (any flow) |
| `custom` | Custom authentication mechanism |

---

## 10. Metadata

### 10.1 Token Reduction Statistics

```json
{
  "tokenReduction": {
    "traditional": 207500,
    "codeMode": 2500,
    "reduction": 0.9879,
    "savings": "98.8%"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `traditional` | `integer` | Tokens using raw specs |
| `codeMode` | `integer` | Tokens using generated code |
| `reduction` | `number` | Reduction ratio (0-1) |
| `savings` | `string` | Human-readable percentage |

### 10.2 Additional Metadata

```json
{
  "metadata": {
    "generatedBy": "mcp-codegen@1.1.0",
    "checksum": "sha256:abc123...",
    "homepage": "https://github.com/tyranosurasmax/MCP-CODEGEN",
    "license": "Apache-2.0"
  }
}
```

---

## 11. Extension Mechanism

### 11.1 Custom Fields

Custom fields MUST be prefixed with `x-` and can appear in:

- Top-level manifest
- Source entries
- Tool definitions
- Metadata objects

```json
{
  "x-internal-id": "api-v2-prod",
  "metadata": {
    "x-cost-center": "engineering"
  }
}
```

### 11.2 Compatibility

Consumers MUST ignore unrecognized `x-` fields without error. This ensures forward compatibility as extensions evolve.

---

## 12. Versioning

### 12.1 Semantic Versioning

The specification follows [Semantic Versioning 2.0.0](https://semver.org/):

- **MAJOR:** Breaking changes to required fields or structure
- **MINOR:** New optional fields, non-breaking additions
- **PATCH:** Clarifications, typo fixes, examples

### 12.2 Compatibility Rules

| Consumer Version | Manifest Version | Compatibility |
|------------------|------------------|---------------|
| 1.x | 1.x | ✅ Full |
| 1.x | 1.y (y > x) | ✅ Full (ignore unknown optional fields) |
| 1.x | 2.x | ⚠️ May work, not guaranteed |
| 2.x | 1.x | ✅ Should support (backward compatible) |

---

## 13. Examples

### 13.1 Complete Manifest

```json
{
  "$schema": "https://mcp-codegen.dev/schemas/atm/v1.json",
  "specVersion": "1.0.0",
  "codeMode": true,
  "name": "universal-tools",
  "description": "MCP filesystem and GitHub REST API tools",
  "version": "1.1.0",
  "generated": "2025-11-22T08:33:05.918Z",
  "language": "typescript",
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
  "paths": {
    "runtime": "./codegen/runtime",
    "wrappers": "./codegen",
    "config": "./codegen.config.json"
  },
  "capabilities": [
    "type-safety",
    "mcp-servers",
    "rest-apis",
    "connection-pooling",
    "retry-policy",
    "authentication"
  ],
  "auth": {
    "required": false,
    "sources": {
      "filesystem": {
        "types": ["none"],
        "required": false
      },
      "github": {
        "types": ["bearer", "none"],
        "default": "bearer",
        "required": false,
        "instructions": "Create a personal access token at https://github.com/settings/tokens"
      }
    }
  },
  "tokenReduction": {
    "traditional": 207500,
    "codeMode": 2500,
    "reduction": 0.9879,
    "savings": "98.8%"
  },
  "metadata": {
    "generatedBy": "mcp-codegen@1.1.0",
    "homepage": "https://github.com/tyranosurasmax/MCP-CODEGEN"
  }
}
```

### 13.2 Minimal Manifest

```json
{
  "specVersion": "1.0.0",
  "codeMode": true,
  "name": "minimal",
  "description": "A minimal manifest",
  "version": "1.0.0",
  "generated": "2025-11-28T00:00:00.000Z",
  "sources": {
    "mcp": ["example"],
    "total": 1
  },
  "tools": {
    "total": 1,
    "bySource": {
      "example": 1
    }
  },
  "paths": {
    "runtime": "./codegen/runtime",
    "wrappers": "./codegen",
    "config": "./codegen.config.json"
  },
  "capabilities": ["type-safety"]
}
```

### 13.3 Multi-Source Manifest

```json
{
  "specVersion": "1.0.0",
  "codeMode": true,
  "name": "enterprise-tools",
  "description": "Enterprise tool collection with MCP, REST, and GraphQL",
  "version": "1.1.0",
  "generated": "2025-11-28T12:00:00.000Z",
  "language": "typescript",
  "sources": {
    "mcp": ["filesystem", "sqlite"],
    "openapi": ["github", "stripe"],
    "graphql": ["shopify"],
    "total": 5
  },
  "tools": {
    "total": 2500,
    "bySource": {
      "filesystem": 14,
      "sqlite": 8,
      "github": 1108,
      "stripe": 320,
      "shopify": 1050
    }
  },
  "paths": {
    "runtime": "./codegen/runtime",
    "wrappers": "./codegen",
    "config": "./codegen.config.json"
  },
  "capabilities": [
    "type-safety",
    "mcp-servers",
    "rest-apis",
    "graphql-apis",
    "connection-pooling",
    "retry-policy",
    "authentication",
    "instrumentation"
  ],
  "auth": {
    "required": true,
    "sources": {
      "filesystem": { "types": ["none"], "required": false },
      "sqlite": { "types": ["none"], "required": false },
      "github": { "types": ["bearer"], "required": false },
      "stripe": { "types": ["bearer"], "required": true },
      "shopify": { "types": ["bearer"], "required": true }
    }
  },
  "tokenReduction": {
    "traditional": 850000,
    "codeMode": 8500,
    "reduction": 0.99,
    "savings": "99.0%"
  }
}
```

---

## 14. JSON Schema

The normative JSON Schema for validating ATM manifests is maintained at:

**URL:** `https://mcp-codegen.dev/schemas/atm/v1.json`

**Repository:** `https://github.com/tyranosurasmax/MCP-CODEGEN/blob/main/atm.schema.json`

### 14.1 Validation Command

The reference implementation provides validation:

```bash
mcp-codegen validate .agent-ready.json
```

---

## 15. Implementation Notes

### 15.1 Generator Guidelines

Generators (tools that create ATM manifests) SHOULD:

1. **Produce minimal output** — Omit optional fields when they add no value
2. **Calculate token reduction** — Include tokenReduction statistics
3. **Use consistent naming** — Source names should be lowercase, alphanumeric
4. **Include checksums** — Enable change detection
5. **Validate output** — Check against JSON Schema before writing

### 15.2 Consumer Guidelines

Consumers (agents and runtimes) SHOULD:

1. **Validate first** — Check against JSON Schema
2. **Handle unknowns gracefully** — Ignore unknown fields
3. **Check capabilities** — Verify required capabilities are present
4. **Use paths correctly** — Respect runtime and wrapper paths
5. **Honor auth requirements** — Check auth before tool invocation

### 15.3 Agent Integration

Agents consuming ATM manifests should:

1. Load the manifest from `.agent-ready.json`
2. Check `codeMode: true` to confirm it's an ATM manifest
3. Review `capabilities` to understand what's available
4. Import wrappers from `paths.wrappers`
5. Use the runtime at `paths.runtime` for tool calls

---

## 16. Security Considerations

### 16.1 Credential Handling

Manifests MUST NOT contain actual credentials. The `auth` section describes requirements, not values. Credentials are resolved at runtime from:

- Environment variables
- Secret managers
- Configuration files
- User input

### 16.2 Input Validation

Runtimes MUST validate all inputs against tool inputSchemas before execution. This prevents:

- Injection attacks
- Type confusion
- Unexpected behavior

### 16.3 Manifest Trust

Consumers SHOULD only load manifests from trusted sources. A malicious manifest could:

- Describe non-existent tools (causing errors)
- Provide incorrect schemas (causing validation bypass)
- Include misleading descriptions (prompt injection)

---

## 17. Relationship to MCP-CODEGEN

This specification is the formal definition of the manifest format used by MCP-CODEGEN. The relationship is:

| Component | Role |
|-----------|------|
| **ATM Specification** | The standard (this document) |
| **MCP-CODEGEN** | Reference implementation |
| **`.agent-ready.json`** | The manifest file |
| **Generated wrappers** | TypeScript code for tool invocation |

MCP-CODEGEN is one implementation of this specification. Other implementations are welcome and encouraged.

---

## 18. Acknowledgments

This specification builds on concepts and work from:

- **Anthropic** — Model Context Protocol (MCP) and the Code Mode concept that inspired this work
- **Cloudflare** — Code Mode implementation patterns
- **OpenAPI Initiative** — REST API specification patterns
- **GraphQL Foundation** — Schema introspection concepts
- **JSON Schema** — Data validation specification

This specification extends the Code Mode concept to work universally across all API types.

---

## Appendix A: Source Type Reference

### A.1 MCP (`mcp`)

MCP servers communicate via stdio and provide tool definitions through the MCP protocol.

| Aspect | Details |
|--------|---------|
| Discovery | `tools/list` MCP method |
| Execution | `tools/call` MCP method |
| Auth | Typically none (local servers) |

### A.2 OpenAPI (`openapi`)

REST APIs described by OpenAPI/Swagger specifications.

| Aspect | Details |
|--------|---------|
| Discovery | Parse OpenAPI spec, one tool per operation |
| Execution | HTTP requests via axios or fetch |
| Auth | Bearer, API key, Basic, OAuth2 |

**Naming convention:** `{operationId}` or `{method}_{path}`

### A.3 GraphQL (`graphql`)

GraphQL APIs discovered via introspection.

| Aspect | Details |
|--------|---------|
| Discovery | GraphQL introspection query |
| Execution | GraphQL queries/mutations |
| Auth | Typically bearer token |

**Naming convention:** `{queryName}` or `{mutationName}`

### A.4 Database (`database`)

Database schemas discovered via information_schema or equivalent.

| Aspect | Details |
|--------|---------|
| Discovery | Schema introspection |
| Execution | SQL queries |
| Auth | Connection credentials |

**Naming convention:** `{operation}_{table}`

---

## Appendix B: Token Estimation

Token counts SHOULD be estimated using the `cl100k_base` tokenizer (used by GPT-4 and Claude). For JavaScript/TypeScript:

```javascript
import { encoding_for_model } from 'tiktoken';

const enc = encoding_for_model('gpt-4');
const tokenCount = enc.encode(JSON.stringify(manifest)).length;
```

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0-draft | November 2025 | Initial draft aligned with MCP-CODEGEN |

---

**End of Specification**
