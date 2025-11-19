import { CLIAdapter } from './base';
import { ClaudeCodeAdapter } from './claude_code';
import { AdapterConfig } from '../types';

/**
 * Factory for creating CLI adapters
 */
export class AdapterFactory {
  static create(config: AdapterConfig): CLIAdapter {
    switch (config.type) {
      case 'claude-code':
        return new ClaudeCodeAdapter(config.runtimeDir, config.timeout, config.debug, config.model);
      case 'codex':
        throw new Error('Codex adapter not yet implemented');
      case 'gemini-cli':
        throw new Error('Gemini CLI adapter not yet implemented');
      default:
        throw new Error(`Unknown adapter type: ${config.type}`);
    }
  }
}
