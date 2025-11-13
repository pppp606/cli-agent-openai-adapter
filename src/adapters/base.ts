import { Message } from '../types';

/**
 * Abstract base class for CLI adapters
 */
export abstract class CLIAdapter {
  /**
   * Execute the CLI tool with the given messages and return the response
   */
  abstract execute(messages: Message[]): Promise<string>;

  /**
   * Check if the CLI tool is available in the system
   */
  abstract isAvailable(): Promise<boolean>;

  /**
   * Get the name of the adapter
   */
  abstract getName(): string;

  /**
   * Get the model name to report in API responses
   */
  abstract getModelName(): string;
}
