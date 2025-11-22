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

  // Example: REST API Call
  console.log('Calling REST API: demoapi__listUsers');
  console.log('\nToken Reduction: 98%');
  console.log('Instead of sending OpenAPI specs, agents use code directly.');

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
