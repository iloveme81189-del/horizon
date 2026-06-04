import os
import json
import tempfile
from fastapi import FastAPI, Request, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse

from .utils.vault import decrypt_env
decrypt_env() # Decrypt keys BEFORE loading any models

from .utils.llm_router import LLMRouter
from .utils.notebook import NotebookStore
from markitdown import MarkItDown

app = FastAPI()
router = LLMRouter()

# Try to initialize NotebookStore, but fail gracefully if sentence-transformers is downloading etc.
try:
    store = NotebookStore()
except Exception as e:
    print(f"Failed to initialize NotebookStore (ChromaDB): {e}")
    store = None

@app.post("/api/chat")
async def chat_endpoint(request: Request):
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    if "messages" not in payload:
        raise HTTPException(status_code=400, detail="Missing 'messages'")
        
    # Call the appropriate LLM via Router
    llm_result = router.chat(payload)
    
    # Persist to Notebook LM
    if store:
        try:
            await store.save_interaction(
                task_id=payload.get("task_id", "anon"),
                model=llm_result["model"],
                messages=payload["messages"],
                response=llm_result["content"],
                usage=llm_result["usage"],
            )
        except Exception as e:
            print(f"Error saving to notebook: {e}")
            
    # Keep output compatible with what Node.js proxy or frontend expects
    return {"role": "assistant", "content": llm_result["content"]}

@app.post("/api/n8n/webhook")
async def n8n_webhook(request: Request):
    """
    Webhook strictly formatted for n8n. 
    Accepts: { "message": "...", "model": "..." }
    Returns: { "reply": "...", "model": "..." }
    """
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
        
    message = payload.get("message", "")
    model = payload.get("model", "llama-3.3-70b-versatile")
    
    # Format payload for LLMRouter
    router_payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": "You are Horizon, an elite AI assistant created by Dr. Hari Krishna. You are responding to a request forwarded from an n8n automation workflow. Respond concisely and precisely. Format code with markdown. Never emit placeholders."},
            {"role": "user", "content": message}
        ]
    }
    
    llm_result = router.chat(router_payload)
    
    # n8n expects "reply"
    return {
        "reply": llm_result["content"],
        "model": llm_result["model"]
    }

@app.post("/api/gemini-eval")
async def gemini_eval(request: Request):
    """
    Second public endpoint for LLM-as-judge (n8n or QA tools can call this).
    """
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    payload["model_preference"] = "gemini"
    llm_result = router.chat(payload)
    return {"evaluation": llm_result["content"], "usage": llm_result["usage"]}

# ── Fallback MarkItDown Upload Handler ──
@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    if not file.filename:
        return JSONResponse(status_code=400, content={"success": False, "error": "No selected file"})

    temp_path = None
    try:
        fd, temp_path = tempfile.mkstemp(suffix=os.path.splitext(file.filename)[1])
        os.close(fd)
        
        with open(temp_path, "wb") as f:
            content = await file.read()
            f.write(content)

        md = MarkItDown()
        result = md.convert(temp_path)
        
        content = result.text_content
        if len(content) > 50000:
            content = content[:50000]

        return {"success": True, "fileName": file.filename, "type": "text", "content": content}

    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
