/**
 * Universal Code Mode Example
 * Demonstrates using MCP + REST + GraphQL APIs together
 *
 * Supports:
 * - MCP servers (filesystem, databases, custom tools)
 * - REST APIs (GitHub, Stripe, any OpenAPI spec)
 * - GraphQL APIs (Shopify, GitHub GraphQL, any endpoint)
 *
 * All through one runtime, fully typed, 98% token reduction!
 */

import { call, callTyped } from '../codegen/runtime';

async function main() {
  console.log('=== Universal Code Mode Demo ===\n');

  // Example 1: Call MCP filesystem tool
  console.log('Example 1: MCP Filesystem');
  console.log('-'.repeat(40));
  try {
    const fileContent = await call('filesystem__read_file', {
      path: '/tmp/test.txt'
    });
    console.log('File content:', fileContent);
  } catch (error) {
    console.log('Note: Make sure filesystem MCP server is configured');
  }

  // Example 2: Call GitHub API (REST)
  console.log('\nExample 2: GitHub REST API');
  console.log('-'.repeat(40));
  try {
    const user = await call('github__get_user', {
      path: { username: 'anthropics' }
    });
    console.log('GitHub user:', user.name, '-', user.bio);
  } catch (error) {
    console.log('Note: Set GITHUB_TOKEN environment variable');
  }

  // Example 3: GraphQL API call
  console.log('\nExample 3: GraphQL API');
  console.log('-'.repeat(40));
  try {
    // Example: Shopify products query (configure shopify source first)
    const products = await call('shopify__products', {
      first: 5,
      query: 'tag:featured'
    });
    console.log('Products:', products);
  } catch (error) {
    console.log('Note: Configure a GraphQL source in codegen.config.json');
    console.log('Example GraphQL config:');
    console.log(`  "graphql": {
    "shopify": {
      "type": "graphql",
      "endpoint": "https://your-store.myshopify.com/admin/api/2024-01/graphql.json",
      "auth": { "type": "bearer", "token": "\${SHOPIFY_TOKEN}" }
    }
  }`);
  }

  // Example 4: Typed call
  console.log('\nExample 4: Type-safe calls');
  console.log('-'.repeat(40));
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

  // Example 5: Chaining different sources
  console.log('\nExample 5: Chaining MCP + REST + GraphQL');
  console.log('-'.repeat(40));
  try {
    // Fetch data from REST API
    const repos = await call('github__list_user_repos', {
      path: { username: 'anthropics' },
      query: { sort: 'updated', per_page: 5 }
    });

    // Save to file using MCP
    await call('filesystem__write_file', {
      path: '/tmp/anthropic-repos.json',
      content: JSON.stringify(repos, null, 2)
    });

    console.log('Fetched GitHub repos and saved via MCP filesystem!');
  } catch (error) {
    console.log('Chaining example skipped (configure sources first)');
  }

  console.log('\n' + '='.repeat(50));
  console.log('Summary:');
  console.log('='.repeat(50));
  console.log('- MCP tools:    File operations, databases, custom tools');
  console.log('- REST APIs:    GitHub, Stripe, any OpenAPI spec');
  console.log('- GraphQL APIs: Shopify, GitHub GraphQL, any endpoint');
  console.log('- One runtime, fully typed, 98% token reduction');
  console.log('\nThis is Universal Code Mode!');
}

main().catch(console.error);
