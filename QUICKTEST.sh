#!/bin/bash
# Quick verification script for mcp-codegen

set -e

echo "╔═══════════════════════════════════════════════════╗"
echo "║   MCP-CODEGEN Quick Verification Test           ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""

# Check Node.js version
echo "→ Checking Node.js version..."
node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$node_version" -lt 18 ]; then
  echo "✗ Node.js version must be 18 or higher (found: $(node --version))"
  exit 1
fi
echo " Node.js $(node --version)"
echo ""

# Build
echo "→ Building project..."
npm run build > /dev/null 2>&1
if [ -f "dist/cli.js" ]; then
  echo " Build successful"
else
  echo "✗ Build failed - dist/cli.js not found"
  exit 1
fi
echo ""

# Clean previous run
echo "→ Cleaning previous generated files..."
rm -rf .agent-ready.json codegen/ > /dev/null 2>&1
echo " Cleaned"
echo ""

# Run quickstart
echo "→ Running quickstart..."
output=$(node dist/cli.js quickstart 2>&1)

# Check for success indicators
if echo "$output" | grep -q "CODE MODE ACTIVATED"; then
  echo " Quickstart completed"
else
  echo "✗ Quickstart failed"
  echo "$output"
  exit 1
fi
echo ""

# Verify files
echo "→ Verifying generated files..."

if [ ! -f ".agent-ready.json" ]; then
  echo "✗ Missing .agent-ready.json"
  exit 1
fi
echo "   .agent-ready.json"

if [ ! -f "codegen/runtime/index.ts" ]; then
  echo "✗ Missing codegen/runtime/index.ts"
  exit 1
fi
echo "   Runtime"

if [ ! -d "codegen/mcp/filesystem" ]; then
  echo "✗ Missing MCP wrappers"
  exit 1
fi
echo "   MCP wrappers"

if [ ! -d "codegen/openapi/demoapi" ]; then
  echo "✗ Missing REST wrappers"
  exit 1
fi
echo "   REST wrappers"

echo ""

# Check token reduction
echo "→ Checking token reduction..."
reduction=$(cat .agent-ready.json | grep -o '"savings": "[^"]*"' | cut -d'"' -f4)
echo "  Token reduction: $reduction"

tools=$(cat .agent-ready.json | grep '"total":' | head -1 | grep -o '[0-9]*')
echo "  Tools generated: $tools"

echo ""
echo "╔═══════════════════════════════════════════════════╗"
echo "║    ALL TESTS PASSED                            ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "  1. cat .agent-ready.json    - View discovery manifest"
echo "  2. cat SETUP.md             - Read setup guide"
echo "  3. cat TESTING.md           - Full testing guide"
echo ""
echo "Ready for Claude Code integration!"
