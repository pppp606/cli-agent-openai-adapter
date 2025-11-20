LangChain JS Demo (OpenAI-compatible Adapter)

This example shows how to call the local adapter using LangChain JS.

Prerequisites
- Adapter server running locally: `npm run dev` (defaults to http://localhost:8000)
- Node.js >= 20

Setup
```
cd examples/langchain-js
npm init -y
npm i @langchain/openai langchain
```

Run
```
node chat.mjs
```

Files
- `chat.mjs`: Minimal chat completion using `ChatOpenAI` with a custom `baseURL`.

