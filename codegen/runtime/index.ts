// Universal Runtime re-export
// This allows wrappers to use a local import path

export {
  call,
  callTyped,
  getAdapter,
  discoverAll,
  UniversalRuntime,
  getRuntime,
  // Legacy MCP API
  callMCPTool,
  callMCPToolTyped,
  getClient
} from 'codegen/runtime/universal-runtime';
