import { promisify } from 'util';
import { execFile as execFileCb } from 'child_process';
import stripAnsi from 'strip-ansi';
import { CLIAdapter } from './base';
import { Message } from '../types';

const execFile = promisify(execFileCb);

/**
 * System prompt for conversation context understanding
 */
const CONVERSATION_SYSTEM_PROMPT = `You are participating in a conversation. When conversation history is provided in JSON format, use it to understand the context and respond appropriately to the current user message.`;

/**
 * Custom error for timeout
 */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Claude Code adapter implementation
 *
 * Note: This adapter assumes:
 * - 'claude' command is available in PATH
 * - 'claude code' subcommand accepts --system-prompt and -p options
 * - Output is returned to stdout
 * - Tools are disabled in .claude/settings.json for chat-like behavior
 */
export class ClaudeCodeAdapter extends CLIAdapter {
  private runtimeDir: string;
  private timeout: number;
  private debug: boolean;

  constructor(runtimeDir: string, timeout: number = 30000, debug: boolean = false) {
    super();
    this.runtimeDir = runtimeDir;
    this.timeout = timeout;
    this.debug = debug;
  }

  getName(): string {
    return 'claude-code';
  }

  getModelName(): string {
    return 'claude-code';
  }

  async isAvailable(): Promise<boolean> {
    try {
      await execFile('claude', ['--version'], { timeout: 5000 });
      return true;
    } catch (error) {
      return false;
    }
  }

  async execute(messages: Message[]): Promise<string> {
    const { systemPrompt, userPrompt } = this.buildClaudeCodeCommand(messages);

    const t0 = Date.now();

    if (this.debug) {
      console.log('[DEBUG] System Prompt:', systemPrompt);
      console.log('[DEBUG] User Prompt:', userPrompt);
    }

    const commonOpts = {
      cwd: this.runtimeDir,
      timeout: this.timeout,
      maxBuffer: 10 * 1024 * 1024, // 10MB
    } as const;

    // Primary invocation: current CLI (non-interactive):
    // `claude --system-prompt <system> -p <userPrompt>`
    try {
      if (this.debug) {
        console.log('[DEBUG] Exec command (stdin mode):', 'claude', '--system-prompt', quote(summarize(systemPrompt)), '-p');
        console.log('[DEBUG] Prompt (stdin):', quote(summarize(userPrompt)));
      }

      // Use stdin to pass the user prompt to avoid any quoting ambiguity
      const result = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
        const child = execFileCb(
          'claude',
          ['--system-prompt', systemPrompt, '-p'],
          commonOpts as any,
          (err, stdout, stderr) => {
            if (err) {
              (err as any).stderr = stderr;
              reject(err);
            } else {
              resolve({ stdout: stdout as any, stderr: stderr as any });
            }
          }
        );

        if (child.stdin) {
          child.stdin.write(userPrompt);
          child.stdin.end();
        }
      });

      if (this.debug) {
        console.log('[DEBUG] Raw Output:', result.stdout);
        console.log('[DEBUG] Duration (ms):', Date.now() - t0);
      }

      return this.cleanOutput(result.stdout);
    } catch (error: any) {
      // If timed out, surface as timeout
      if (error.killed && error.signal === 'SIGTERM') {
        throw new TimeoutError('Claude Code execution timed out');
      }
      if (this.debug) {
        const stderr: string = (error && error.stderr) || '';
        console.warn('[DEBUG] Invocation failed. stderr:', stderr);
      }
      // Rethrow original error
      throw error;
    }
  }

  /**
   * Build system prompt and user prompt from message history
   *
   * Strategy:
   * 1. Extract system message if present
   * 2. Combine with conversation context instruction
   * 3. Format conversation history as JSON
   * 4. Append current user message
   */
  private buildClaudeCodeCommand(messages: Message[]): {
    systemPrompt: string;
    userPrompt: string;
  } {
    // Extract system message
    const systemMsg = messages.find((m) => m.role === 'system');
    const baseSystemPrompt = systemMsg?.content || '';

    // Build system prompt
    const systemPrompt = baseSystemPrompt
      ? `${baseSystemPrompt}\n\n${CONVERSATION_SYSTEM_PROMPT}`
      : CONVERSATION_SYSTEM_PROMPT;

    // Build user prompt with conversation history
    let userPrompt = '';

    // Get conversation messages (exclude system)
    const conversationMessages = messages.filter((m) => m.role !== 'system');

    // If there's conversation history (more than 1 message)
    if (conversationMessages.length > 1) {
      const history = conversationMessages.slice(0, -1);
      userPrompt += `Conversation history:\n${JSON.stringify(history, null, 2)}\n\n`;
    }

    // Add current user message
    const latestMsg = conversationMessages[conversationMessages.length - 1];
    if (latestMsg) {
      userPrompt += `Current user message: ${latestMsg.content}`;
    }

    return { systemPrompt, userPrompt };
  }

  /**
   * Clean output from Claude Code CLI
   * Removes:
   * - ANSI color codes
   * - Progress indicators
   * - Extra whitespace
   */
  private cleanOutput(stdout: string): string {
    let cleaned = stripAnsi(stdout);

    // Remove common progress indicators
    cleaned = cleaned.replace(/^.*\r/gm, ''); // Remove lines ending with \r (carriage return)
    cleaned = cleaned.replace(/^\s*[\[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏\]]/gm, ''); // Remove spinner characters

    // Trim and normalize whitespace
    cleaned = cleaned.trim();

    return cleaned;
  }

}

/**
 * Summarize long prompts in debug logs to keep output readable
 */
function summarize(text: string, max = 80): string {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? clean.slice(0, max) + '…' : clean;
}

function quote(s: string): string {
  // Use JSON stringify to show quotes safely in logs
  return JSON.stringify(s);
}
