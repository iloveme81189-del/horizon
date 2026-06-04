import os
import google.generativeai as genai
from typing import List, Dict, Any
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

# We look for a service account JSON file, else we fall back to GEMINI_API_KEY
gemini_key = os.getenv("GEMINI_API_KEY", "")

if gemini_key:
    genai.configure(api_key=gemini_key)
# if using GOOGLE_APPLICATION_CREDENTIALS it configures automatically

# Initialize the Gemini Pro model
model = genai.GenerativeModel(
    model_name="gemini-1.5-pro",
    generation_config=genai.GenerationConfig(
        temperature=0.0,
        max_output_tokens=2048,
        top_p=0.95,
    ),
)

class GeminiResponse(BaseModel):
    content: str
    usage: Dict[str, int]

def call_gemini(messages: List[Dict[str, str]]) -> GeminiResponse:
    """
    Format generic messages to Gemini content format.
    """
    system = ""
    convo = []
    for m in messages:
        if m["role"] == "system":
            system = m["content"]
            continue
        role = "user" if m["role"] == "user" else "model"
        convo.append({
            "role": role,
            "parts": [m["content"]]
        })

    if system:
        prompt = f"SYSTEM INSTRUCTIONS:\n{system}\n\n"
        if convo:
            convo[0]["parts"][0] = prompt + convo[0]["parts"][0]
        else:
            convo.append({"role": "user", "parts": [prompt]})

    response = model.generate_content(convo)
    
    # Try to extract usage, fallback to 0 if not supported by the model version
    usage = {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}
    if hasattr(response, 'usage_metadata'):
        usage = {
            "input_tokens": getattr(response.usage_metadata, 'prompt_token_count', 0),
            "output_tokens": getattr(response.usage_metadata, 'candidates_token_count', 0),
            "total_tokens": getattr(response.usage_metadata, 'total_token_count', 0),
        }
        
    return GeminiResponse(content=response.text, usage=usage)
