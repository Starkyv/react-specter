/**
 * react-specter — local MCP bridge, runnable entry.
 * Spawned per-session by the agent (`npx react-specter bridge` in .mcp.json);
 * the same process serves the overlay's HTTP POST. Nothing to start manually;
 * the process — and any queued selection — dies with the session.
 *
 * Port override: SPECTER_BRIDGE_PORT (keep the overlay's bridgeUrl in sync).
 */
import { createRequire } from 'node:module';

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createBridge } from './core.mjs';

const PORT = Number(process.env.SPECTER_BRIDGE_PORT) || 7331;
const HOST = '127.0.0.1';

const log = (...args) => console.error('[specter-bridge]', ...args);

const { version } = createRequire(import.meta.url)('../package.json');

const bridge = createBridge({ port: PORT, version, log });
bridge.httpServer.listen(PORT, HOST);

await bridge.mcpServer.connect(new StdioServerTransport());
log('MCP stdio connected');
