import type http from 'node:http';

export interface BridgeOptions {
  port?: number;
  version?: string;
  log?: (...args: unknown[]) => void;
}

export interface Bridge {
  httpServer: http.Server;
  mcpServer: { connect(transport: unknown): Promise<void> };
  getPending(): { payload: unknown; queuedAt: string } | null;
  clearPending(): void;
  isHttpActive(): boolean;
}

export function createBridge(options?: BridgeOptions): Bridge;
