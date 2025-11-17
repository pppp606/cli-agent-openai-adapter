import { promisify } from 'util';
import { execFile as execFileCb } from 'child_process';
import { ClaudeCodeAdapter, TimeoutError } from '../adapters/claude_code';
import { Message } from '../types';

// Mock child_process
jest.mock('child_process', () => ({
  execFile: jest.fn(),
}));

// Mock strip-ansi
jest.mock('strip-ansi', () => ({
  __esModule: true,
  default: jest.fn((str: string) => str.replace(/\x1B\[[0-9;]*m/g, '')),
}));

describe('ClaudeCodeAdapter', () => {
  let adapter: ClaudeCodeAdapter;
  const mockExecFile = execFileCb as jest.MockedFunction<typeof execFileCb>;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new ClaudeCodeAdapter('/test/runtime', 30000, false);
  });

  describe('getName', () => {
    it('should return "claude-code"', () => {
      expect(adapter.getName()).toBe('claude-code');
    });
  });

  describe('getModelName', () => {
    it('should return "claude-code"', () => {
      expect(adapter.getModelName()).toBe('claude-code');
    });
  });

  describe('isAvailable', () => {
    it('should return true when claude command is available', async () => {
  mockExecFile.mockImplementation((file, args, options, callback: any) => {
    callback(null, 'claude 1.0.0', '');
    return {} as any;
  });

      const result = await adapter.isAvailable();
      expect(result).toBe(true);
      expect(mockExecFile).toHaveBeenCalledWith(
        'claude',
        ['--version'],
        expect.objectContaining({ timeout: 5000 }),
        expect.any(Function)
      );
    });

    it('should return false when claude command is not available', async () => {
  mockExecFile.mockImplementation((file, args, options, callback: any) => {
    callback(new Error('Command not found'), '', '');
    return {} as any;
  });

      const result = await adapter.isAvailable();
      expect(result).toBe(false);
    });
  });

  describe('execute', () => {
    it('should execute claude with single user message (-p via stdin)', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello!' },
      ];

      mockExecFile.mockImplementation((file, args, options, callback: any) => {
        callback(null, 'Hello! How can I help you?', '');
        return {} as any;
      });

      const result = await adapter.execute(messages);

      expect(result).toBe('Hello! How can I help you?');
      // We now send the prompt via stdin, so args should not include the prompt string
      expect(mockExecFile).toHaveBeenCalledWith(
        'claude',
        [
          '--system-prompt',
          expect.stringContaining('participating in a conversation'),
          '-p',
        ],
        expect.objectContaining({
          cwd: '/test/runtime',
          timeout: 30000,
        }),
        expect.any(Function)
      );
    });

    it('should execute claude with system message (-p via stdin)', async () => {
      const messages: Message[] = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello!' },
      ];

      mockExecFile.mockImplementation((file, args, options, callback: any) => {
        callback(null, 'Hello! How can I help you?', '');
        return {} as any;
      });

      const result = await adapter.execute(messages);

      expect(result).toBe('Hello! How can I help you?');
      expect(mockExecFile).toHaveBeenCalledWith(
        'claude',
        [
          '--system-prompt',
          expect.stringContaining('You are a helpful assistant'),
          '-p',
        ],
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should execute claude code with conversation history', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'My favorite color is blue' },
        { role: 'assistant', content: 'That is nice!' },
        { role: 'user', content: 'What is my favorite color?' },
      ];

      mockExecFile.mockImplementation((file, args, options, callback: any) => {
        callback(null, 'Your favorite color is blue.', '');
        return {} as any;
      });

      const result = await adapter.execute(messages);

      expect(result).toBe('Your favorite color is blue.');

      // Check that conversation history is included
      // With stdin mode, we can't assert the prompt position in args; verify flags only
      const callArgs = mockExecFile.mock.calls[0];
      expect(callArgs?.[1]).toEqual([
        '--system-prompt',
        expect.any(String),
        '-p',
      ]);
    });

    it('should clean ANSI codes from output', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello!' },
      ];

      // Mock output with ANSI codes
      mockExecFile.mockImplementation((file, args, options, callback: any) => {
        callback(null, '\x1B[32mHello!\x1B[0m How can I help?', '');
        return {} as any;
      });

      const result = await adapter.execute(messages);

      expect(result).toBe('Hello! How can I help?');
    });

    it('should throw TimeoutError when execution times out', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello!' },
      ];

      mockExecFile.mockImplementation((file, args, options, callback: any) => {
        const error: any = new Error('Timeout');
        error.killed = true;
        error.signal = 'SIGTERM';
        callback(error, '', '');
        return {} as any;
      });

      await expect(adapter.execute(messages)).rejects.toThrow(TimeoutError);
      await expect(adapter.execute(messages)).rejects.toThrow('Claude Code execution timed out');
    });

    it('should throw error for other execution errors', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello!' },
      ];

      mockExecFile.mockImplementation((file, args, options, callback: any) => {
        callback(new Error('Execution failed'), '', '');
        return {} as any;
      });

      await expect(adapter.execute(messages)).rejects.toThrow('Execution failed');
    });
  });

  describe('debug mode', () => {
    it('should not log when debug is false', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const messages: Message[] = [
        { role: 'user', content: 'Hello!' },
      ];

      mockExecFile.mockImplementation((file, args, options, callback: any) => {
        callback(null, 'Response', '');
        return {} as any;
      });

      await adapter.execute(messages);

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log when debug is true', async () => {
      const debugAdapter = new ClaudeCodeAdapter('/test/runtime', 30000, true);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const messages: Message[] = [
        { role: 'user', content: 'Hello!' },
      ];

      mockExecFile.mockImplementation((file, args, options, callback: any) => {
        callback(null, 'Response', '');
        return {} as any;
      });

      await debugAdapter.execute(messages);

      expect(consoleSpy).toHaveBeenCalledWith('[DEBUG] System Prompt:', expect.any(String));
      expect(consoleSpy).toHaveBeenCalledWith('[DEBUG] User Prompt:', expect.any(String));
      expect(consoleSpy).toHaveBeenCalledWith('[DEBUG] Raw Output:', 'Response');
      consoleSpy.mockRestore();
    });
  });
});
