import { AdapterConfig } from './types';
import path from 'path';

/**
 * Load configuration from environment variables or use defaults
 */
export function loadConfig(): AdapterConfig {
  const adapterType = (process.env.ADAPTER_TYPE || 'claude-code') as AdapterConfig['type'];
  const runtimeDir = process.env.RUNTIME_DIR || path.join(__dirname, '..', 'runtime', 'claude-code');
  const timeout = parseInt(process.env.TIMEOUT || '30000', 10);
  const debug = process.env.DEBUG === 'true';

  return {
    type: adapterType,
    runtimeDir,
    timeout,
    debug,
  };
}

/**
 * Server configuration
 */
export interface ServerConfig {
  port: number;
  host: string;
}

export function loadServerConfig(): ServerConfig {
  return {
    port: parseInt(process.env.PORT || '8000', 10),
    host: process.env.HOST || 'localhost',
  };
}
