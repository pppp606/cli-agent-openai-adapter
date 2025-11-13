import express, { Request, Response } from 'express';
import cors from 'cors';
import { CLIAdapter } from './adapters/base';
import { TimeoutError } from './adapters/claude_code';
import {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ErrorResponse,
} from './types';

/**
 * Create Express server with OpenAI-compatible endpoints
 */
export function createServer(adapter: CLIAdapter): express.Application {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', adapter: adapter.getName() });
  });

  // OpenAI-compatible chat completions endpoint
  app.post('/v1/chat/completions', async (req: Request, res: Response) => {
    try {
      const request: ChatCompletionRequest = req.body;

      // Validate request
      if (!request.messages || !Array.isArray(request.messages)) {
        const errorResponse: ErrorResponse = {
          error: {
            message: 'Invalid request: messages array is required',
            type: 'invalid_request_error',
            code: 'invalid_request',
          },
        };
        return res.status(400).json(errorResponse);
      }

      if (request.messages.length === 0) {
        const errorResponse: ErrorResponse = {
          error: {
            message: 'Invalid request: messages array cannot be empty',
            type: 'invalid_request_error',
            code: 'invalid_request',
          },
        };
        return res.status(400).json(errorResponse);
      }

      // Execute adapter
      const content = await adapter.execute(request.messages);

      // Build OpenAI-compatible response
      const response: ChatCompletionResponse = {
        id: generateId(),
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: request.model || adapter.getModelName(),
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: content,
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: estimateTokens(JSON.stringify(request.messages)),
          completion_tokens: estimateTokens(content),
          total_tokens: estimateTokens(JSON.stringify(request.messages) + content),
        },
      };

      res.json(response);
    } catch (error: any) {
      console.error('Error processing request:', error);

      let errorResponse: ErrorResponse;

      if (error instanceof TimeoutError) {
        errorResponse = {
          error: {
            message: error.message,
            type: 'timeout_error',
            code: 'timeout',
          },
        };
        res.status(504).json(errorResponse);
      } else {
        errorResponse = {
          error: {
            message: error.message || 'Internal server error',
            type: 'internal_error',
            code: 'internal_error',
          },
        };
        res.status(500).json(errorResponse);
      }
    }
  });

  // Models endpoint (optional, for compatibility)
  app.get('/v1/models', (req: Request, res: Response) => {
    res.json({
      object: 'list',
      data: [
        {
          id: adapter.getModelName(),
          object: 'model',
          created: Math.floor(Date.now() / 1000),
          owned_by: 'cli-agent-openai-adapter',
        },
      ],
    });
  });

  return app;
}

/**
 * Generate a unique ID for chat completion
 */
function generateId(): string {
  return `chatcmpl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Estimate token count (rough approximation)
 * Real token counting requires the actual tokenizer
 */
function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token
  return Math.ceil(text.length / 4);
}
