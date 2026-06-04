from .gemini_adapter import GeminiAdapter
from .groq_adapter import GroqAdapter

class LLMRouter:
    """
    Decide which LLM to use.
    """
    def __init__(self):
        self.adapters = {
            "gemini": GeminiAdapter(),
            "groq": GroqAdapter(),
        }

    def select(self, request_data: dict):
        preferred = request_data.get("model_preference", "gemini").lower()
        if preferred in self.adapters:
            return self.adapters[preferred]
        return self.adapters["gemini"]

    def chat(self, request_data: dict):
        adapter = self.select(request_data)
        messages = request_data.get("messages", [])
        try:
            return adapter.chat(messages)
        except Exception as exc:
            # Graceful fallback to Groq
            print("LLM error:", exc, "→ falling back to Groq")
            return self.adapters["groq"].chat(messages)
