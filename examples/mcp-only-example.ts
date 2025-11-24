/**
 * MCP-Only Example
 * Traditional MCP server usage
 */

import { call } from '../codegen/runtime';

async function main() {
  console.log(' MCP Code Mode Example\n');

  // Read a file
  const content = await call('filesystem__read_file', {
    path: '/tmp/example.txt'
  });
  console.log('File content:', content);

  // List files
  const files = await call('filesystem__list_directory', {
    path: '/tmp'
  });
  console.log('Files:', files);

  // Write a file
  await call('filesystem__write_file', {
    path: '/tmp/output.txt',
    content: 'Hello from Code Mode!'
  });
  console.log(' File written successfully');
}

main().catch(console.error);
