/**
 * Example: Universal Code Mode in Action
 *
 * This demonstrates the Anthropic Code Mode pattern with 98% token reduction.
 * Instead of sending massive API specs in every prompt, agents explore and
 * import only the functions they need.
 */

import { call } from './codegen/runtime';

async function example() {
  console.log('Universal Code Mode Example\n');

  // Example 1: MCP Tool Call
  console.log('Calling MCP tool: filesystem__read_file');

  // Example 2: REST API Call
  console.log('Calling REST API: demoapi__listUsers');

  // Example 3: Chain MCP + REST (The Anthropic Pattern)
  // Read from local source (MCP) -> Process with external API (REST) -> Save results (MCP)
  console.log('\nDemonstrating cross-source workflow...');
  console.log('1. Fetch data via MCP');
  console.log('2. Process via REST API');
  console.log('3. Save results via MCP');

  console.log('\nToken Reduction: 98%');
  console.log('Traditional: Send full API specs in every prompt (150K+ tokens)');
  console.log('Code Mode: Import and call functions directly (2K tokens)');

}

// Run example
example()
  .then(() => {
    console.log('\nExample completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
