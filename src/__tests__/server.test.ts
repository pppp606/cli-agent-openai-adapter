import request from 'supertest';
import express from 'express';
import { createServer } from '../server';
import { CLIAdapter } from '../adapters/base';
import { TimeoutError } from '../adapters/claude_code';
import { Message } from '../types';

// Mock adapter for testing
class MockAdapter extends CLIAdapter {
  private mockExecute: jest.Mock;
  private mockIsAvailable: jest.Mock;

  constructor() {
    super();
    this.mockExecute = jest.fn();
    this.mockIsAvailable = jest.fn().mockResolvedValue(true);
  }

  async execute(messages: Message[]): Promise<string> {
    return this.mockExecute(messages);
  }

  async isAvailable(): Promise<boolean> {
    return this.mockIsAvailable();
  }

  getName(): string {
    return 'mock-adapter';
  }

  getModelName(): string {
    return 'mock-model';
  }

  // Expose mocks for testing
  getMockExecute() {
    return this.mockExecute;
  }

  getMockIsAvailable() {
    return this.mockIsAvailable;
  }
}

describe('Server', () => {
  let app: express.Application;
  let mockAdapter: MockAdapter;

  beforeEach(() => {
    mockAdapter = new MockAdapter();
    app = createServer(mockAdapter);
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'ok',
        adapter: 'mock-adapter',
      });
    });
  });

  describe('GET /v1/models', () => {
    it('should return list of models', async () => {
      const response = await request(app).get('/v1/models');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        object: 'list',
        data: [
          {
            id: 'mock-model',
            object: 'model',
            created: expect.any(Number),
            owned_by: 'cli-agent-openai-adapter',
          },
        ],
      });
    });
  });

  describe('POST /v1/chat/completions', () => {
    it('should return chat completion response', async () => {
      mockAdapter.getMockExecute().mockResolvedValue('Hello! How can I help you?');

      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          model: 'mock-model',
          messages: [{ role: 'user', content: 'Hello!' }],
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: expect.stringMatching(/^chatcmpl-/),
        object: 'chat.completion',
        created: expect.any(Number),
        model: 'mock-model',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello! How can I help you?',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: expect.any(Number),
          completion_tokens: expect.any(Number),
          total_tokens: expect.any(Number),
        },
      });

      expect(mockAdapter.getMockExecute()).toHaveBeenCalledWith([
        { role: 'user', content: 'Hello!' },
      ]);
    });

    it('should use model from request body', async () => {
      mockAdapter.getMockExecute().mockResolvedValue('Response');

      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          model: 'custom-model',
          messages: [{ role: 'user', content: 'Hello!' }],
        });

      expect(response.status).toBe(200);
      expect(response.body.model).toBe('custom-model');
    });

    it('should handle system and user messages', async () => {
      mockAdapter.getMockExecute().mockResolvedValue('Response');

      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          model: 'mock-model',
          messages: [
            { role: 'system', content: 'You are helpful.' },
            { role: 'user', content: 'Hello!' },
          ],
        });

      expect(response.status).toBe(200);
      expect(mockAdapter.getMockExecute()).toHaveBeenCalledWith([
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Hello!' },
      ]);
    });

    it('should return 400 when messages array is missing', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          model: 'mock-model',
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: {
          message: 'Invalid request: messages array is required',
          type: 'invalid_request_error',
          code: 'invalid_request',
        },
      });
    });

    it('should return 400 when messages array is empty', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          model: 'mock-model',
          messages: [],
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: {
          message: 'Invalid request: messages array cannot be empty',
          type: 'invalid_request_error',
          code: 'invalid_request',
        },
      });
    });

    it('should return 400 when messages is not an array', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          model: 'mock-model',
          messages: 'not an array',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('messages array is required');
    });

    it('should return 504 on timeout error', async () => {
      mockAdapter.getMockExecute().mockRejectedValue(new TimeoutError('Execution timed out'));

      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          model: 'mock-model',
          messages: [{ role: 'user', content: 'Hello!' }],
        });

      expect(response.status).toBe(504);
      expect(response.body).toEqual({
        error: {
          message: 'Execution timed out',
          type: 'timeout_error',
          code: 'timeout',
        },
      });
    });

    it('should return 500 on internal error', async () => {
      mockAdapter.getMockExecute().mockRejectedValue(new Error('Internal error'));

      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          model: 'mock-model',
          messages: [{ role: 'user', content: 'Hello!' }],
        });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: {
          message: 'Internal error',
          type: 'internal_error',
          code: 'internal_error',
        },
      });
    });

    it('should handle conversation history', async () => {
      mockAdapter.getMockExecute().mockResolvedValue('Your favorite color is blue');

      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          model: 'mock-model',
          messages: [
            { role: 'user', content: 'My favorite color is blue' },
            { role: 'assistant', content: 'That is nice!' },
            { role: 'user', content: 'What is my favorite color?' },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.choices[0].message.content).toBe('Your favorite color is blue');
      expect(mockAdapter.getMockExecute()).toHaveBeenCalledWith([
        { role: 'user', content: 'My favorite color is blue' },
        { role: 'assistant', content: 'That is nice!' },
        { role: 'user', content: 'What is my favorite color?' },
      ]);
    });
  });

  describe('CORS', () => {
    it('should have CORS headers', async () => {
      const response = await request(app)
        .options('/v1/chat/completions')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });
});
