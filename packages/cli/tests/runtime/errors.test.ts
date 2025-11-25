/**
 * Tests for standardized error handling
 */

import {
  CodegenError,
  ErrorCategory,
  ErrorCode,
  toolNotFoundError,
  invalidParamsError,
  authFailedError,
  rateLimitError,
  networkError,
  shouldRetry
} from "@mcp-codegen/runtime";

describe("CodegenError", () => {
  describe("constructor", () => {
    it("should create error with all properties", () => {
      const error = new CodegenError({
        code: "TEST_ERROR",
        message: "Test error message",
        category: ErrorCategory.VALIDATION,
        retryable: false,
        context: { field: "test" },
        originalError: new Error("Original")
      });

      expect(error.code).toBe("TEST_ERROR");
      expect(error.message).toBe("Test error message");
      expect(error.category).toBe(ErrorCategory.VALIDATION);
      expect(error.retryable).toBe(false);
      expect(error.context).toEqual({ field: "test" });
      expect(error.originalError).toBeInstanceOf(Error);
      expect(error.originalError?.message).toBe("Original");
    });

    it("should infer retryable from category", () => {
      const transportError = new CodegenError({
        code: "TEST",
        message: "Test",
        category: ErrorCategory.TRANSPORT
      });
      expect(transportError.retryable).toBe(true);

      const validationError = new CodegenError({
        code: "TEST",
        message: "Test",
        category: ErrorCategory.VALIDATION
      });
      expect(validationError.retryable).toBe(false);
    });
  });

  describe("toJSON", () => {
    it("should serialize to JSON", () => {
      const error = new CodegenError({
        code: "TEST_ERROR",
        message: "Test",
        category: ErrorCategory.CONFIG,
        context: { field: "value" }
      });

      const json = error.toJSON();

      expect(json).toHaveProperty("name", "CodegenError");
      expect(json).toHaveProperty("code", "TEST_ERROR");
      expect(json).toHaveProperty("category", ErrorCategory.CONFIG);
      expect(json).toHaveProperty("message", "Test");
      expect(json).toHaveProperty("context", { field: "value" });
    });
  });

  describe("factory functions", () => {
    it("toolNotFoundError should create correct error", () => {
      const error = toolNotFoundError("github__list_repos");

      expect(error.code).toBe(ErrorCode.TOOL_NOT_FOUND);
      expect(error.category).toBe(ErrorCategory.CONFIG);
      expect(error.retryable).toBe(false);
      expect(error.context).toEqual({ toolName: "github__list_repos" });
    });

    it("invalidParamsError should create correct error", () => {
      const error = invalidParamsError("Missing required field 'name'", {
        field: "name"
      });

      expect(error.code).toBe(ErrorCode.INVALID_PARAMS);
      expect(error.category).toBe(ErrorCategory.VALIDATION);
      expect(error.retryable).toBe(false);
    });

    it("authFailedError should create correct error", () => {
      const error = authFailedError("github", "Invalid token");

      expect(error.code).toBe(ErrorCode.AUTH_FAILED);
      expect(error.category).toBe(ErrorCategory.AUTH);
      expect(error.retryable).toBe(false);
      expect(error.context).toEqual({ source: "github", reason: "Invalid token" });
    });

    it("rateLimitError should create correct error", () => {
      const error = rateLimitError("github", 60000);

      expect(error.code).toBe(ErrorCode.RATE_LIMITED);
      expect(error.category).toBe(ErrorCategory.RATE_LIMIT);
      expect(error.retryable).toBe(true);
      expect(error.context).toEqual({ source: "github", retryAfter: 60000 });
    });

    it("networkError should create correct error", () => {
      const originalError = new Error("Connection refused");
      const error = networkError("Failed to connect", originalError);

      expect(error.code).toBe(ErrorCode.NETWORK_ERROR);
      expect(error.category).toBe(ErrorCategory.TRANSPORT);
      expect(error.retryable).toBe(true);
      expect(error.originalError).toBe(originalError);
    });
  });

  describe("shouldRetry", () => {
    it("should not retry if max attempts reached", () => {
      const error = new CodegenError({
        code: "TEST",
        message: "Test",
        category: ErrorCategory.TRANSPORT,
        retryable: true
      });

      expect(shouldRetry(error, 3, 3)).toBe(false);
    });

    it("should retry when max attempts not reached", () => {
      const error = new CodegenError({
        code: "TEST",
        message: "Test",
        category: ErrorCategory.TRANSPORT,
        retryable: true
      });

      expect(shouldRetry(error, 1, 3)).toBe(true);
    });

    it("should work without maxAttempts parameter for backward compatibility", () => {
      const error = new CodegenError({
        code: "TEST",
        message: "Test",
        category: ErrorCategory.TRANSPORT,
        retryable: true
      });

      expect(shouldRetry(error, 3)).toBe(true);
    });

    it("should not retry if not retryable", () => {
      const error = new CodegenError({
        code: "TEST",
        message: "Test",
        category: ErrorCategory.VALIDATION,
        retryable: false
      });

      expect(shouldRetry(error, 1, 3)).toBe(false);
    });

    it("should retry transport errors", () => {
      const error = new CodegenError({
        code: "NETWORK_ERROR",
        message: "Test",
        category: ErrorCategory.TRANSPORT,
        retryable: true
      });

      expect(shouldRetry(error, 1, 3)).toBe(true);
    });

    it("should retry 5xx errors but not 4xx", () => {
      const error5xx = new CodegenError({
        code: ErrorCode.HTTP_ERROR_5XX,
        message: "Server error",
        category: ErrorCategory.EXECUTION,
        retryable: true
      });

      const error4xx = new CodegenError({
        code: ErrorCode.HTTP_ERROR_4XX,
        message: "Client error",
        category: ErrorCategory.EXECUTION,
        retryable: false
      });

      expect(shouldRetry(error5xx, 1, 3)).toBe(true);
      expect(shouldRetry(error4xx, 1, 3)).toBe(false);
    });
  });
});
