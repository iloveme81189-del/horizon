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
        # Explicitly route Groq models
        elif "llama" in model or "mixtral" in model or "gemma" in model:
            return self.adapters["groq"], model
            
        if preferred in self.adapters:
            return self.adapters[preferred], model
        return self.adapters["gemini"], model

    def chat(self, request_data: dict):
        adapter, model = self.select(request_data)
        messages = request_data.get("messages", [])
        file_context = request_data.get("fileContext", "")
        
        if file_context and str(file_context).strip():
            # Inject file context into the last user message
            if messages and messages[-1]["role"] == "user":
                messages[-1]["content"] += f"\n\n--- FILE CONTEXT ---\n{file_context}\n--------------------"
            else:
                messages.append({"role": "user", "content": f"--- FILE CONTEXT ---\n{file_context}\n--------------------"})
        
        try:
            # If the adapter takes a model param (like Nvidia), pass it. Otherwise just messages.
            import inspect
            if "model" in inspect.signature(adapter.chat).parameters:
                return adapter.chat(messages, model=model)
            else:
                return adapter.chat(messages)
        except Exception as exc:
            print(f"LLM error with {model}: {exc} → executing multi-tier fallback")
            errors = [f"Primary ({model}): {exc}"]
            
            # Fallback 1: Gemini (Highly reliable, 2M context window)
            if adapter != self.adapters.get("gemini"):
                try:
                    print("Falling back to Gemini...")
                    import inspect
                    if "model" in inspect.signature(self.adapters["gemini"].chat).parameters:
                        return self.adapters["gemini"].chat(messages, model="gemini-1.5-pro")
                    else:
                        return self.adapters["gemini"].chat(messages)
                except Exception as e2:
                    print(f"Gemini fallback failed: {e2}")
                    errors.append(f"Gemini: {e2}")
            
            # Fallback 2: Groq (Lightning fast)
            if adapter != self.adapters.get("groq"):
                try:
                    print("Falling back to Groq...")
                    import inspect
                    if "model" in inspect.signature(self.adapters["groq"].chat).parameters:
                        return self.adapters["groq"].chat(messages, model="llama-3.3-70b-versatile")
                    else:
                        return self.adapters["groq"].chat(messages)
                except Exception as e3:
                    print(f"Groq fallback failed: {e3}")
                    errors.append(f"Groq: {e3}")
                    
            return {
                "content": "Critical Error: All configured LLM backends failed. \n\n**Error Log:**\n" + "\n".join(f"- {e}" for e in errors),
                "usage": {},
                "model": "error"
            }
