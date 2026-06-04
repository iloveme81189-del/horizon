import os
from groq import Groq
from .llm_interface import LLMInterface

class GroqAdapter(LLMInterface):
    def __init__(self):
        self.client = Groq(api_key=os.getenv("GROQ_API_KEY", ""))
        self.model_name = "llama-3.3-70b-versatile"

    def chat(self, messages):
        if not self.client.api_key:
            return {"content": "Error: GROQ_API_KEY not set", "usage": {}, "model": self.model_name}

        response = self.client.chat.completions.create(
            messages=messages,
            model=self.model_name,
            temperature=0.5,
            max_tokens=2048,
        )
        
        content = response.choices[0].message.content
        usage = {
            "input_tokens": response.usage.prompt_tokens,
            "output_tokens": response.usage.completion_tokens,
            "total_tokens": response.usage.total_tokens,
        }
        return {"content": content, "usage": usage, "model": self.model_name}
