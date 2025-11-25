/**
 * Configuration Validation
 *
 * Validates codegen.config.json against JSON schema before generation.
 * Provides helpful error messages for misconfigurations.
 */

import * as fs from "fs";
import * as path from "path";
import { UniversalConfig } from "./types";

// JSON Schema types (simplified)
interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

/**
 * Load and validate configuration file
 *
 * @param configPath - Path to codegen.config.json
 * @returns Validated configuration object
 * @throws Error if validation fails
 */
export function loadAndValidateConfig(configPath: string): UniversalConfig {
  // Check file exists
  if (!fs.existsSync(configPath)) {
    throw new Error(`Configuration file not found: ${configPath}`);
  }

  // Parse JSON
  let rawConfig: unknown;
  try {
    const content = fs.readFileSync(configPath, "utf-8");
    rawConfig = JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to parse configuration: ${(error as Error).message}`);
  }

  // Validate structure
  const errors = validateConfig(rawConfig);
  if (errors.length > 0) {
    const errorMessages = errors.map(e => `  - ${e.field}: ${e.message}`).join("\n");
    throw new Error(`Configuration validation failed:\n${errorMessages}`);
  }

  return rawConfig as UniversalConfig;
}

/**
 * Validate configuration object
 *
 * @param config - Raw configuration object
 * @returns Array of validation errors (empty if valid)
 */
export function validateConfig(config: unknown): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check is object
  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    errors.push({
      field: "root",
      message: "Configuration must be an object"
    });
    return errors;
  }

  const cfg = config as Record<string, unknown>;

  // Validate required fields
  if (!cfg.sources) {
    errors.push({
      field: "sources",
      message: "Required field 'sources' is missing"
    });
    return errors; // Can't continue without sources
  }

  if (typeof cfg.sources !== "object" || Array.isArray(cfg.sources)) {
    errors.push({
      field: "sources",
      message: "Field 'sources' must be an object"
    });
    return errors;
  }

  const sources = cfg.sources as Record<string, unknown>;

  // Validate MCP sources
  if (sources.mcp) {
    if (typeof sources.mcp !== "object" || Array.isArray(sources.mcp)) {
      errors.push({
        field: "sources.mcp",
        message: "Field 'sources.mcp' must be an object"
      });
    } else {
      const mcpSources = sources.mcp as Record<string, unknown>;
      for (const [name, config] of Object.entries(mcpSources)) {
        errors.push(...validateMCPConfig(name, config));
      }
    }
  }

  // Validate OpenAPI sources
  if (sources.openapi) {
    if (typeof sources.openapi !== "object" || Array.isArray(sources.openapi)) {
      errors.push({
        field: "sources.openapi",
        message: "Field 'sources.openapi' must be an object"
      });
    } else {
      const openApiSources = sources.openapi as Record<string, unknown>;
      for (const [name, config] of Object.entries(openApiSources)) {
        errors.push(...validateOpenAPIConfig(name, config));
      }
    }
  }

  // Validate GraphQL sources (if present)
  if (sources.graphql) {
    if (typeof sources.graphql !== "object" || Array.isArray(sources.graphql)) {
      errors.push({
        field: "sources.graphql",
        message: "Field 'sources.graphql' must be an object"
      });
    } else {
      const graphqlSources = sources.graphql as Record<string, unknown>;
      for (const [name, config] of Object.entries(graphqlSources)) {
        errors.push(...validateGraphQLConfig(name, config));
      }
    }
  }

  // Check at least one source defined
  const hasAnySources =
    (sources.mcp && Object.keys(sources.mcp).length > 0) ||
    (sources.openapi && Object.keys(sources.openapi).length > 0) ||
    (sources.graphql && Object.keys(sources.graphql).length > 0);

  if (!hasAnySources) {
    errors.push({
      field: "sources",
      message: "At least one source must be defined (mcp, openapi, or graphql)"
    });
  }

  // Validate optional fields
  if (cfg.outputDir !== undefined && typeof cfg.outputDir !== "string") {
    errors.push({
      field: "outputDir",
      message: "Field 'outputDir' must be a string",
      value: cfg.outputDir
    });
  }

  if (cfg.runtimePackage !== undefined && typeof cfg.runtimePackage !== "string") {
    errors.push({
      field: "runtimePackage",
      message: "Field 'runtimePackage' must be a string",
      value: cfg.runtimePackage
    });
  }

  return errors;
}

/**
 * Validate MCP server configuration
 */
function validateMCPConfig(name: string, config: unknown): ValidationError[] {
  const errors: ValidationError[] = [];
  const prefix = `sources.mcp.${name}`;

  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    errors.push({
      field: prefix,
      message: "MCP configuration must be an object"
    });
    return errors;
  }

  const cfg = config as Record<string, unknown>;

  // Required fields
  if (cfg.type !== "mcp") {
    errors.push({
      field: `${prefix}.type`,
      message: "Field 'type' must be 'mcp'",
      value: cfg.type
    });
  }

  if (!cfg.command) {
    errors.push({
      field: `${prefix}.command`,
      message: "Required field 'command' is missing"
    });
  } else if (typeof cfg.command !== "string") {
    errors.push({
      field: `${prefix}.command`,
      message: "Field 'command' must be a string",
      value: cfg.command
    });
  }

  if (!cfg.args) {
    errors.push({
      field: `${prefix}.args`,
      message: "Required field 'args' is missing"
    });
  } else if (!Array.isArray(cfg.args)) {
    errors.push({
      field: `${prefix}.args`,
      message: "Field 'args' must be an array",
      value: cfg.args
    });
  } else {
    // Validate args are strings
    cfg.args.forEach((arg: unknown, index: number) => {
      if (typeof arg !== "string") {
        errors.push({
          field: `${prefix}.args[${index}]`,
          message: "All arguments must be strings",
          value: arg
        });
      }
    });
  }

  // Optional fields
  if (cfg.env !== undefined) {
    if (typeof cfg.env !== "object" || Array.isArray(cfg.env)) {
      errors.push({
        field: `${prefix}.env`,
        message: "Field 'env' must be an object",
        value: cfg.env
      });
    }
  }

  if (cfg.timeout !== undefined) {
    if (typeof cfg.timeout !== "number") {
      errors.push({
        field: `${prefix}.timeout`,
        message: "Field 'timeout' must be a number",
        value: cfg.timeout
      });
    } else if (cfg.timeout < 1000 || cfg.timeout > 300000) {
      errors.push({
        field: `${prefix}.timeout`,
        message: "Field 'timeout' must be between 1000 and 300000 milliseconds",
        value: cfg.timeout
      });
    }
  }

  return errors;
}

/**
 * Validate OpenAPI configuration
 */
function validateOpenAPIConfig(name: string, config: unknown): ValidationError[] {
  const errors: ValidationError[] = [];
  const prefix = `sources.openapi.${name}`;

  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    errors.push({
      field: prefix,
      message: "OpenAPI configuration must be an object"
    });
    return errors;
  }

  const cfg = config as Record<string, unknown>;

  // Required fields
  if (cfg.type !== "openapi") {
    errors.push({
      field: `${prefix}.type`,
      message: "Field 'type' must be 'openapi'",
      value: cfg.type
    });
  }

  if (!cfg.spec) {
    errors.push({
      field: `${prefix}.spec`,
      message: "Required field 'spec' is missing"
    });
  } else if (typeof cfg.spec !== "string") {
    errors.push({
      field: `${prefix}.spec`,
      message: "Field 'spec' must be a string (URL or file path)",
      value: cfg.spec
    });
  }

  if (!cfg.baseUrl) {
    errors.push({
      field: `${prefix}.baseUrl`,
      message: "Required field 'baseUrl' is missing"
    });
  } else if (typeof cfg.baseUrl !== "string") {
    errors.push({
      field: `${prefix}.baseUrl`,
      message: "Field 'baseUrl' must be a string (URL)",
      value: cfg.baseUrl
    });
  } else {
    // Validate URL format
    try {
      new URL(cfg.baseUrl);
    } catch {
      errors.push({
        field: `${prefix}.baseUrl`,
        message: "Field 'baseUrl' must be a valid URL",
        value: cfg.baseUrl
      });
    }
  }

  // Optional fields
  if (cfg.auth !== undefined) {
    errors.push(...validateAuthConfig(`${prefix}.auth`, cfg.auth));
  }

  if (cfg.timeout !== undefined) {
    if (typeof cfg.timeout !== "number") {
      errors.push({
        field: `${prefix}.timeout`,
        message: "Field 'timeout' must be a number",
        value: cfg.timeout
      });
    }
  }

  if (cfg.headers !== undefined) {
    if (typeof cfg.headers !== "object" || Array.isArray(cfg.headers)) {
      errors.push({
        field: `${prefix}.headers`,
        message: "Field 'headers' must be an object",
        value: cfg.headers
      });
    }
  }

  return errors;
}

/**
 * Validate GraphQL configuration
 */
function validateGraphQLConfig(name: string, config: unknown): ValidationError[] {
  const errors: ValidationError[] = [];
  const prefix = `sources.graphql.${name}`;

  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    errors.push({
      field: prefix,
      message: "GraphQL configuration must be an object"
    });
    return errors;
  }

  const cfg = config as Record<string, unknown>;

  if (cfg.type !== "graphql") {
    errors.push({
      field: `${prefix}.type`,
      message: "Field 'type' must be 'graphql'",
      value: cfg.type
    });
  }

  if (!cfg.endpoint) {
    errors.push({
      field: `${prefix}.endpoint`,
      message: "Required field 'endpoint' is missing"
    });
  } else if (typeof cfg.endpoint !== "string") {
    errors.push({
      field: `${prefix}.endpoint`,
      message: "Field 'endpoint' must be a string (URL)",
      value: cfg.endpoint
    });
  }

  return errors;
}

/**
 * Validate authentication configuration
 */
function validateAuthConfig(prefix: string, config: unknown): ValidationError[] {
  const errors: ValidationError[] = [];

  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    errors.push({
      field: prefix,
      message: "Auth configuration must be an object"
    });
    return errors;
  }

  const cfg = config as Record<string, unknown>;

  if (!cfg.type) {
    errors.push({
      field: `${prefix}.type`,
      message: "Required field 'type' is missing"
    });
    return errors;
  }

  const authType = cfg.type;

  switch (authType) {
    case "bearer":
      if (!cfg.token) {
        errors.push({
          field: `${prefix}.token`,
          message: "Required field 'token' is missing for bearer auth"
        });
      }
      break;

    case "apiKey":
      if (!cfg.name) {
        errors.push({
          field: `${prefix}.name`,
          message: "Required field 'name' is missing for apiKey auth"
        });
      }
      if (!cfg.in) {
        errors.push({
          field: `${prefix}.in`,
          message: "Required field 'in' is missing for apiKey auth"
        });
      } else if (!["header", "query", "cookie"].includes(cfg.in as string)) {
        errors.push({
          field: `${prefix}.in`,
          message: "Field 'in' must be 'header', 'query', or 'cookie'",
          value: cfg.in
        });
      }
      if (!cfg.value) {
        errors.push({
          field: `${prefix}.value`,
          message: "Required field 'value' is missing for apiKey auth"
        });
      }
      break;

    case "basic":
      if (!cfg.username) {
        errors.push({
          field: `${prefix}.username`,
          message: "Required field 'username' is missing for basic auth"
        });
      }
      if (!cfg.password) {
        errors.push({
          field: `${prefix}.password`,
          message: "Required field 'password' is missing for basic auth"
        });
      }
      break;

    case "oauth2":
      if (!cfg.flow) {
        errors.push({
          field: `${prefix}.flow`,
          message: "Required field 'flow' is missing for oauth2 auth"
        });
      }
      if (!cfg.clientId) {
        errors.push({
          field: `${prefix}.clientId`,
          message: "Required field 'clientId' is missing for oauth2 auth"
        });
      }
      break;

    case "custom":
      if (!cfg.resolver) {
        errors.push({
          field: `${prefix}.resolver`,
          message: "Required field 'resolver' is missing for custom auth"
        });
      }
      break;

    default:
      errors.push({
        field: `${prefix}.type`,
        message: `Unknown auth type: ${authType}. Must be 'bearer', 'apiKey', 'basic', 'oauth2', or 'custom'`,
        value: authType
      });
  }

  return errors;
}

/**
 * Print validation errors in a user-friendly format
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  if (errors.length === 0) {
    return "Configuration is valid";
  }

  const lines = [
    `Found ${errors.length} validation error${errors.length === 1 ? "" : "s"}:`,
    ""
  ];

  for (const error of errors) {
    lines.push(`- ${error.field}`);
    lines.push(`    ${error.message}`);
    if (error.value !== undefined) {
      lines.push(`    Got: ${JSON.stringify(error.value)}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
