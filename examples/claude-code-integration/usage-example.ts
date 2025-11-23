/**
 * Example: How Claude Code Uses mcp-codegen
 *
 * This shows what Claude Code can do once you've set up mcp-codegen.
 * Claude Code automatically discovers your API wrappers and can use them
 * just like regular TypeScript functions.
 */

import { call, callTyped } from "./codegen/runtime";

async function analyzeGitHubOrganization(orgName: string) {
  console.log(`Analyzing GitHub organization: ${orgName}\n`);

  try {
    // Step 1: Fetch organization repositories
    console.log("Fetching repositories...");
    const repos = await call("github__list_org_repos", {
      path: { org: orgName },
      query: { sort: "stars", per_page: 10 }
    });

    // Step 2: Analyze the data
    console.log(`Found ${repos.length} repositories\n`);

    const analysis = repos.map((repo: any) => ({
      name: repo.name,
      description: repo.description || "No description",
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      language: repo.language || "Unknown",
      updated: repo.updated_at
    }));

    // Step 3: Create summary report
    const report = {
      organization: orgName,
      analyzedAt: new Date().toISOString(),
      totalRepos: repos.length,
      topRepos: analysis,
      summary: {
        totalStars: analysis.reduce((sum: number, r: any) => sum + r.stars, 0),
        totalForks: analysis.reduce((sum: number, r: any) => sum + r.forks, 0),
        languages: [...new Set(analysis.map((r: any) => r.language))]
      }
    };

    // Step 4: Save report using MCP filesystem
    console.log("Saving report...");
    await call("filesystem__write_file", {
      path: `/tmp/${orgName}-analysis.json`,
      content: JSON.stringify(report, null, 2)
    });

    console.log(`\n✓ Report saved to /tmp/${orgName}-analysis.json`);
    console.log(`\nSummary:`);
    console.log(`- Total stars: ${report.summary.totalStars}`);
    console.log(`- Total forks: ${report.summary.totalForks}`);
    console.log(`- Languages: ${report.summary.languages.join(", ")}`);

    // Step 5: Read it back to verify
    const savedReport = await call("filesystem__read_file", {
      path: `/tmp/${orgName}-analysis.json`
    });

    console.log(`\n✓ Verified: Report successfully saved and readable`);

    return report;

  } catch (error: any) {
    console.error("Error:", error.message);
    console.error("\nMake sure:");
    console.error("1. GITHUB_TOKEN environment variable is set");
    console.error("2. MCP filesystem server is configured");
    console.error("3. Wrappers were generated: mcp-codegen quickstart");
    throw error;
  }
}

// Example usage
async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  Claude Code + mcp-codegen Integration Demo");
  console.log("═══════════════════════════════════════════════════\n");

  console.log("This demonstrates what Claude Code can do with");
  console.log("mcp-codegen's Universal Code Mode:\n");
  console.log("✓ Access 1,100+ API endpoints");
  console.log("✓ Type-safe function calls");
  console.log("✓ Mix MCP + REST in same script");
  console.log("✓ 99.93% token reduction\n");

  console.log("═══════════════════════════════════════════════════\n");

  // Run analysis
  await analyzeGitHubOrganization("anthropics");

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  Token Reduction Benefits");
  console.log("═══════════════════════════════════════════════════\n");

  console.log("Traditional MCP Approach:");
  console.log("  - Claude receives 1,108 tool definitions");
  console.log("  - 205,658 tokens per request");
  console.log("  - Full JSON schemas in every prompt\n");

  console.log("With mcp-codegen (Code Mode):");
  console.log("  - Claude receives .agent-ready.json");
  console.log("  - 139 tokens per request");
  console.log("  - Imports functions like normal TypeScript\n");

  console.log("Savings: 99.93% reduction = $0.62 per session\n");
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { analyzeGitHubOrganization };
