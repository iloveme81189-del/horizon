from .llm_interface import LLMInterface
from .gemini import call_gemini

class GeminiAdapter(LLMInterface):
    def chat(self, messages, model=None):
        resp = call_gemini(messages)
        return {"content": resp.content, "usage": resp.usage, "model": "gemini-3.1-pro"}
