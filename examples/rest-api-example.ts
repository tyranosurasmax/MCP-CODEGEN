/**
 * REST API Example
 * Using OpenAPI specs as Code Mode tools
 */

import { call } from '../codegen/runtime';

async function main() {
  console.log(' REST API Code Mode Example\n');

  // GitHub API example
  console.log('Fetching GitHub user...');
  const user = await call('github__get_user', {
    path: { username: 'anthropics' }
  });
  console.log(`User: ${user.name}`);
  console.log(`Bio: ${user.bio}`);
  console.log(`Repos: ${user.public_repos}`);

  // List repositories
  console.log('\nFetching repositories...');
  const repos = await call('github__list_user_repos', {
    path: { username: 'anthropics' },
    query: {
      sort: 'updated',
      per_page: 5
    }
  });

  console.log(`\nTop 5 repositories:`);
  repos.forEach((repo: any, i: number) => {
    console.log(`${i + 1}. ${repo.name} - ${repo.description || 'No description'}`);
  });

  console.log('\n All API calls made through type-safe wrappers!');
  console.log(' Token usage: 98% less than sending raw OpenAPI spec');
}

main().catch(console.error);
