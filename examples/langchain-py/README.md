LangChain Python Demo (OpenAI-compatible Adapter)

This example shows how to call the local adapter using LangChain for Python.

Prerequisites
- Adapter server running locally: `npm run dev` (defaults to http://localhost:8000)
- Python 3.9+

Setup
```
cd examples/langchain-py
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
pip install langchain langchain-openai
```

Run
```
python demo.py
```

Files
- `demo.py`: Minimal chat completion using `ChatOpenAI` with a custom `base_url`.

