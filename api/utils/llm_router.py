from .gemini_adapter import GeminiAdapter
from .groq_adapter import GroqAdapter
from .nvidia_adapter import NvidiaAdapter
import os

class LLMRouter:
    """
    Decide which LLM to use.
    """
    def __init__(self):
        # We instantiate two Nvidia adapters with the specific keys provided by the user
        self.adapters = {
            "gemini": GeminiAdapter(),
            "groq": GroqAdapter(),
            "nvidia_nemotron": NvidiaAdapter(api_key=os.getenv("NVIDIA_API_KEY_NEMOTRON")),
            "nvidia_gpt": NvidiaAdapter(api_key=os.getenv("NVIDIA_API_KEY_GPT"))
        }

    def select(self, request_data: dict):
        model = request_data.get("model", "").lower()
        preferred = request_data.get("model_preference", "gemini").lower()
        
        # Explicitly route NVIDIA / OpenAI models to the NVIDIA NIM adapter
        if "nemotron" in model:
            return self.adapters["nvidia_nemotron"], model
        elif "gpt-oss" in model:
            return self.adapters["nvidia_gpt"], model
            
        if preferred in self.adapters:
            return self.adapters[preferred], model
        return self.adapters["gemini"], model

    def chat(self, request_data: dict):
        adapter, model = self.select(request_data)
        messages = request_data.get("messages", [])
        
        try:
            # If the adapter takes a model param (like Nvidia), pass it. Otherwise just messages.
            import inspect
            if "model" in inspect.signature(adapter.chat).parameters:
                return adapter.chat(messages, model=model)
            else:
                return adapter.chat(messages)
        except Exception as exc:
            # Graceful fallback to Groq
            print("LLM error:", exc, "→ falling back to Groq")
            return self.adapters["groq"].chat(messages)
