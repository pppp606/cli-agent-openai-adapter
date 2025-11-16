# Minimal Web Client (No Docker)

A tiny, dependency-free HTML chat client that talks to the CLI Agent OpenAI Adapter via `POST /v1/chat/completions`.

## Prerequisites

- Node.js 20+
- `claude` CLI is installed and available in PATH

## Start the Adapter

From the repository root:

```bash
npm ci
RUNTIME_DIR=$(pwd)/runtime/claude-code npm run build && RUNTIME_DIR=$(pwd)/runtime/claude-code npm start
```

Check health:

```bash
curl http://localhost:8000/health
```

## Open the Client

- Open `examples/minimal-web-client/index.html` in your browser (double-click or drag-drop).
- Default API endpoint: `http://localhost:8000/v1/chat/completions`
- You can change the endpoint and system prompt in the UI.

## Notes

- CORS is enabled on the adapter, so loading the page directly from `file://` works.
- Conversation history is kept on the page only (no persistence). Reload resets the chat unless you export/import manually.
- For longer responses, increase adapter timeout via `TIMEOUT=60000` when starting the adapter.

