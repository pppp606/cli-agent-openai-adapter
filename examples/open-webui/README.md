# Open WebUI Demo with CLI Agent OpenAI Adapter

This demo shows how to use [Open WebUI](https://github.com/open-webui/open-webui) with the CLI Agent OpenAI Adapter to create a ChatGPT-like web interface powered by Claude Code (or other CLI-based AI agents).

## What This Demo Does

- **Open WebUI**: Popular ChatGPT-like web interface (40k+ GitHub stars)
- **CLI Agent OpenAI Adapter**: Converts Claude Code to OpenAI-compatible API
- **Result**: Web-based chat interface using Claude Code locally

## Prerequisites

- Docker and Docker Compose installed
- Claude Code CLI installed and accessible
- Port 3000 (Open WebUI) and 8000 (Adapter) available

## Quick Start

### 1. Start the Services

```bash
cd examples/open-webui
docker compose up -d
```

This will start:
- **CLI Agent OpenAI Adapter** on `http://localhost:8000`
- **Open WebUI** on `http://localhost:3000`

### 2. Access the Web Interface

Open your browser and navigate to:
```
http://localhost:3000
```

### 3. Start Chatting

You can now chat with Claude Code through the Open WebUI interface!

**Note**: Since this is a demo, authentication is disabled. The adapter uses a dummy API key.

## Configuration

### Adapter Settings

Edit `docker-compose.yml` to configure the adapter:

```yaml
environment:
  - ADAPTER_TYPE=claude-code    # Adapter type
  - PORT=8000                   # Adapter port
  - TIMEOUT=30000               # Request timeout (ms)
  - DEBUG=false                 # Debug mode
```

### Open WebUI Settings

Configure Open WebUI through environment variables:

```yaml
environment:
  - OPENAI_API_BASE_URL=http://adapter:8000/v1  # Adapter endpoint
  - OPENAI_API_KEY=dummy                         # Dummy key (required)
  - WEBUI_AUTH=false                             # Disable auth for demo
```

## Architecture

```
┌─────────────┐      HTTP       ┌──────────────┐      execFile      ┌─────────────┐
│             │ ───────────────> │              │ ─────────────────> │             │
│ Open WebUI  │   /v1/chat/      │   Adapter    │  claude code       │ Claude Code │
│  (Browser)  │   completions    │   (Node.js)  │  --system-prompt   │     CLI     │
│             │ <─────────────── │              │ <───────────────── │             │
└─────────────┘      JSON        └──────────────┘      stdout        └─────────────┘
   Port 3000                          Port 8000
```

## Stopping the Services

```bash
docker compose down
```

To remove all data including chat history:

```bash
docker compose down -v
```

## Troubleshooting

### Claude Code Not Found

If you see errors about Claude Code not being available, make sure:

1. Claude Code CLI is installed on the host machine
2. The `claude` command is accessible in PATH

**Option 1**: Install Claude Code globally and ensure it's in the Docker container's PATH

**Option 2**: Mount the Claude binary into the container (advanced)

### Port Already in Use

If ports 3000 or 8000 are already in use, edit `docker-compose.yml`:

```yaml
ports:
  - "3001:8080"  # Change Open WebUI port to 3001
  - "8001:8000"  # Change Adapter port to 8001
```

### Slow Responses

Claude Code execution may take time. You can increase the timeout:

```yaml
environment:
  - TIMEOUT=60000  # 60 seconds
```

## Alternative: Run Without Docker

You can also run both services without Docker:

### 1. Start the Adapter

```bash
# From project root
npm install
npm run build
npm start
```

### 2. Start Open WebUI

```bash
# Using Docker
docker run -d \
  -p 3000:8080 \
  -e OPENAI_API_BASE_URL=http://host.docker.internal:8000/v1 \
  -e OPENAI_API_KEY=dummy \
  -e WEBUI_AUTH=false \
  ghcr.io/open-webui/open-webui:main
```

Or install Open WebUI locally following their [documentation](https://docs.openwebui.com).

## Features Demonstrated

- ✅ OpenAI-compatible API integration
- ✅ Web-based chat interface
- ✅ Conversation history preservation
- ✅ Docker Compose orchestration
- ✅ Environment-based configuration

## Learn More

- **Open WebUI**: https://github.com/open-webui/open-webui
- **CLI Agent OpenAI Adapter**: https://github.com/pppp606/cli-agent-openai-adapter
- **Claude Code**: https://docs.anthropic.com/claude/docs/claude-code

## Production Use

**Important**: This demo is configured for local development only:

- Authentication is disabled (`WEBUI_AUTH=false`)
- Uses a dummy API key
- Not suitable for production without proper security measures

For production deployment:
1. Enable Open WebUI authentication
2. Add proper API key validation
3. Use HTTPS/TLS
4. Implement rate limiting
5. Review Anthropic's Terms of Service
