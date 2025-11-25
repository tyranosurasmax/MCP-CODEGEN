/**
 * Tests for configuration validation
 */

import { validateConfig, formatValidationErrors } from "../src/config-validator";

describe("Config Validator", () => {
  describe("validateConfig", () => {
    it("should validate valid configuration", () => {
      const config = {
        sources: {
          mcp: {
            filesystem: {
              type: "mcp",
              command: "npx",
              args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
            }
          }
        }
      };

      const errors = validateConfig(config);
      expect(errors).toHaveLength(0);
    });

    it("should reject config without sources", () => {
      const config = {
        outputDir: "./codegen"
      };

      const errors = validateConfig(config);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].field).toBe("sources");
    });

    it("should reject MCP config without command", () => {
      const config = {
        sources: {
          mcp: {
            test: {
              type: "mcp",
              args: ["test"]
            }
          }
        }
      };

      const errors = validateConfig(config);
      const commandError = errors.find(e => e.field.includes("command"));
      expect(commandError).toBeDefined();
    });

    it("should reject MCP config without args", () => {
      const config = {
        sources: {
          mcp: {
            test: {
              type: "mcp",
              command: "npx"
            }
          }
        }
      };

      const errors = validateConfig(config);
      const argsError = errors.find(e => e.field.includes("args"));
      expect(argsError).toBeDefined();
    });

    it("should reject OpenAPI config without spec", () => {
      const config = {
        sources: {
          openapi: {
            test: {
              type: "openapi",
              baseUrl: "https://api.example.com"
            }
          }
        }
      };

      const errors = validateConfig(config);
      const specError = errors.find(e => e.field.includes("spec"));
      expect(specError).toBeDefined();
    });

    it("should reject OpenAPI config without baseUrl", () => {
      const config = {
        sources: {
          openapi: {
            test: {
              type: "openapi",
              spec: "https://api.example.com/openapi.json"
            }
          }
        }
      };

      const errors = validateConfig(config);
      const baseUrlError = errors.find(e => e.field.includes("baseUrl"));
      expect(baseUrlError).toBeDefined();
    });

    it("should reject invalid baseUrl", () => {
      const config = {
        sources: {
          openapi: {
            test: {
              type: "openapi",
              spec: "https://api.example.com/openapi.json",
              baseUrl: "not-a-url"
            }
          }
        }
      };

      const errors = validateConfig(config);
      const urlError = errors.find(e => e.message.includes("valid URL"));
      expect(urlError).toBeDefined();
    });

    it("should validate bearer auth", () => {
      const config = {
        sources: {
          openapi: {
            test: {
              type: "openapi",
              spec: "https://api.example.com/openapi.json",
              baseUrl: "https://api.example.com",
              auth: {
                type: "bearer",
                token: "${API_TOKEN}"
              }
            }
          }
        }
      };

      const errors = validateConfig(config);
      expect(errors).toHaveLength(0);
    });

    it("should reject bearer auth without token", () => {
      const config = {
        sources: {
          openapi: {
            test: {
              type: "openapi",
              spec: "https://api.example.com/openapi.json",
              baseUrl: "https://api.example.com",
              auth: {
                type: "bearer"
              }
            }
          }
        }
      };

      const errors = validateConfig(config);
      const tokenError = errors.find(e => e.field.includes("token"));
      expect(tokenError).toBeDefined();
    });

    it("should reject unknown auth type", () => {
      const config = {
        sources: {
          openapi: {
            test: {
              type: "openapi",
              spec: "https://api.example.com/openapi.json",
              baseUrl: "https://api.example.com",
              auth: {
                type: "unknown-auth"
              }
            }
          }
        }
      };

      const errors = validateConfig(config);
      const authError = errors.find(e => e.message.includes("Unknown auth type"));
      expect(authError).toBeDefined();
    });
  });

  describe("formatValidationErrors", () => {
    it("should format errors nicely", () => {
      const errors = [
        {
          field: "sources.mcp.test.command",
          message: "Required field 'command' is missing"
        },
        {
          field: "sources.openapi.api.baseUrl",
          message: "Field 'baseUrl' must be a valid URL",
          value: "not-a-url"
        }
      ];

      const formatted = formatValidationErrors(errors);

      expect(formatted).toContain("Found 2 validation errors");
      expect(formatted).toContain("sources.mcp.test.command");
      expect(formatted).toContain("Required field 'command' is missing");
      expect(formatted).toContain("not-a-url");
    });

    it("should handle zero errors", () => {
      const formatted = formatValidationErrors([]);
      expect(formatted).toBe("Configuration is valid");
    });
  });
});
