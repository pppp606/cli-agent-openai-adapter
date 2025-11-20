import { AdapterConfig } from './types';
import path from 'path';

/**
 * Load configuration from environment variables or use defaults
 */
export function loadConfig(): AdapterConfig {
  const adapterType = (process.env.ADAPTER_TYPE || 'claude-code') as AdapterConfig['type'];

  // Set default runtime directory based on adapter type
  let defaultRuntimeDir: string;
  let defaultModel: string;

  switch (adapterType) {
    case 'gemini-cli':
      defaultRuntimeDir = path.join(__dirname, '..', 'runtime', 'gemini-cli');
      defaultModel = 'gemini-2.5-flash';
      break;
    case 'claude-code':
    default:
      defaultRuntimeDir = path.join(__dirname, '..', 'runtime', 'claude-code');
      defaultModel = 'haiku';
      break;
  }

  const runtimeDir = process.env.RUNTIME_DIR || defaultRuntimeDir;
  const timeout = parseInt(process.env.TIMEOUT || '30000', 10);
  const debug = process.env.DEBUG === 'true';
  const model = process.env.MODEL || defaultModel;

  return {
    type: adapterType,
    runtimeDir,
    timeout,
    debug,
    model,
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
