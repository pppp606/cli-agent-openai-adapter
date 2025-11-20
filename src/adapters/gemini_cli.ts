import { promisify } from 'util';
import { execFile as execFileCb } from 'child_process';
import stripAnsi from 'strip-ansi';
import { CLIAdapter } from './base';
import { Message } from '../types';

const execFile = promisify(execFileCb);

/**
 * System prompt for conversation context understanding
 *
 * Goal: make Gemini CLI behave like a neutral, generic LLM
 * without tool- or coding-assistant specific introductions.
 */
const CONVERSATION_SYSTEM_PROMPT = `You are a generic, domain-agnostic AI assistant.

Identity and scope:
- Do not identify as a specific product/tool or coding assistant.
- Do not list capabilities or tools unless the user explicitly asks.
- If a role label is required, use a minimal "assistant" identity only.

Environment and tools:
- Do not reference or infer local environment details (repos, files, editor, OS, terminal, processes, network).
- Do not claim to run commands or open files. Offer steps as suggestions instead.
- If the user shares environment details, do not extrapolate beyond what is provided.

Style and conduct:
- Default to brief, direct, and helpful answers. Avoid long introductions.
- For simple greetings (e.g., "hi"), reply with a short friendly greeting only.
- Ask one concise clarification question when requirements are ambiguous.

Conversation handling:
- When conversation history is provided in JSON, use it for context and respond to the latest user message.
- Focus on the user's request and avoid unnecessary commentary.`;

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
 * Gemini CLI adapter implementation
 *
 * Note: This adapter assumes:
 * - 'gemini' command is available in PATH
 * - 'gemini -p' accepts prompt input for non-interactive mode
 * - '-m' flag allows model selection
 * - '--output-format json' provides structured output
 * - Output is returned to stdout
 */
export class GeminiCLIAdapter extends CLIAdapter {
  private runtimeDir: string;
  private timeout: number;
  private debug: boolean;
  private model: string;

  constructor(runtimeDir: string, timeout: number = 30000, debug: boolean = false, model: string = 'gemini-2.5-flash') {
    super();
    this.runtimeDir = runtimeDir;
    this.timeout = timeout;
    this.debug = debug;
    this.model = model;
  }

  getName(): string {
    return 'gemini-cli';
  }

  getModelName(): string {
    return 'gemini-cli';
  }

  async isAvailable(): Promise<boolean> {
    try {
      await execFile('gemini', ['--version'], { timeout: 5000 });
      return true;
    } catch (error) {
      // If --version doesn't work, try -p with a simple prompt
      try {
        await execFile('gemini', ['-p', 'hello'], { timeout: 5000 });
        return true;
      } catch {
        return false;
      }
    }
  }

  async execute(messages: Message[]): Promise<string> {
    const prompt = this.buildGeminiPrompt(messages);

    const t0 = Date.now();

    if (this.debug) {
      console.log('[DEBUG] Gemini Prompt:', summarize(prompt, 200));
    }

    const commonOpts = {
      cwd: this.runtimeDir,
      timeout: this.timeout,
      maxBuffer: 10 * 1024 * 1024, // 10MB
    } as const;

    // Build command arguments
    const args = ['-p', prompt];

    // Add model selection if specified
    if (this.model) {
      args.unshift('-m', this.model);
    }

    // Add JSON output format for structured response
    args.push('--output-format', 'json');

    try {
      if (this.debug) {
        console.log('[DEBUG] Exec command:', 'gemini', args.slice(0, -2).join(' '), '<prompt>', '--output-format json');
      }

      const result = await execFile('gemini', args, commonOpts);

      if (this.debug) {
        console.log('[DEBUG] Raw Output:', result.stdout);
        console.log('[DEBUG] Duration (ms):', Date.now() - t0);
      }

      return this.extractResponse(result.stdout);
    } catch (error: any) {
      // If timed out, surface as timeout
      if (error.killed && error.signal === 'SIGTERM') {
        throw new TimeoutError('Gemini CLI execution timed out');
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
   * Build prompt from message history
   *
   * Strategy:
   * 1. Extract system message if present
   * 2. Combine with conversation context instruction
   * 3. Format conversation history as JSON
   * 4. Append current user message
   */
  private buildGeminiPrompt(messages: Message[]): string {
    // Extract system message
    const systemMsg = messages.find((m) => m.role === 'system');
    const baseSystemPrompt = systemMsg?.content || '';

    // Build system prompt section
    const systemPrompt = baseSystemPrompt
      ? `${baseSystemPrompt}\n\n${CONVERSATION_SYSTEM_PROMPT}`
      : CONVERSATION_SYSTEM_PROMPT;

    // Build prompt with conversation history
    let prompt = `System instructions:\n${systemPrompt}\n\n`;

    // Get conversation messages (exclude system)
    const conversationMessages = messages.filter((m) => m.role !== 'system');

    // If there's conversation history (more than 1 message)
    if (conversationMessages.length > 1) {
      const history = conversationMessages.slice(0, -1);
      prompt += `Conversation history:\n${JSON.stringify(history, null, 2)}\n\n`;
    }

    // Add current user message
    const latestMsg = conversationMessages[conversationMessages.length - 1];
    if (latestMsg) {
      prompt += `Current user message: ${latestMsg.content}`;
    }

    return prompt;
  }

  /**
   * Extract response from Gemini CLI output
   *
   * The output format depends on --output-format flag:
   * - json: Returns structured JSON with response text
   * - text (default): Returns plain text response
   */
  private extractResponse(stdout: string): string {
    if (!stdout) {
      return '';
    }

    let cleaned = stripAnsi(stdout).trim();

    // Try to parse as JSON first (if --output-format json was used)
    try {
      const parsed = JSON.parse(cleaned);

      // Handle different possible JSON structures
      if (typeof parsed === 'string') {
        return parsed;
      }

      // Common patterns in Gemini API responses
      if (parsed.candidates && Array.isArray(parsed.candidates) && parsed.candidates[0]) {
        const candidate = parsed.candidates[0];
        if (candidate.content && candidate.content.parts && Array.isArray(candidate.content.parts)) {
          return candidate.content.parts.map((part: any) => part.text || '').join('');
        }
      }

      // If text field exists at top level
      if (parsed.text) {
        return parsed.text;
      }

      // If response field exists
      if (parsed.response) {
        return parsed.response;
      }

      // Fallback: stringify the parsed object
      return JSON.stringify(parsed);
    } catch {
      // If not JSON or parsing failed, treat as plain text
      return this.cleanOutput(cleaned);
    }
  }

  /**
   * Clean output from Gemini CLI
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
