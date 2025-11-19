# Minimal Web Client (No Docker)

A tiny, dependency-free HTML chat client that talks to the CLI Agent OpenAI Adapter via `POST /v1/chat/completions`.

## Prerequisites

- Node.js 20+
- `claude` CLI is installed and available in PATH (`claude --version`)

## Start the adapter (minimal)

From the repository root:

```bash
npm ci
npm run build && npm start
```

Health check:

```bash
curl http://localhost:8000/health
```

## Open the client

- Open `examples/minimal-web-client/index.html` in your browser (double-click or drag-drop)
- Default API endpoint: `http://localhost:8000/v1/chat/completions`
- You can change the endpoint and system prompt in the UI

## Tips

- CORS is enabled on the adapter, so loading the page directly from `file://` works
- Conversation history is in-memory on the page only (no persistence)
- For longer responses, increase timeout when starting the adapter, e.g. `TIMEOUT=60000 npm start`
