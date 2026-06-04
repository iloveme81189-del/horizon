import os
from openai import OpenAI
from .llm_interface import LLMInterface

class NvidiaAdapter(LLMInterface):
    """
    Adapter for NVIDIA NIM API (supports both Nemotron and hosted OpenAI/other OSS models).
    """
    def __init__(self, api_key: str = None):
        self.api_key = api_key
        
    def chat(self, messages: list, model: str) -> str:
        # If specific key not passed to adapter, fallback to global
        api_key = self.api_key or os.getenv("NVIDIA_API_KEY")
        if not api_key:
            raise Exception("NVIDIA_API_KEY is not set.")
            
        client = OpenAI(
            base_url="https://integrate.api.nvidia.com/v1",
            api_key=api_key
        )
        
        # Format messages for standard OpenAI-compatible API
        formatted_messages = []
        for msg in messages:
            # Handle different dictionary structures from the router/frontend
            if isinstance(msg, dict):
                role = msg.get("role", "user")
                content = msg.get("parts", [{}])[0].get("text", msg.get("text", "")) if "parts" in msg else msg.get("content", msg.get("text", ""))
                formatted_messages.append({"role": role, "content": content})
            else:
                formatted_messages.append({"role": "user", "content": str(msg)})
        
        # If the frontend passes 'nvidia/nemotron...', we use the full string. 
        # But sometimes they pass 'openai/gpt-oss-120b'. We trust the string.
        response = client.chat.completions.create(
            model=model,
            messages=formatted_messages,
            temperature=0.2,
            max_tokens=2048
        )
        
        content = response.choices[0].message.content or ""
        usage = {
            "input_tokens": response.usage.prompt_tokens if hasattr(response.usage, 'prompt_tokens') else 0,
            "output_tokens": response.usage.completion_tokens if hasattr(response.usage, 'completion_tokens') else 0,
            "total_tokens": response.usage.total_tokens if hasattr(response.usage, 'total_tokens') else 0,
        }
        return {"content": content, "usage": usage, "model": model}
