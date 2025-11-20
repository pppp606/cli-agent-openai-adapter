import { AdapterFactory } from '../adapters/factory';
import { ClaudeCodeAdapter } from '../adapters/claude_code';
import { GeminiCLIAdapter } from '../adapters/gemini_cli';
import { AdapterConfig } from '../types';

describe('AdapterFactory', () => {
  describe('create', () => {
    it('should create ClaudeCodeAdapter for claude-code type', () => {
      const config: AdapterConfig = {
        type: 'claude-code',
        runtimeDir: '/test/runtime',
        timeout: 30000,
        debug: false,
        model: 'haiku',
      };

      const adapter = AdapterFactory.create(config);

      expect(adapter).toBeInstanceOf(ClaudeCodeAdapter);
      expect(adapter.getName()).toBe('claude-code');
      expect(adapter.getModelName()).toBe('claude-code');
    });

    it('should throw error for codex type (not yet implemented)', () => {
      const config: AdapterConfig = {
        type: 'codex',
        runtimeDir: '/test/runtime',
        timeout: 30000,
        debug: false,
        model: 'haiku',
      };

      expect(() => AdapterFactory.create(config)).toThrow('Codex adapter not yet implemented');
    });

    it('should create GeminiCLIAdapter for gemini-cli type', () => {
      const config: AdapterConfig = {
        type: 'gemini-cli',
        runtimeDir: '/test/runtime',
        timeout: 30000,
        debug: false,
        model: 'gemini-2.5-flash',
      };

      const adapter = AdapterFactory.create(config);

      expect(adapter).toBeInstanceOf(GeminiCLIAdapter);
      expect(adapter.getName()).toBe('gemini-cli');
      expect(adapter.getModelName()).toBe('gemini-cli');
    });

    it('should throw error for unknown adapter type', () => {
      const config: AdapterConfig = {
        type: 'unknown' as any,
        runtimeDir: '/test/runtime',
        timeout: 30000,
        debug: false,
        model: 'haiku',
      };

      expect(() => AdapterFactory.create(config)).toThrow('Unknown adapter type: unknown');
    });
  });
});
