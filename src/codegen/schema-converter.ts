/**
 * JSON Schema to TypeScript converter
 * Converts MCP tool schemas to TypeScript interfaces
 */

import * as crypto from 'crypto';

export interface ConversionResult {
  typeDefinition: string;
  warnings: string[];
}

export class SchemaConverter {
  private warnings: string[] = [];

  /**
   * Convert JSON Schema to TypeScript interface
   */
  convert(schema: any, interfaceName: string): ConversionResult {
    this.warnings = [];

    if (!schema || typeof schema !== 'object') {
      this.warnings.push(`No schema provided for ${interfaceName}, using Record<string, unknown>`);
      return {
        typeDefinition: `export interface ${interfaceName} extends Record<string, unknown> {}`,
        warnings: this.warnings,
      };
    }

    const typeStr = this.convertType(schema, 0);
    const definition = `export interface ${interfaceName} ${typeStr}`;

    return {
      typeDefinition: definition,
      warnings: this.warnings,
    };
  }

  private convertType(schema: any, depth: number): string {
    // Handle $ref (basic support)
    if (schema.$ref) {
      this.warnings.push(`$ref not fully supported: ${schema.$ref}`);
      return 'unknown';
    }

    // Handle type arrays (union types)
    if (Array.isArray(schema.type)) {
      return schema.type.map((t: string) => this.convertSimpleType(t)).join(' | ');
    }

    const type = schema.type;

    switch (type) {
      case 'object':
        return this.convertObject(schema, depth);
      case 'array':
        return this.convertArray(schema, depth);
      case 'string':
      case 'number':
      case 'integer':
      case 'boolean':
      case 'null':
        return this.convertSimpleType(type, schema);
      default:
        // Handle anyOf, oneOf, allOf
        if (schema.anyOf) {
          return this.convertUnion(schema.anyOf, depth, 'anyOf');
        }
        if (schema.oneOf) {
          return this.convertUnion(schema.oneOf, depth, 'oneOf');
        }
        if (schema.allOf) {
          return this.convertIntersection(schema.allOf, depth);
        }

        // Fallback
        this.warnings.push(`Unknown schema type, using 'unknown'`);
        return 'unknown';
    }
  }

  private convertSimpleType(type: string, schema?: any): string {
    switch (type) {
      case 'string':
        if (schema?.enum) {
          return schema.enum.map((v: string) => `"${v}"`).join(' | ');
        }
        return 'string';
      case 'number':
      case 'integer':
        if (schema?.enum) {
          return schema.enum.join(' | ');
        }
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'null':
        return 'null';
      default:
        return 'unknown';
    }
  }

  private convertObject(schema: any, depth: number): string {
    const properties = schema.properties || {};
    const required = new Set(schema.required || []);
    const indent = '  '.repeat(depth + 1);

    if (Object.keys(properties).length === 0) {
      return 'Record<string, unknown>';
    }

    const props = Object.entries(properties)
      .map(([key, propSchema]) => {
        const optional = !required.has(key) ? '?' : '';
        const propType = this.convertType(propSchema, depth + 1);
        const description = (propSchema as any).description;
        const comment = description ? `\n${indent}/** ${description} */` : '';
        return `${comment}\n${indent}${key}${optional}: ${propType};`;
      })
      .join('\n');

    return `{\n${props}\n${'  '.repeat(depth)}}`;
  }

  private convertArray(schema: any, depth: number): string {
    if (schema.items) {
      const itemType = this.convertType(schema.items, depth);
      return `Array<${itemType}>`;
    }
    return 'unknown[]';
  }

  private convertUnion(schemas: any[], depth: number, kind: string): string {
    if (schemas.length === 0) {
      this.warnings.push(`Empty ${kind}, using 'unknown'`);
      return 'unknown';
    }

    const types = schemas.map(s => {
      const t = this.convertType(s, depth);
      // Wrap complex types in parentheses
      return t.includes('{') ? `(${t})` : t;
    });

    return types.join(' | ');
  }

  private convertIntersection(schemas: any[], depth: number): string {
    if (schemas.length === 0) {
      this.warnings.push(`Empty allOf, using 'unknown'`);
      return 'unknown';
    }

    const types = schemas.map(s => {
      const t = this.convertType(s, depth);
      return t.includes('{') ? `(${t})` : t;
    });

    return types.join(' & ');
  }
}

/**
 * Generate stable hash for tool specification
 */
export function generateToolHash(tool: any): string {
  const normalized = JSON.stringify(tool, Object.keys(tool).sort());
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

/**
 * Convert to PascalCase for interface names
 */
export function toPascalCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

/**
 * Convert to camelCase for function names
 */
export function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}
