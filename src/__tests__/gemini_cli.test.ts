import { GeminiCLIAdapter, TimeoutError } from '../adapters/gemini_cli';
import { Message } from '../types';
import * as childProcess from 'child_process';
import * as util from 'util';

// Mock child_process
jest.mock('child_process');

// Mock strip-ansi
jest.mock('strip-ansi', () => ({
  __esModule: true,
  default: jest.fn((str: string) => str ? str.replace(/\x1B\[[0-9;]*m/g, '') : ''),
}));

describe.skip('GeminiCLIAdapter', () => {
  let adapter: GeminiCLIAdapter;
  let mockExecFile: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create a mock for execFile that returns a function mimicking promisify behavior
    mockExecFile = jest.fn();
    jest.spyOn(util, 'promisify').mockReturnValue(mockExecFile as any);

    adapter = new GeminiCLIAdapter('/test/runtime', 30000, false, 'gemini-2.5-flash');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getName', () => {
    it('should return "gemini-cli"', () => {
      expect(adapter.getName()).toBe('gemini-cli');
    });
  });

  describe('getModelName', () => {
    it('should return "gemini-cli"', () => {
      expect(adapter.getModelName()).toBe('gemini-cli');
    });
  });

  describe('isAvailable', () => {
    it('should return true when gemini --version succeeds', async () => {
      mockExecFile.mockResolvedValueOnce({ stdout: 'gemini 1.0.0', stderr: '' });

      const result = await adapter.isAvailable();
      expect(result).toBe(true);
    });

    it('should fallback to -p test when --version fails', async () => {
      mockExecFile
        .mockRejectedValueOnce(new Error('Command not found'))
        .mockResolvedValueOnce({ stdout: 'Hello!', stderr: '' });

      const result = await adapter.isAvailable();
      expect(result).toBe(true);
    });

    it('should return false when gemini command is not available', async () => {
      mockExecFile
        .mockRejectedValueOnce(new Error('Command not found'))
        .mockRejectedValueOnce(new Error('Command not found'));

      const result = await adapter.isAvailable();
      expect(result).toBe(false);
    });
  });

  describe('execute', () => {
    it('should execute gemini with single user message', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello!' },
      ];

      mockExecFile.mockResolvedValueOnce({
        stdout: 'Hello! How can I help you?',
        stderr: '',
      });

      const result = await adapter.execute(messages);

      expect(result).toBe('Hello! How can I help you?');
      expect(mockExecFile).toHaveBeenCalledWith(
        'gemini',
        [
          '-m',
          'gemini-2.5-flash',
          '-p',
          expect.any(String),
          '--output-format',
          'json',
        ],
        expect.objectContaining({
          cwd: '/test/runtime',
          timeout: 30000,
        })
      );
    });

    it('should execute gemini with system message', async () => {
      const messages: Message[] = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello!' },
      ];

      mockExecFile.mockResolvedValueOnce({
        stdout: 'Hello! How can I help you?',
        stderr: '',
      });

      const result = await adapter.execute(messages);

      expect(result).toBe('Hello! How can I help you?');
      const callArgs = mockExecFile.mock.calls[0];
      const prompt = callArgs?.[1]?.[3] as string;
      expect(prompt).toContain('You are a helpful assistant');
    });

    it('should execute gemini with conversation history', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'My favorite color is blue' },
        { role: 'assistant', content: 'That is nice!' },
        { role: 'user', content: 'What is my favorite color?' },
      ];

      mockExecFile.mockResolvedValueOnce({
        stdout: 'Your favorite color is blue.',
        stderr: '',
      });

      const result = await adapter.execute(messages);

      expect(result).toBe('Your favorite color is blue.');

      // Check that conversation history is included in the prompt
      const callArgs = mockExecFile.mock.calls[0];
      const prompt = callArgs?.[1]?.[3] as string;
      expect(prompt).toContain('Conversation history');
      expect(prompt).toContain('My favorite color is blue');
    });

    it('should parse JSON response from Gemini API format', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello!' },
      ];

      const jsonResponse = JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                { text: 'Hello! How can I help you?' },
              ],
            },
          },
        ],
      });

      mockExecFile.mockResolvedValueOnce({
        stdout: jsonResponse,
        stderr: '',
      });

      const result = await adapter.execute(messages);

      expect(result).toBe('Hello! How can I help you?');
    });

    it('should handle simple text JSON response', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello!' },
      ];

      const jsonResponse = JSON.stringify({
        text: 'Hello! How can I help you?',
      });

      mockExecFile.mockResolvedValueOnce({
        stdout: jsonResponse,
        stderr: '',
      });

      const result = await adapter.execute(messages);

      expect(result).toBe('Hello! How can I help you?');
    });

    it('should handle plain text response when JSON parsing fails', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello!' },
      ];

      mockExecFile.mockResolvedValueOnce({
        stdout: 'Hello! How can I help you?',
        stderr: '',
      });

      const result = await adapter.execute(messages);

      expect(result).toBe('Hello! How can I help you?');
    });

    it('should clean ANSI codes from output', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello!' },
      ];

      mockExecFile.mockResolvedValueOnce({
        stdout: '\x1B[32mHello!\x1B[0m How can I help?',
        stderr: '',
      });

      const result = await adapter.execute(messages);

      expect(result).toBe('Hello! How can I help?');
    });

    it('should throw TimeoutError when execution times out', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello!' },
      ];

      const error: any = new Error('Timeout');
      error.killed = true;
      error.signal = 'SIGTERM';
      mockExecFile.mockRejectedValueOnce(error);

      await expect(adapter.execute(messages)).rejects.toThrow(TimeoutError);
    });

    it('should throw error for other execution errors', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello!' },
      ];

      mockExecFile.mockRejectedValueOnce(new Error('Execution failed'));

      await expect(adapter.execute(messages)).rejects.toThrow('Execution failed');
    });
  });

  describe('debug mode', () => {
    it('should not log when debug is false', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const messages: Message[] = [
        { role: 'user', content: 'Hello!' },
      ];

      mockExecFile.mockResolvedValueOnce({
        stdout: 'Response',
        stderr: '',
      });

      await adapter.execute(messages);

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log when debug is true', async () => {
      const debugAdapter = new GeminiCLIAdapter('/test/runtime', 30000, true, 'gemini-2.5-flash');
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const messages: Message[] = [
        { role: 'user', content: 'Hello!' },
      ];

      mockExecFile.mockResolvedValueOnce({
        stdout: 'Response',
        stderr: '',
      });

      await debugAdapter.execute(messages);

      expect(consoleSpy).toHaveBeenCalledWith('[DEBUG] Gemini Prompt:', expect.any(String));
      expect(consoleSpy).toHaveBeenCalledWith('[DEBUG] Raw Output:', 'Response');
      consoleSpy.mockRestore();
    });
  });

  describe('model configuration', () => {
    it('should use specified model in execute command', async () => {
      const proAdapter = new GeminiCLIAdapter('/test/runtime', 30000, false, 'gemini-2.5-pro');
      const messages: Message[] = [
        { role: 'user', content: 'Hello!' },
      ];

      mockExecFile.mockResolvedValueOnce({
        stdout: 'Response',
        stderr: '',
      });

      await proAdapter.execute(messages);

      expect(mockExecFile).toHaveBeenCalledWith(
        'gemini',
        expect.arrayContaining(['-m', 'gemini-2.5-pro']),
        expect.any(Object)
      );
    });
  });
});
