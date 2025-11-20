from langchain_openai import ChatOpenAI

# Point LangChain to the local adapter's OpenAI-compatible endpoint
llm = ChatOpenAI(
    api_key="dummy-key",  # not used by local adapter
    base_url="http://localhost:8000/v1",
    model="claude-code",
)

resp = llm.invoke("hi! Reply in one short sentence.")
print(resp.content)

