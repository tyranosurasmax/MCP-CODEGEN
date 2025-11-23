/**
 * Schema Normalization Layer
 *
 * Normalizes inconsistent schemas from different sources (OpenAPI, MCP, GraphQL)
 * into a consistent format for runtime validation and type generation.
 *
 * Handles:
 * - Missing or malformed type fields
 * - Inconsistent required arrays
 * - Invalid property definitions
 * - Missing additionalProperties
 * - Nested schema normalization
 */

import { invalidParamsError } from "./errors";

/**
 * Normalized JSON Schema
 *
 * Consistent schema format used internally
 */
export interface NormalizedSchema {
  type?: "object" | "array" | "string" | "number" | "integer" | "boolean" | "null";
  properties?: Record<string, NormalizedSchema>;
  items?: NormalizedSchema;
  required?: string[];
  additionalProperties?: boolean | NormalizedSchema;
  enum?: unknown[];
  format?: string;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  description?: string;
  default?: unknown;
  nullable?: boolean;
  oneOf?: NormalizedSchema[];
  anyOf?: NormalizedSchema[];
  allOf?: NormalizedSchema[];
  $ref?: string;
}

/**
 * Normalize a JSON Schema from any source
 *
 * Ensures consistent schema structure regardless of source.
 * Handles common issues like:
 * - Missing type field
 * - Inconsistent additionalProperties
 * - Invalid required arrays
 *
 * @example
 * ```typescript
 * // MCP schema (missing type)
 * const mcpSchema = {
 *   properties: { name: { type: "string" } },
 *   required: ["name"]
 * };
 *
 * const normalized = normalizeSchema(mcpSchema);
 * // { type: "object", properties: {...}, required: [...] }
 * ```
 */
export function normalizeSchema(schema: unknown): NormalizedSchema {
  if (!schema || typeof schema !== "object") {
    // Invalid schema, return permissive object
    return {
      type: "object",
      additionalProperties: true
    };
  }

  const input = schema as Record<string, unknown>;
  const normalized: NormalizedSchema = {};

  // Normalize type
  if (input.type) {
    if (typeof input.type === "string") {
      normalized.type = input.type as NormalizedSchema["type"];
    } else if (Array.isArray(input.type)) {
      // Handle type arrays (e.g., ["string", "null"])
      const types = input.type.filter((t: unknown) => typeof t === "string");
      if (types.includes("null")) {
        normalized.nullable = true;
        normalized.type = types.find((t: string) => t !== "null") as NormalizedSchema["type"];
      } else {
        normalized.type = types[0] as NormalizedSchema["type"];
      }
    }
  } else if (input.properties) {
    // If properties exist but no type, assume object
    normalized.type = "object";
  } else if (input.items) {
    // If items exist but no type, assume array
    normalized.type = "array";
  } else if (input.enum) {
    // Enum without type - infer from enum values
    const enumValues = input.enum as unknown[];
    if (enumValues.length > 0) {
      const firstType = typeof enumValues[0];
      if (firstType === "string") normalized.type = "string";
      else if (firstType === "number") normalized.type = "number";
      else if (firstType === "boolean") normalized.type = "boolean";
    }
  }

  // Normalize properties (for objects)
  if (input.properties && typeof input.properties === "object") {
    normalized.properties = {};
    for (const [key, value] of Object.entries(input.properties)) {
      normalized.properties[key] = normalizeSchema(value);
    }
  }

  // Normalize items (for arrays)
  if (input.items) {
    normalized.items = normalizeSchema(input.items);
  }

  // Normalize required
  if (input.required) {
    if (Array.isArray(input.required)) {
      normalized.required = input.required.filter((r: unknown) => typeof r === "string");
    }
  }

  // Normalize additionalProperties
  if (input.additionalProperties !== undefined) {
    if (typeof input.additionalProperties === "boolean") {
      normalized.additionalProperties = input.additionalProperties;
    } else {
      normalized.additionalProperties = normalizeSchema(input.additionalProperties);
    }
  } else if (normalized.type === "object" && !normalized.properties) {
    // Object with no properties - allow additional properties
    normalized.additionalProperties = true;
  }

  // Copy simple validations
  if (typeof input.enum === "object") {
    normalized.enum = Array.isArray(input.enum) ? input.enum : undefined;
  }
  if (typeof input.format === "string") normalized.format = input.format;
  if (typeof input.pattern === "string") normalized.pattern = input.pattern;
  if (typeof input.minimum === "number") normalized.minimum = input.minimum;
  if (typeof input.maximum === "number") normalized.maximum = input.maximum;
  if (typeof input.minLength === "number") normalized.minLength = input.minLength;
  if (typeof input.maxLength === "number") normalized.maxLength = input.maxLength;
  if (typeof input.minItems === "number") normalized.minItems = input.minItems;
  if (typeof input.maxItems === "number") normalized.maxItems = input.maxItems;
  if (typeof input.description === "string") normalized.description = input.description;
  if (input.default !== undefined) normalized.default = input.default;
  if (typeof input.nullable === "boolean") normalized.nullable = input.nullable;
  if (typeof input.$ref === "string") normalized.$ref = input.$ref;

  // Normalize composition schemas
  if (Array.isArray(input.oneOf)) {
    normalized.oneOf = input.oneOf.map(normalizeSchema);
  }
  if (Array.isArray(input.anyOf)) {
    normalized.anyOf = input.anyOf.map(normalizeSchema);
  }
  if (Array.isArray(input.allOf)) {
    normalized.allOf = input.allOf.map(normalizeSchema);
  }

  return normalized;
}

/**
 * Validate data against a normalized schema
 *
 * Performs runtime validation with helpful error messages.
 *
 * @example
 * ```typescript
 * const schema = {
 *   type: "object",
 *   properties: {
 *     name: { type: "string" },
 *     age: { type: "number", minimum: 0 }
 *   },
 *   required: ["name"]
 * };
 *
 * validateSchema(schema, { name: "Alice", age: 30 }); // OK
 * validateSchema(schema, { age: 30 }); // Throws: Missing required field 'name'
 * validateSchema(schema, { name: "Alice", age: -5 }); // Throws: age must be >= 0
 * ```
 */
export function validateSchema(schema: NormalizedSchema, data: unknown, path = ""): void {
  // Null/undefined handling
  if (data === null || data === undefined) {
    if (schema.nullable) {
      return; // Null is allowed
    }
    if (!schema.required || schema.required.length === 0) {
      return; // Optional, allow undefined
    }
    throw invalidParamsError(`${path || "value"} is required but got ${data}`, { path });
  }

  // Type validation
  if (schema.type) {
    const actualType = Array.isArray(data) ? "array" : typeof data;
    const expectedType = schema.type === "integer" ? "number" : schema.type;

    if (actualType !== expectedType) {
      throw invalidParamsError(
        `${path || "value"} must be ${expectedType} but got ${actualType}`,
        { path, expected: expectedType, actual: actualType }
      );
    }

    // Integer validation
    if (schema.type === "integer" && !Number.isInteger(data)) {
      throw invalidParamsError(`${path} must be an integer`, { path, value: data });
    }
  }

  // String validations
  if (typeof data === "string") {
    if (schema.minLength !== undefined && data.length < schema.minLength) {
      throw invalidParamsError(
        `${path} must be at least ${schema.minLength} characters`,
        { path, minLength: schema.minLength, actual: data.length }
      );
    }
    if (schema.maxLength !== undefined && data.length > schema.maxLength) {
      throw invalidParamsError(
        `${path} must be at most ${schema.maxLength} characters`,
        { path, maxLength: schema.maxLength, actual: data.length }
      );
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(data)) {
      throw invalidParamsError(
        `${path} must match pattern ${schema.pattern}`,
        { path, pattern: schema.pattern, value: data }
      );
    }
    if (schema.enum && !schema.enum.includes(data)) {
      throw invalidParamsError(
        `${path} must be one of: ${schema.enum.join(", ")}`,
        { path, enum: schema.enum, value: data }
      );
    }
  }

  // Number validations
  if (typeof data === "number") {
    if (schema.minimum !== undefined && data < schema.minimum) {
      throw invalidParamsError(
        `${path} must be >= ${schema.minimum}`,
        { path, minimum: schema.minimum, value: data }
      );
    }
    if (schema.maximum !== undefined && data > schema.maximum) {
      throw invalidParamsError(
        `${path} must be <= ${schema.maximum}`,
        { path, maximum: schema.maximum, value: data }
      );
    }
  }

  // Array validations
  if (Array.isArray(data)) {
    if (schema.minItems !== undefined && data.length < schema.minItems) {
      throw invalidParamsError(
        `${path} must have at least ${schema.minItems} items`,
        { path, minItems: schema.minItems, actual: data.length }
      );
    }
    if (schema.maxItems !== undefined && data.length > schema.maxItems) {
      throw invalidParamsError(
        `${path} must have at most ${schema.maxItems} items`,
        { path, maxItems: schema.maxItems, actual: data.length }
      );
    }

    // Validate each item
    if (schema.items) {
      data.forEach((item, index) => {
        validateSchema(schema.items!, item, `${path}[${index}]`);
      });
    }
  }

  // Object validations
  if (typeof data === "object" && data !== null && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;

    // Check required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in obj)) {
          throw invalidParamsError(
            `Missing required field '${field}'`,
            { path, field, required: schema.required }
          );
        }
      }
    }

    // Validate properties
    if (schema.properties) {
      for (const [key, value] of Object.entries(obj)) {
        const propSchema = schema.properties[key];

        if (propSchema) {
          // Known property - validate
          validateSchema(propSchema, value, `${path}.${key}`);
        } else if (schema.additionalProperties === false) {
          // Unknown property and additionalProperties is false
          throw invalidParamsError(
            `Unknown property '${key}' in ${path || "object"}`,
            { path, key, allowedKeys: Object.keys(schema.properties) }
          );
        } else if (typeof schema.additionalProperties === "object") {
          // Validate against additionalProperties schema
          validateSchema(schema.additionalProperties, value, `${path}.${key}`);
        }
        // else: additionalProperties is true, allow anything
      }
    }
  }

  // Composition schemas (basic support)
  if (schema.anyOf) {
    // Try to validate against at least one schema
    let valid = false;
    for (const subSchema of schema.anyOf) {
      try {
        validateSchema(subSchema, data, path);
        valid = true;
        break;
      } catch {
        // Continue trying other schemas
      }
    }
    if (!valid) {
      throw invalidParamsError(
        `${path} does not match any of the expected schemas`,
        { path }
      );
    }
  }

  if (schema.oneOf) {
    // Try to validate against exactly one schema
    let validCount = 0;
    for (const subSchema of schema.oneOf) {
      try {
        validateSchema(subSchema, data, path);
        validCount++;
      } catch {
        // Continue trying other schemas
      }
    }
    if (validCount !== 1) {
      throw invalidParamsError(
        `${path} must match exactly one schema (matched ${validCount})`,
        { path, validCount }
      );
    }
  }

  if (schema.allOf) {
    // Must validate against all schemas
    for (const subSchema of schema.allOf) {
      validateSchema(subSchema, data, path);
    }
  }
}

/**
 * Coerce data to match schema types
 *
 * Attempts to convert data to the expected type when possible.
 * Useful for handling string query parameters that should be numbers.
 *
 * @example
 * ```typescript
 * const schema = { type: "number" };
 * coerceToSchema(schema, "42") // 42 (number)
 * coerceToSchema(schema, "invalid") // "invalid" (no change)
 * ```
 */
export function coerceToSchema(schema: NormalizedSchema, data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  // Coerce to number
  if (schema.type === "number" || schema.type === "integer") {
    if (typeof data === "string") {
      const num = schema.type === "integer" ? parseInt(data, 10) : parseFloat(data);
      return !isNaN(num) ? num : data;
    }
  }

  // Coerce to boolean
  if (schema.type === "boolean") {
    if (typeof data === "string") {
      if (data === "true" || data === "1") return true;
      if (data === "false" || data === "0") return false;
    }
  }

  // Coerce to string
  if (schema.type === "string") {
    if (typeof data === "number" || typeof data === "boolean") {
      return String(data);
    }
  }

  // Coerce object properties
  if (schema.type === "object" && typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;
    if (schema.properties) {
      const coerced: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        const propSchema = schema.properties[key];
        coerced[key] = propSchema ? coerceToSchema(propSchema, value) : value;
      }
      return coerced;
    }
  }

  // Coerce array items
  if (schema.type === "array" && Array.isArray(data)) {
    if (schema.items) {
      return data.map(item => coerceToSchema(schema.items!, item));
    }
  }

  return data;
}

/**
 * Merge multiple schemas (for allOf support)
 */
export function mergeSchemas(...schemas: NormalizedSchema[]): NormalizedSchema {
  const merged: NormalizedSchema = {};

  for (const schema of schemas) {
    // Merge type (keep first defined)
    if (schema.type && !merged.type) {
      merged.type = schema.type;
    }

    // Merge properties
    if (schema.properties) {
      if (!merged.properties) {
        merged.properties = {};
      }
      Object.assign(merged.properties, schema.properties);
    }

    // Merge required
    if (schema.required) {
      if (!merged.required) {
        merged.required = [];
      }
      merged.required.push(...schema.required);
      merged.required = [...new Set(merged.required)]; // Dedupe
    }

    // Other fields (last wins)
    if (schema.items) merged.items = schema.items;
    if (schema.additionalProperties !== undefined) {
      merged.additionalProperties = schema.additionalProperties;
    }
    if (schema.minimum !== undefined) merged.minimum = schema.minimum;
    if (schema.maximum !== undefined) merged.maximum = schema.maximum;
    if (schema.minLength !== undefined) merged.minLength = schema.minLength;
    if (schema.maxLength !== undefined) merged.maxLength = schema.maxLength;
  }

  return merged;
}
