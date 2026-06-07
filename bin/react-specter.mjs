#!/usr/bin/env node
/**
 * react-specter CLI.
 *
 *   react-specter bridge   — run the local MCP bridge (stdio MCP + HTTP face)
 *   react-specter init     — copy the /apply-edit command template and wire
 *                            .mcp.json in the current project
 */
const cmd = process.argv[2];

const USAGE = `react-specter — select-to-edit for React apps

Usage:
  react-specter bridge        Run the local MCP bridge (used from .mcp.json)
  react-specter init [--force]
                              Set up this project: .claude/commands/apply-edit.md
                              + a "specter" entry in .mcp.json

Docs: https://www.npmjs.com/package/react-specter
`;

if (cmd === 'bridge') {
  await import('../bridge/server.mjs');
} else if (cmd === 'init') {
  const { runInit } = await import('./init.mjs');
  await runInit(process.argv.slice(3));
} else {
  process.stdout.write(USAGE);
  process.exit(cmd ? 1 : 0);
}
