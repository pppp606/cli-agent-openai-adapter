import { ChatOpenAI } from "@langchain/openai";

// Point LangChain to the local adapter's OpenAI-compatible endpoint
const llm = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY || "dummy-key", // not used by local adapter
  baseURL: process.env.ADAPTER_BASE_URL || "http://localhost:8000/v1",
  model: process.env.ADAPTER_MODEL || "claude-code",
});

const resp = await llm.invoke("hi! Reply in one short sentence.");
console.log(resp.content);

