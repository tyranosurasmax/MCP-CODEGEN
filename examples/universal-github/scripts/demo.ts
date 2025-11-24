#!/usr/bin/env tsx
/**
 * Universal Demo: MCP + REST API
 *
 * This demo shows how to use both MCP tools (filesystem) and REST APIs (GitHub)
 * through a single unified interface.
 */

import { call } from "@mcp-codegen/runtime";

async function main() {
  console.log("🚀 MCP-CODEGEN Universal Demo\n");

  // Example 1: Call GitHub REST API
  console.log("📦 Fetching Anthropic's public repositories...");
  try {
    const repos = await call("github__repos_list_for_user", {
      path: { username: "anthropics" },
      query: { per_page: 5, sort: "updated" }
    });

    console.log(`✅ Found ${repos.length} repositories (showing first 5):\n`);

    repos.forEach((repo: any, index: number) => {
      console.log(`${index + 1}. ${repo.name}`);
      console.log(`   ⭐ ${repo.stargazers_count} stars | 🔀 ${repo.forks_count} forks`);
      console.log(`   📝 ${repo.description || 'No description'}`);
      console.log(`   🔗 ${repo.html_url}\n`);
    });
  } catch (error: any) {
    console.error("❌ GitHub API Error:", error.message);
    console.log("💡 Tip: Set GITHUB_TOKEN environment variable for higher rate limits\n");
  }

  // Example 2: Call MCP filesystem tool
  console.log("📁 Using MCP filesystem to write data...");
  try {
    const tempFile = "/tmp/anthropic-repos.txt";

    await call("filesystem__write_file", {
      path: tempFile,
      content: "MCP-CODEGEN Demo Output\n======================\n\nSuccessfully called both:\n- GitHub REST API (1,100+ tools)\n- MCP Filesystem Server\n\nAll through one universal interface! 🎉"
    });

    console.log(`✅ Wrote to ${tempFile}`);

    // Read it back
    const content = await call("filesystem__read_file", {
      path: tempFile
    });

    console.log(`✅ Read back content:\n`);
    console.log(content);
  } catch (error: any) {
    console.error("❌ MCP Error:", error.message);
    console.log("💡 Tip: Make sure the MCP filesystem server is running\n");
  }

  console.log("\n✨ Demo complete!");
  console.log("📚 Check out the generated wrappers in ./codegen/");
  console.log("🔧 Modify codegen.config.json to add more sources");
}

main().catch((error) => {
  console.error("❌ Demo failed:", error);
  process.exit(1);
});
