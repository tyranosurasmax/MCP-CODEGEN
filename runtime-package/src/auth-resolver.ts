/**
 * Authentication Resolution System
 *
 * Handles authentication for all transport types with support for:
 * - Environment variable substitution
 * - Token refresh
 * - Custom auth resolvers
 * - Caching
 *
 * See RUNTIME_CONTRACT.md for full specification.
 */

import { authFailedError } from "./errors";

/**
 * Auth configuration from codegen.config.json
 */
export interface AuthConfig {
  type: "bearer" | "apiKey" | "basic" | "oauth2" | "custom";
  [key: string]: unknown;
}

/**
 * Bearer token authentication
 */
export interface BearerAuthConfig extends AuthConfig {
  type: "bearer";
  token: string;
}

/**
 * API key authentication
 */
export interface ApiKeyAuthConfig extends AuthConfig {
  type: "apiKey";
  name: string;
  in: "header" | "query" | "cookie";
  value: string;
}

/**
 * Basic authentication
 */
export interface BasicAuthConfig extends AuthConfig {
  type: "basic";
  username: string;
  password: string;
}

/**
 * OAuth2 authentication
 */
export interface OAuth2AuthConfig extends AuthConfig {
  type: "oauth2";
  flow: "clientCredentials" | "authorizationCode" | "implicit" | "password";
  tokenUrl?: string;
  authUrl?: string;
  clientId: string;
  clientSecret?: string;
  scopes?: string[];
  refreshToken?: string;
}

/**
 * Custom authentication (user-provided resolver)
 */
export interface CustomAuthConfig extends AuthConfig {
  type: "custom";
  resolver: string;
}

/**
 * Context provided to auth resolvers
 */
export interface AuthContext {
  /** Source name (e.g., "github", "stripe") */
  source: string;

  /** Tool being called (e.g., "list_repos") */
  tool: string;

  /** Auth configuration from config file */
  config: AuthConfig;

  /** Previous auth attempt (for refresh) */
  previousAttempt?: AuthResult;
}

/**
 * Result from auth resolution
 */
export interface AuthResult {
  /** HTTP headers to add */
  headers?: Record<string, string>;

  /** Query parameters to add */
  query?: Record<string, string>;

  /** Cookies to add */
  cookies?: Record<string, string>;

  /** Expiration time (for caching) */
  expires?: Date;

  /** Whether this result can be cached */
  cacheable?: boolean;
}

/**
 * Custom auth resolver interface
 */
export interface AuthResolver {
  /** Unique name for this resolver */
  name: string;

  /** Resolve authentication */
  resolve(context: AuthContext): Promise<AuthResult>;

  /** Refresh authentication (optional) */
  refresh?(context: AuthContext): Promise<AuthResult>;
}

/**
 * Registry of custom auth resolvers
 */
const authResolvers = new Map<string, AuthResolver>();

/**
 * Cache of resolved auth results
 */
interface CachedAuth {
  result: AuthResult;
  expiresAt: Date;
}

const authCache = new Map<string, CachedAuth>();

/**
 * Register a custom auth resolver
 *
 * @example
 * ```typescript
 * registerAuthResolver({
 *   name: "vaultAuth",
 *   async resolve(context) {
 *     const token = await fetchFromVault(context.source);
 *     return {
 *       headers: { Authorization: `Bearer ${token}` },
 *       expires: new Date(Date.now() + 3600000),
 *       cacheable: true
 *     };
 *   }
 * });
 * ```
 */
export function registerAuthResolver(resolver: AuthResolver): void {
  authResolvers.set(resolver.name, resolver);
}

/**
 * Get a registered auth resolver by name
 */
export function getAuthResolver(name: string): AuthResolver | undefined {
  return authResolvers.get(name);
}

/**
 * Substitute environment variables in a string
 *
 * Supports:
 * - ${VAR_NAME}
 * - $VAR_NAME
 * - ${VAR_NAME:-default}
 *
 * @example
 * ```typescript
 * process.env.API_KEY = "secret";
 * substituteEnvVars("${API_KEY}") // "secret"
 * substituteEnvVars("${MISSING:-default}") // "default"
 * ```
 */
export function substituteEnvVars(value: string): string {
  // ${VAR_NAME:-default} syntax
  const withDefault = /\$\{([A-Z_][A-Z0-9_]*):-([^}]*)\}/gi;
  value = value.replace(withDefault, (_, varName, defaultValue) => {
    return process.env[varName] ?? defaultValue;
  });

  // ${VAR_NAME} syntax
  const withBraces = /\$\{([A-Z_][A-Z0-9_]*)\}/gi;
  value = value.replace(withBraces, (_, varName) => {
    return process.env[varName] ?? "";
  });

  // $VAR_NAME syntax (no braces)
  const withoutBraces = /\$([A-Z_][A-Z0-9_]*)/g;
  value = value.replace(withoutBraces, (_, varName) => {
    return process.env[varName] ?? "";
  });

  return value;
}

/**
 * Substitute environment variables in an entire config object
 */
function substituteConfigEnvVars(config: AuthConfig): AuthConfig {
  const result: any = { ...config };

  for (const [key, value] of Object.entries(result)) {
    if (typeof value === "string") {
      result[key] = substituteEnvVars(value);
    } else if (typeof value === "object" && value !== null) {
      result[key] = substituteConfigEnvVars(value as any);
    }
  }

  return result;
}

/**
 * Resolve bearer token authentication
 */
async function resolveBearerAuth(config: BearerAuthConfig): Promise<AuthResult> {
  const token = substituteEnvVars(config.token);

  if (!token) {
    throw authFailedError("bearer", "Token is empty after environment variable substitution");
  }

  return {
    headers: {
      Authorization: `Bearer ${token}`
    },
    cacheable: true
  };
}

/**
 * Resolve API key authentication
 */
async function resolveApiKeyAuth(config: ApiKeyAuthConfig): Promise<AuthResult> {
  const value = substituteEnvVars(config.value);

  if (!value) {
    throw authFailedError("apiKey", "API key is empty after environment variable substitution");
  }

  const result: AuthResult = { cacheable: true };

  switch (config.in) {
    case "header":
      result.headers = { [config.name]: value };
      break;
    case "query":
      result.query = { [config.name]: value };
      break;
    case "cookie":
      result.cookies = { [config.name]: value };
      break;
  }

  return result;
}

/**
 * Resolve basic authentication
 */
async function resolveBasicAuth(config: BasicAuthConfig): Promise<AuthResult> {
  const username = substituteEnvVars(config.username);
  const password = substituteEnvVars(config.password);

  if (!username || !password) {
    throw authFailedError("basic", "Username or password is empty");
  }

  const credentials = Buffer.from(`${username}:${password}`).toString("base64");

  return {
    headers: {
      Authorization: `Basic ${credentials}`
    },
    cacheable: true
  };
}

/**
 * Resolve OAuth2 authentication
 */
async function resolveOAuth2Auth(config: OAuth2AuthConfig): Promise<AuthResult> {
  const clientId = substituteEnvVars(config.clientId);
  const clientSecret = config.clientSecret ? substituteEnvVars(config.clientSecret) : undefined;

  if (!clientId) {
    throw authFailedError("oauth2", "Client ID is empty");
  }

  // For client credentials flow
  if (config.flow === "clientCredentials" && config.tokenUrl) {
    if (!clientSecret) {
      throw authFailedError("oauth2", "Client secret required for client credentials flow");
    }

    // Fetch token from OAuth2 server
    const response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        scope: config.scopes?.join(" ") || ""
      })
    });

    if (!response.ok) {
      throw authFailedError("oauth2", `Token request failed: ${response.statusText}`);
    }

    const data = await response.json() as { access_token: string; expires_in?: number };

    const expiresAt = data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : new Date(Date.now() + 3600000); // Default 1 hour

    return {
      headers: {
        Authorization: `Bearer ${data.access_token}`
      },
      expires: expiresAt,
      cacheable: true
    };
  }

  // Other flows not yet implemented
  throw authFailedError("oauth2", `OAuth2 flow '${config.flow}' not yet implemented`);
}

/**
 * Resolve custom authentication
 */
async function resolveCustomAuth(config: CustomAuthConfig, context: AuthContext): Promise<AuthResult> {
  const resolver = authResolvers.get(config.resolver);

  if (!resolver) {
    throw authFailedError("custom", `Auth resolver '${config.resolver}' not registered`);
  }

  return resolver.resolve(context);
}

/**
 * Generate cache key for auth result
 */
function getCacheKey(source: string, config: AuthConfig): string {
  return `${source}:${config.type}`;
}

/**
 * Main authentication resolver
 *
 * Resolves authentication based on config and returns headers/query/cookies.
 * Results are cached when possible.
 *
 * @example
 * ```typescript
 * const auth = await resolveAuth({
 *   source: "github",
 *   tool: "list_repos",
 *   config: {
 *     type: "bearer",
 *     token: "${GITHUB_TOKEN}"
 *   }
 * });
 *
 * // auth.headers = { Authorization: "Bearer ghp_..." }
 * ```
 */
export async function resolveAuth(context: AuthContext): Promise<AuthResult> {
  const cacheKey = getCacheKey(context.source, context.config);

  // Check cache
  const cached = authCache.get(cacheKey);
  if (cached && cached.expiresAt > new Date()) {
    return cached.result;
  }

  // Substitute environment variables in config
  const config = substituteConfigEnvVars(context.config);

  // Resolve based on type
  let result: AuthResult;

  switch (config.type) {
    case "bearer":
      result = await resolveBearerAuth(config as BearerAuthConfig);
      break;

    case "apiKey":
      result = await resolveApiKeyAuth(config as ApiKeyAuthConfig);
      break;

    case "basic":
      result = await resolveBasicAuth(config as BasicAuthConfig);
      break;

    case "oauth2":
      result = await resolveOAuth2Auth(config as OAuth2AuthConfig);
      break;

    case "custom":
      result = await resolveCustomAuth(config as CustomAuthConfig, context);
      break;

    default:
      throw authFailedError(context.source, `Unknown auth type: ${(config as any).type}`);
  }

  // Cache if cacheable
  if (result.cacheable !== false) {
    const expiresAt = result.expires || new Date(Date.now() + 3600000); // Default 1 hour
    authCache.set(cacheKey, { result, expiresAt });
  }

  return result;
}

/**
 * Refresh authentication
 *
 * Attempts to refresh expired/invalid authentication.
 * Uses custom resolver's refresh() method if available.
 */
export async function refreshAuth(context: AuthContext): Promise<AuthResult> {
  const cacheKey = getCacheKey(context.source, context.config);

  // Clear cache
  authCache.delete(cacheKey);

  // If custom resolver with refresh method
  if (context.config.type === "custom") {
    const customConfig = context.config as CustomAuthConfig;
    const resolver = authResolvers.get(customConfig.resolver);

    if (resolver?.refresh) {
      const result = await resolver.refresh(context);

      // Cache refreshed result
      if (result.cacheable !== false) {
        const expiresAt = result.expires || new Date(Date.now() + 3600000);
        authCache.set(cacheKey, { result, expiresAt });
      }

      return result;
    }
  }

  // OAuth2 with refresh token
  if (context.config.type === "oauth2") {
    const oauth2Config = context.config as OAuth2AuthConfig;

    if (oauth2Config.refreshToken && oauth2Config.tokenUrl) {
      const refreshToken = substituteEnvVars(oauth2Config.refreshToken);
      const clientId = substituteEnvVars(oauth2Config.clientId);
      const clientSecret = oauth2Config.clientSecret
        ? substituteEnvVars(oauth2Config.clientSecret)
        : undefined;

      const response = await fetch(oauth2Config.tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          client_id: clientId,
          ...(clientSecret && { client_secret: clientSecret })
        })
      });

      if (!response.ok) {
        throw authFailedError("oauth2", `Token refresh failed: ${response.statusText}`);
      }

      const data = await response.json() as { access_token: string; expires_in?: number; refresh_token?: string };

      // Update refresh token if provided
      if (data.refresh_token) {
        oauth2Config.refreshToken = data.refresh_token;
      }

      const expiresAt = data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : new Date(Date.now() + 3600000);

      const result: AuthResult = {
        headers: {
          Authorization: `Bearer ${data.access_token}`
        },
        expires: expiresAt,
        cacheable: true
      };

      // Cache refreshed result
      authCache.set(cacheKey, { result, expiresAt });

      return result;
    }
  }

  // Fall back to normal resolution
  return resolveAuth(context);
}

/**
 * Clear auth cache for a specific source
 */
export function clearAuthCache(source?: string): void {
  if (source) {
    // Clear specific source
    for (const key of authCache.keys()) {
      if (key.startsWith(`${source}:`)) {
        authCache.delete(key);
      }
    }
  } else {
    // Clear all
    authCache.clear();
  }
}
