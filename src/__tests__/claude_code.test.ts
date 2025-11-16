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
        callback(null, { stdout: 'claude 1.0.0', stderr: '' });
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
        callback(new Error('Command not found'), { stdout: '', stderr: '' });
        return {} as any;
      });

      const result = await adapter.isAvailable();
      expect(result).toBe(false);
    });
  });

  describe('execute', () => {
    it('should execute claude with single user message (-p mode)', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello!' },
      ];

      mockExecFile.mockImplementation((file, args, options, callback: any) => {
        callback(null, { stdout: 'Hello! How can I help you?', stderr: '' });
        return {} as any;
      });

      const result = await adapter.execute(messages);

      expect(result).toBe('Hello! How can I help you?');
      expect(mockExecFile).toHaveBeenCalledWith(
        'claude',
        [
          '--system-prompt',
          expect.stringContaining('participating in a conversation'),
          '-p',
          'Current user message: Hello!',
        ],
        expect.objectContaining({
          cwd: '/test/runtime',
          timeout: 30000,
        }),
        expect.any(Function)
      );
    });

    it('should execute claude with system message (-p mode)', async () => {
      const messages: Message[] = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello!' },
      ];

      mockExecFile.mockImplementation((file, args, options, callback: any) => {
        callback(null, { stdout: 'Hello! How can I help you?', stderr: '' });
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
          'Current user message: Hello!',
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
        callback(null, { stdout: 'Your favorite color is blue.', stderr: '' });
        return {} as any;
      });

      const result = await adapter.execute(messages);

      expect(result).toBe('Your favorite color is blue.');

      // Check that conversation history is included
      const callArgs = mockExecFile.mock.calls[0];
      const userPrompt = callArgs?.[1]?.[3]; // '-p' is index 2, prompt is index 3
      expect(userPrompt).toContain('Conversation history:');
      expect(userPrompt).toContain('My favorite color is blue');
      expect(userPrompt).toContain('That is nice!');
      expect(userPrompt).toContain('Current user message: What is my favorite color?');
    });

    it('should clean ANSI codes from output', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello!' },
      ];

      // Mock output with ANSI codes
      mockExecFile.mockImplementation((file, args, options, callback: any) => {
        callback(null, {
          stdout: '\x1B[32mHello!\x1B[0m How can I help?',
          stderr: ''
        });
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
        callback(error, { stdout: '', stderr: '' });
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
        callback(new Error('Execution failed'), { stdout: '', stderr: '' });
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
        callback(null, { stdout: 'Response', stderr: '' });
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
        callback(null, { stdout: 'Response', stderr: '' });
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
