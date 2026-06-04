import os
from groq import Groq
from .llm_interface import LLMInterface

class GroqAdapter(LLMInterface):
    def __init__(self):
        self.client = Groq(api_key=os.getenv("GROQ_API_KEY", ""))
        self.model_name = "llama-3.3-70b-versatile"

    def chat(self, messages, model=None):
        if not self.client.api_key:
            return {"content": "Error: GROQ_API_KEY not set", "usage": {}, "model": self.model_name}

        # Use the requested model, fallback to default
        target_model = model if model else self.model_name

        response = self.client.chat.completions.create(
            messages=messages,
            model=target_model,
            temperature=0.5,
            max_tokens=2048,
        )
        
        content = response.choices[0].message.content or ""
        usage = {
            "input_tokens": response.usage.prompt_tokens if hasattr(response.usage, 'prompt_tokens') else 0,
            "output_tokens": response.usage.completion_tokens if hasattr(response.usage, 'completion_tokens') else 0,
            "total_tokens": response.usage.total_tokens if hasattr(response.usage, 'total_tokens') else 0,
        }
        return {"content": content, "usage": usage, "model": target_model}
