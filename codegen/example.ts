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

  console.log('No tools generated yet.');
  console.log('Run: codegen sync');

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
