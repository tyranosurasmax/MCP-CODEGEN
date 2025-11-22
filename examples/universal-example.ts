/**
 * Universal Code Mode Example
 * Demonstrates using MCP + REST APIs together
 */

import { call, callTyped } from '../codegen/runtime';

async function main() {
  console.log(' Universal Code Mode Demo\n');

  // Example 1: Call MCP filesystem tool
  console.log(' Example 1: MCP Filesystem');
  try {
    const fileContent = await call('filesystem__read_file', {
      path: '/tmp/test.txt'
    });
    console.log('File content:', fileContent);
  } catch (error) {
    console.log('Note: Make sure filesystem MCP server is configured');
  }

  // Example 2: Call GitHub API (REST)
  console.log('\n Example 2: GitHub REST API');
  try {
    const user = await call('github__get_user', {
      path: { username: 'anthropics' }
    });
    console.log('GitHub user:', user.name, '-', user.bio);
  } catch (error) {
    console.log('Note: Set GITHUB_TOKEN environment variable');
  }

  // Example 3: Typed call
  console.log('\n Example 3: Type-safe calls');
  interface GitHubUser {
    login: string;
    name: string;
    bio: string;
    public_repos: number;
  }

  try {
    const user = await callTyped<{ path: { username: string } }, GitHubUser>(
      'github__get_user',
      { path: { username: 'anthropics' } }
    );
    console.log(`${user.name} has ${user.public_repos} public repos`);
  } catch (error) {
    console.log('Skipping typed example');
  }

  // Example 4: Chaining different sources
  console.log('\n Example 4: Chaining MCP + REST');
  try {
    // Fetch data from API
    const repos = await call('github__list_user_repos', {
      path: { username: 'anthropics' },
      query: { sort: 'updated', per_page: 5 }
    });

    // Save to file using MCP
    await call('filesystem__write_file', {
      path: '/tmp/anthropic-repos.json',
      content: JSON.stringify(repos, null, 2)
    });

    console.log(' Fetched GitHub repos and saved via MCP filesystem!');
  } catch (error) {
    console.log('Chaining example skipped');
  }

  console.log('\nSummary:');
  console.log('- MCP tools: File operations, databases, custom tools');
  console.log('- REST APIs: GitHub, Stripe, any OpenAPI spec');
  console.log('- All through one runtime, fully typed, 98% token reduction');
  console.log('\nThis is Universal Code Mode!');
}

main().catch(console.error);
