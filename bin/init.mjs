/**
 * react-specter init — one-time project setup, run from the project root:
 *  1. copies templates/apply-edit.md → .claude/commands/apply-edit.md
 *  2. adds a "specter" server to .mcp.json (creates the file if missing)
 *
 * Idempotent; refuses to overwrite an existing apply-edit.md without --force.
 */
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TEMPLATES_DIR = fileURLToPath(new URL('../templates/', import.meta.url));

const MCP_ENTRY = { command: 'npx', args: ['react-specter', 'bridge'] };

export async function runInit(argv = []) {
  const force = argv.includes('--force');
  const cwd = process.cwd();
  const summary = [];

  // 1. /apply-edit command template
  const commandDest = path.join(cwd, '.claude', 'commands', 'apply-edit.md');
  if (existsSync(commandDest) && !force) {
    summary.push(`skipped  ${rel(commandDest)} (exists — use --force to overwrite)`);
  } else {
    await mkdir(path.dirname(commandDest), { recursive: true });
    await copyFile(path.join(TEMPLATES_DIR, 'apply-edit.md'), commandDest);
    summary.push(`wrote    ${rel(commandDest)}`);
  }

  // 2. .mcp.json
  const mcpPath = path.join(cwd, '.mcp.json');
  if (!existsSync(mcpPath)) {
    await writeFile(mcpPath, `${JSON.stringify({ mcpServers: { specter: MCP_ENTRY } }, null, 2)}\n`);
    summary.push(`wrote    ${rel(mcpPath)}`);
  } else {
    try {
      const config = JSON.parse(await readFile(mcpPath, 'utf-8'));
      config.mcpServers ??= {};
      if (config.mcpServers.specter && !force) {
        summary.push(`skipped  ${rel(mcpPath)} ("specter" entry exists)`);
      } else {
        config.mcpServers.specter = MCP_ENTRY;
        await writeFile(mcpPath, `${JSON.stringify(config, null, 2)}\n`);
        summary.push(`updated  ${rel(mcpPath)} (added "specter" server)`);
      }
    } catch {
      summary.push(`SKIPPED  ${rel(mcpPath)} — could not parse it. Add this entry manually:`);
      summary.push(`         "specter": ${JSON.stringify(MCP_ENTRY)}`);
    }
  }

  console.log(['react-specter init', '', ...summary, '', 'Next steps:'].join('\n'));
  console.log(
    [
      '  1. Wire the annotation plugin into your bundler (see the README):',
      "       Vite:    plugins: [specter(), react()]   — from 'react-specter/vite'",
      "       Next.js: export default withSpecter(cfg) — from 'react-specter/next'",
      '  2. Mount the overlay in your client entry (dev only):',
      "       import('react-specter').then(m => m.mountSpecter());",
      '  3. Restart your agent session so it picks up the new MCP server,',
      '     then: select an element in the browser → Send → /apply-edit.',
    ].join('\n')
  );

  function rel(p) {
    return path.relative(cwd, p);
  }
}
