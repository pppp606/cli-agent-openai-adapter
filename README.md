# cli-agent-openai-adapter

[![Test](https://github.com/pppp606/cli-agent-openai-adapter/actions/workflows/test.yml/badge.svg)](https://github.com/pppp606/cli-agent-openai-adapter/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Convert CLI-based AI agents (Claude Code, etc.) to OpenAI-compatible API endpoints.

## Overview

This adapter allows you to use local CLI tools like Claude Code as drop-in replacements for OpenAI's API in your development environment, while keeping the same code structure for production.

**Use Cases:**
- **Production**: Use OpenAI API (pay per token)
- **Development**: Use local Claude Code (reduce costs)
- **Same Code**: Switch between environments using the same API interface (e.g., LangChain's `ChatOpenAI`)

## Features

- ✅ OpenAI-compatible API endpoints (`/v1/chat/completions`)
- ✅ Support for conversation history
- ✅ Stateless execution (like OpenAI API)
- ✅ Chat-only mode (tools disabled for safety)
- ✅ TypeScript with full type definitions
- 🚧 Claude Code adapter (initial implementation)
- 🔜 Codex adapter (future)
- 🔜 Gemini CLI adapter (future)

## Installation

```bash
npm install -g cli-agent-openai-adapter
```

Or use directly with npx:

```bash
npx cli-agent-openai-adapter
```

## Prerequisites

- Node.js >= 18.0.0
- Claude Code CLI installed and accessible in PATH

To verify Claude Code is installed:

```bash
claude --version
```

## Usage

### Start the Server

```bash
cli-agent-openai-adapter
```

By default, the server starts at `http://localhost:8000`.

### Configuration

Configure using environment variables:

```bash
export ADAPTER_TYPE=claude-code  # Adapter to use
export PORT=8000                  # Server port
export HOST=localhost             # Server host
export RUNTIME_DIR=./runtime      # Runtime directory (optional)
export TIMEOUT=30000              # Timeout in milliseconds
export DEBUG=true                 # Enable debug mode
```

Or create a `.env` file (requires `dotenv`).

### Example with LangChain

```typescript
import { ChatOpenAI } from "@langchain/openai";

// Development environment: via cli-agent-openai-adapter
const llmDev = new ChatOpenAI({
  configuration: {
    baseURL: "http://localhost:8000/v1"
  },
  modelName: "claude-code",
  apiKey: "dummy" // Not used but required by the SDK
});

// Production environment: OpenAI API directly
const llmProd = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: "gpt-4"
});

// Usage is identical
const response = await llmDev.invoke("Hello!");
console.log(response.content);
```

### Example with OpenAI SDK

```typescript
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "http://localhost:8000/v1",
  apiKey: "dummy" // Not used but required by the SDK
});

const response = await client.chat.completions.create({
  model: "claude-code",
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "Hello!" }
  ]
});

console.log(response.choices[0].message.content);
```

### Example with Direct HTTP Request

```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-code",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

## API Endpoints

### POST /v1/chat/completions

OpenAI-compatible chat completions endpoint.

**Request:**

```json
{
  "model": "claude-code",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello"}
  ],
  "temperature": 0.7,
  "max_tokens": 1000
}
```

**Response:**

```json
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "claude-code",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "Hello! How can I help you?"
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 20,
    "total_tokens": 30
  }
}
```

### GET /v1/models

List available models.

**Response:**

```json
{
  "object": "list",
  "data": [
    {
      "id": "claude-code",
      "object": "model",
      "created": 1234567890,
      "owned_by": "cli-agent-openai-adapter"
    }
  ]
}
```

### GET /health

Health check endpoint.

**Response:**

```json
{
  "status": "ok",
  "adapter": "claude-code"
}
```

## How It Works

### Architecture

1. **Stateless Execution**: Each request executes `claude code --system-prompt "..." -p "..."` independently
2. **Conversation History**: Managed by the client (like OpenAI API), sent in the `messages` array
3. **Chat Mode**: Tools are disabled via `.claude/settings.json` for chat-only behavior
4. **Output Cleaning**: ANSI codes and progress indicators are removed from CLI output

### Conversation History Handling

The adapter formats conversation history as JSON and includes it in the prompt:

```
System Prompt: [Your system message] + Context instruction

User Prompt:
Conversation history:
[
  {"role": "user", "content": "My favorite color is blue"},
  {"role": "assistant", "content": "That's nice!"}
]

Current user message: What is my favorite color?
```

This allows Claude to understand the full context while maintaining stateless execution.

## Error Handling

The adapter handles various error scenarios:

- **Timeout (30s default)**: Returns HTTP 504 with timeout error
- **CLI tool not found**: Fails at startup with clear error message
- **Invalid request**: Returns HTTP 400 with validation error
- **Execution error**: Returns HTTP 500 with error details

## Troubleshooting

### Claude Code not found

**Error:** `claude-code is not available`

**Solution:** Make sure Claude CLI is installed and accessible:

```bash
# Check if claude is in PATH
which claude

# Try running claude directly
claude --version
```

### Timeout errors

**Error:** `Claude Code execution timed out`

**Solution:** Increase timeout:

```bash
export TIMEOUT=60000  # 60 seconds
```

### Output contains noise

If responses contain ANSI codes or progress indicators, please report as an issue with examples.

## Development

### Setup

```bash
git clone https://github.com/pppp606/cli-agent-openai-adapter.git
cd cli-agent-openai-adapter
npm install
```

### Run in Development Mode

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

The project uses Jest for testing with full TypeScript support. All tests are located in `src/__tests__/` directory.

### Continuous Integration

The project uses GitHub Actions for CI/CD. On every push and pull request:
- Tests run on Node.js 18.x, 20.x, and 22.x
- Code coverage is generated and uploaded to Codecov
- Build is verified

See `.github/workflows/test.yml` for the full CI configuration.

### Project Structure

```
cli-agent-openai-adapter/
├── src/
│   ├── adapters/
│   │   ├── base.ts           # Abstract base class
│   │   ├── claude_code.ts    # Claude Code implementation
│   │   └── factory.ts        # Adapter factory
│   ├── bin/
│   │   └── cli.ts            # CLI entry point
│   ├── server.ts             # Express server
│   ├── config.ts             # Configuration loader
│   ├── types.ts              # TypeScript types
│   └── index.ts              # Main exports
├── runtime/
│   └── claude-code/          # Claude Code runtime
│       └── .claude/
│           └── settings.json # Tool disable configuration
├── package.json
├── tsconfig.json
└── README.md
```

## Future Enhancements

- [ ] Support for streaming responses
- [ ] Support for Codex CLI adapter
- [ ] Support for Gemini CLI adapter
- [ ] Configuration file support (.adaprc)
- [ ] Better token estimation
- [ ] Conversation history truncation/summarization
- [ ] Logging and metrics
- [ ] Docker support

## License and Terms

This tool is provided under the MIT License.

**Important:** When using Claude Code through this adapter, you must comply with Anthropic's Terms of Service. Please use this tool in accordance with all applicable terms and conditions.

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## Related Projects

- [claude-ops-mcp](https://github.com/pppp606/claude-ops-mcp) - MCP server for Claude Code operations

## Author

Created by pppp606

---

**Note:** This is an early implementation. The actual behavior of Claude Code CLI options may require adjustments. Please test in your environment and report any issues.
