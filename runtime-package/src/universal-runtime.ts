/**
 * Universal Runtime - Stub for package
 * 
 * This will be implemented when integrating the runtime components.
 */

export async function call(toolName: string, params: unknown, options?: any): Promise<unknown> {
  throw new Error("Runtime not yet integrated - use generated wrappers directly");
}

export async function callTyped<TParams, TResult>(
  toolName: string,
  params: TParams,
  options?: any
): Promise<TResult> {
  throw new Error("Runtime not yet integrated - use generated wrappers directly");
}
